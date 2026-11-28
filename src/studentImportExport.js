const express = require("express");
const multer = require("multer");
const XLSX = require("xlsx");
const crypto = require("crypto");
const { requireAdmin } = require("./middleware");
const { readDb, writeDb, audit } = require("./store");

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter(req, file, cb) {
    const name = String(file.originalname || "").toLowerCase();
    if (/\.(xlsx|xls|csv)$/.test(name)) return cb(null, true);
    cb(new Error("Upload an .xlsx, .xls or .csv file."));
  }
});
function ensureCsrf(req, res, next) {
  if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(32).toString("hex");
  res.locals.csrfToken = req.session.csrfToken;
  next();
}
function verifyCsrf(req, res, next) {
  const token = req.body && req.body._csrf;
  const expected = req.session.csrfToken;
  if (typeof token !== "string" || !expected || token.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))) {
    return res.status(403).render("error", { title: "Request rejected", message: "The form security token was invalid. Reload the page and try again." });
  }
  next();
}
function clean(value) { return value === undefined || value === null ? "" : String(value).trim(); }
function safeCell(value) {
  const text = value === undefined || value === null ? "" : String(value);
  return /^[\s]*[=+\-@]/.test(text) ? "'" + text : text;
}
function toCsv(rows) {
  const headers = Object.keys(rows[0] || {});
  const quote = value => '"' + safeCell(value).replace(/"/g, '""') + '"';
  return [headers.map(quote).join(","), ...rows.map(row => headers.map(key => quote(row[key])).join(","))].join("\r\n");
}
function normalizeHeader(value) { return clean(value).toLowerCase().replace(/[\s_-]+/g, ""); }
function parseWorkbook(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error("The uploaded workbook has no worksheet.");
  const raw = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
  if (!raw.length) throw new Error("The first worksheet has no student records.");
  return raw;
}
function validateRows(rawRows, db) {
  const departmentByCode = new Map(db.departments.map(d => [String(d.code).toUpperCase(), d]));
  const departmentByName = new Map(db.departments.map(d => [String(d.name).toLowerCase(), d]));
  const seen = new Set();
  const valid = [];
  const errors = [];
  rawRows.forEach((raw, index) => {
    const row = {};
    Object.entries(raw).forEach(([key, value]) => { row[normalizeHeader(key)] = value; });
    const prn = clean(row.prn).toUpperCase();
    const name = clean(row.studentname || row.name);
    const deptCode = clean(row.deptcode).toUpperCase();
    const deptName = clean(row.department);
    const dept = departmentByCode.get(deptCode) || departmentByName.get(deptName.toLowerCase());
    const error = [];
    if (!prn) error.push("Missing PRN");
    else if (seen.has(prn)) error.push("Duplicate PRN in uploaded file");
    if (!name || name.length > 150) error.push("Missing or invalid student name");
    if (!dept) error.push("Unknown or missing department");
    if (prn) seen.add(prn);
    const record = {
      prn, name, department: dept ? dept.code : "",
      rollNo: clean(row.rollno),
      admissionNo: clean(row.admno || row.admissionno),
      mobile: clean(row.mobile),
      email: clean(row.email).toLowerCase(),
      cgpa: clean(row.cgpa) === "" ? null : Number(row.cgpa)
    };
    if (record.cgpa !== null && (!Number.isFinite(record.cgpa) || record.cgpa < 0 || record.cgpa > 10)) error.push("CGPA must be between 0 and 10");
    if (record.email && (record.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email))) error.push("Invalid email");
    if (error.length) errors.push({ row: index + 2, prn: prn || "—", errors: error.join("; ") });
    else valid.push({ ...record, sourceRow: index + 2, existing: db.students.some(s => s.prn === prn) });
  });
  return { valid, errors };
}
function studentExportRows(db) {
  return db.students.map(student => {
    const preferences = db.preferences.filter(p => p.prn === student.prn).sort((a,b) => a.rank-b.rank);
    const allotment = db.allotments.find(a => a.prn === student.prn);
    const course = allotment && db.courses.find(c => c.id === allotment.courseId);
    const courseName = course ? course.name : "";
    const choice = rank => {
      const pref = preferences.find(p => p.rank === rank);
      return pref ? (db.courses.find(c => c.id === pref.courseId) || {}).name || pref.courseId : "";
    };
    return {
      PRN: student.prn, Roll_No: student.rollNo || "", Adm_No: student.admissionNo || "",
      Student_Name: student.name,
      Department: (db.departments.find(d => d.code === student.department) || {}).name || student.department,
      Dept_Code: student.department, Mobile: student.mobile || "", Email: student.email || "",
      CGPA: student.cgpa ?? "", Semester: student.semester ?? db.meta.semester,
      Academic_Year: student.academicYear || db.meta.academicYear,
      Account_Status: student.accountStatus,
      Profile_Status: student.profileCompleted ? "COMPLETED" : "INCOMPLETE",
      Choice_1: choice(1), Choice_2: choice(2), Choice_3: choice(3),
      Allocated_Course: courseName, Allocation_Status: allotment ? allotment.status : "NOT_ALLOCATED"
    };
  });
}
router.use(requireAdmin, ensureCsrf);
router.get("/", (req, res) => {
  const db = readDb();
  const preview = req.session.studentImportPreview || null;
  res.render("admin-student-data", {
    title: "Student Data Import & Export", departments: db.departments,
    stats: { total: db.students.length, departments: db.departments.length, pending: db.students.filter(s => s.accountStatus === "PENDING").length },
    preview, error: req.session.studentImportError || null
  });
  delete req.session.studentImportError;
});
router.post("/preview", upload.single("studentFile"), verifyCsrf, (req, res) => {
  try {
    if (!req.file) throw new Error("Choose an Excel or CSV file first.");
    const db = readDb();
    const rawRows = parseWorkbook(req.file.buffer);
    if (rawRows.length > 10000) throw new Error("A maximum of 10,000 student rows can be imported at once.");
    const result = validateRows(rawRows, db);
    req.session.studentImportPreview = { fileName: req.file.originalname, total: rawRows.length, valid: result.valid, errors: result.errors, createdAt: new Date().toISOString() };
    res.redirect("/admin/student-data");
  } catch (error) {
    req.session.studentImportError = error.message || "Unable to read the uploaded file.";
    res.redirect("/admin/student-data");
  }
});
router.post("/confirm", express.urlencoded({ extended: false }), verifyCsrf, (req, res) => {
  const preview = req.session.studentImportPreview;
  if (!preview || !Array.isArray(preview.valid)) {
    req.session.studentImportError = "Your import preview expired. Upload the file again.";
    return res.redirect("/admin/student-data");
  }
  const db = readDb();
  let inserted = 0;
  let updated = 0;
  preview.valid.forEach(record => {
    const existing = db.students.find(s => s.prn === record.prn);
    if (existing) {
      Object.assign(existing, {
        name: record.name, department: record.department,
        ...(record.rollNo ? { rollNo: record.rollNo } : {}),
        ...(record.admissionNo ? { admissionNo: record.admissionNo } : {}),
        ...(record.mobile ? { mobile: record.mobile } : {}),
        ...(record.email ? { email: record.email } : {}),
        ...(record.cgpa !== null ? { cgpa: record.cgpa } : {})
      });
      updated++;
    } else {
      db.students.push({
        prn: record.prn, name: record.name, department: record.department,
        rollNo: record.rollNo || "", admissionNo: record.admissionNo || "",
        mobile: record.mobile || "", email: record.email || "", cgpa: record.cgpa,
        semester: db.meta.semester, passwordHash: null, accountStatus: "NOT_REGISTERED",
        profileCompleted: false, createdAt: null
      });
      inserted++;
    }
  });
  audit(db, req.session.user.username, "STUDENT_ROSTER_IMPORTED",
    inserted + " new students added; " + updated + " existing student records updated; " + preview.errors.length + " invalid rows skipped");
  writeDb(db);
  delete req.session.studentImportPreview;
  req.session.flash = { type: "success", message: "Import completed: " + inserted + " new students added, " + updated + " existing records updated, " + preview.errors.length + " invalid rows skipped." };
  res.redirect("/admin/students");
});
router.post("/cancel", express.urlencoded({ extended: false }), verifyCsrf, (req, res) => {
  delete req.session.studentImportPreview;
  res.redirect("/admin/student-data");
});
router.get("/export", (req, res) => {
  const db = readDb();
  const dept = clean(req.query.department).toUpperCase();
  const status = clean(req.query.status).toUpperCase();
  const rows = studentExportRows(db).filter(row => (!dept || row.Dept_Code === dept) && (!status || row.Account_Status === status));
  const format = clean(req.query.format).toLowerCase() === "csv" ? "csv" : "xlsx";
  const stamp = new Date().toISOString().slice(0,10);
  if (format === "csv") {
    const headers = Object.keys(rows[0] || { PRN: "", Student_Name: "", Dept_Code: "" });
    const quote = value => '"' + safeCell(value).replace(/"/g, '""') + '"';
    const csv = [headers.map(quote).join(","), ...rows.map(row => headers.map(key => quote(row[key])).join(","))].join("\r\n");
    res.type("text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="open-elective-students-' + stamp + '.csv"');
    return res.send("\uFEFF" + csv);
  }
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Students");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", 'attachment; filename="open-elective-students-' + stamp + '.xlsx"');
  res.send(buffer);
});
module.exports = router;
