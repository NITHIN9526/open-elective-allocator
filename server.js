const express = require("express");
const session = require("express-session");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");
const bcrypt = require("bcryptjs");
const config = require("./src/config");
const { readDb, writeDb, seedDatabase, audit } = require("./src/store");
const { requireAuth, requireStudent, requireAdmin, csrf } = require("./src/middleware");

seedDatabase(false);
const app = express();
const PORT = Number(process.env.PORT || 3000);
const SESSION_SECRET = process.env.SESSION_SECRET || "";
const IS_PRODUCTION = process.env.NODE_ENV === "production";

if (IS_PRODUCTION && SESSION_SECRET.length < 32) {
  throw new Error("Production startup blocked: set SESSION_SECRET to a random value of at least 32 characters.");
}

app.set("trust proxy", IS_PRODUCTION ? 1 : false);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.urlencoded({ extended: true, limit: "20kb", parameterLimit: 200 }));
app.use(express.static(path.join(__dirname, "public")));
app.use(session({
  name: "open_elective_sid",
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", secure: IS_PRODUCTION, maxAge: config.sessionMaxAgeMs }
}));
app.use(csrf);
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  res.locals.config = config;
  res.locals.currentPath = req.path;
  next();
});

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });
function flash(req, type, message) { req.session.flash = { type, message }; }
function currentStudent(db, req) { return db.students.find(s => s.prn === req.session.user.prn); }

function requireCompletedProfile(req, res, next) {
  const db = readDb();
  const student = currentStudent(db, req);

  if (!student) {
    return res.status(404).render("error", {
      title: "Student not found",
      message: "Your student record could not be found. Please contact the administrator."
    });
  }

  if (student.accountStatus !== "ACTIVE") {
    return res.redirect("/student/login");
  }

  if (student.profileCompleted !== true) {
    return res.redirect("/student/profile");
  }

  next();
}

app.get("/", (req, res) => res.redirect(req.session.user ? (req.session.user.role === "STUDENT" ? "/student" : "/admin") : "/login"));

app.get("/login", (req, res) => {
  if (req.session.user) return res.redirect(req.session.user.role === "STUDENT" ? "/student" : "/admin");
  const db = readDb();
  res.render("landing", { title: "Open Elective Portal", stats: { departments: db.departments.length, courses: db.courses.length, students: db.students.length } });
});

function authenticateAccount(req, res, next, accountType) {
  const isStudentLogin = accountType === "student";
  const identifier = String(isStudentLogin ? req.body.prn || "" : req.body.username || "").trim();
  const normalizedId = isStudentLogin ? identifier.toUpperCase() : identifier.toLowerCase();
  const password = String(req.body.password || "");
  const view = isStudentLogin ? "student-login" : "admin-login";
  const title = isStudentLogin ? "Student login" : "Admin login";

  if (!normalizedId || !password) {
    return res.status(400).render(view, { title, error: "Enter your username and password." });
  }

  const db = readDb();
  const student = isStudentLogin
    ? db.students.find(item => item.prn === normalizedId && item.passwordHash)
    : null;
  const admin = !isStudentLogin
    ? db.admins.find(item => item.username.toLowerCase() === normalizedId && item.active)
    : null;
  const account = student || admin;

  (async () => {
    if (!account || !account.passwordHash || !(await bcrypt.compare(password, account.passwordHash))) {
      audit(db, normalizedId, "LOGIN_FAILED", "Invalid " + accountType + " credentials");
      writeDb(db);
      return res.status(401).render(view, {
        title,
        error: isStudentLogin ? "Invalid PRN or password." : "Invalid administrator username or password."
      });
    }

    if (isStudentLogin && student.accountStatus !== "ACTIVE") {
      const message = student.accountStatus === "PENDING"
        ? "Your account is awaiting administrator approval."
        : "Your student account is not active.";
      return res.status(403).render(view, { title, error: message });
    }

    audit(db, isStudentLogin ? student.prn : admin.username, "LOGIN_SUCCESS", "Signed in through " + accountType + " login");
    writeDb(db);

    req.session.regenerate(err => {
      if (err) return next(err);
      req.session.user = isStudentLogin
        ? { role: "STUDENT", prn: student.prn, name: student.name }
        : { role: admin.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "ADMIN", username: admin.username, name: admin.name };
      req.session.save(saveErr => {
        if (saveErr) return next(saveErr);
        res.redirect(isStudentLogin ? (student.profileCompleted === true ? "/student" : "/student/profile") : "/admin");
      });
    });
  })().catch(next);
}

app.get("/student/login", (req, res) => res.render("student-login", { title: "Student login", error: null }));
app.post("/student/login", loginLimiter, (req, res, next) => authenticateAccount(req, res, next, "student"));

app.get("/admin/login", (req, res) => res.render("admin-login", { title: "Admin login", error: null }));
app.post("/admin/login", loginLimiter, (req, res, next) => authenticateAccount(req, res, next, "admin"));

// Do not accept credentials at the generic login URL; it is only the role-selection page.
app.post("/login", (req, res) => res.redirect(303, "/login"));

app.get("/register", (req, res) => res.render("register", { title: "Student registration", error: null }));
app.post("/register", loginLimiter, async (req, res) => {
  const prn = String(req.body.prn || "").trim().toUpperCase();
  const password = String(req.body.password || "");
  const confirm = String(req.body.confirmPassword || "");
  if (!prn || password.length < 10 || password.length > 72 || password !== confirm) {
    return res.status(400).render("register", { title: "Student registration", error: "Enter a valid PRN. Password must be 10–72 characters and both password fields must match." });
  }
  const db = readDb();
  const student = db.students.find(s => s.prn === prn);
  if (!student) return res.status(404).render("register", { title: "Student registration", error: "This PRN is not present in the demo roster." });
  if (student.accountStatus !== "NOT_REGISTERED") return res.status(409).render("register", { title: "Student registration", error: "This PRN has already registered or is not eligible to register." });
  student.passwordHash = await bcrypt.hash(password, 12);
  student.accountStatus = "PENDING";
  student.createdAt = new Date().toISOString();
  audit(db, prn, "STUDENT_REGISTERED", "Account created; awaiting admin approval");
  writeDb(db);
  res.render("registration-success", { title: "Registration submitted", prn });
});

app.post("/logout", requireAuth, (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

app.get("/admin/change-password", requireAdmin, (req, res) => {
  res.render("admin-change-password", {
    title: "Change Password",
    error: null
  });
});

app.post("/admin/change-password", requireAdmin, loginLimiter, async (req, res, next) => {
  try {
    const currentPassword = String(req.body.currentPassword || "");
    const newPassword = String(req.body.newPassword || "");
    const confirmPassword = String(req.body.confirmPassword || "");
    const db = readDb();
    const username = String(req.session.user.username || "");
    const admin = db.admins.find(item =>
      item.active && item.username.toLowerCase() === username.toLowerCase()
    );

    if (!admin || !admin.passwordHash) {
      return res.status(404).render("error", {
        title: "Administrator not found",
        message: "Your administrator account could not be found. Please contact the system administrator."
      });
    }

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).render("admin-change-password", {
        title: "Change Password",
        error: "Complete all password fields."
      });
    }

    if (!(await bcrypt.compare(currentPassword, admin.passwordHash))) {
      return res.status(400).render("admin-change-password", {
        title: "Change Password",
        error: "Your current password is incorrect."
      });
    }

    if (newPassword.length < 10 || newPassword.length > 72) {
      return res.status(400).render("admin-change-password", {
        title: "Change Password",
        error: "The new password must be between 10 and 72 characters."
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).render("admin-change-password", {
        title: "Change Password",
        error: "The new password and confirmation do not match."
      });
    }

    if (newPassword === currentPassword) {
      return res.status(400).render("admin-change-password", {
        title: "Change Password",
        error: "Choose a new password different from your current password."
      });
    }

    admin.passwordHash = await bcrypt.hash(newPassword, 12);
    audit(db, username, "ADMIN_PASSWORD_CHANGED", "Administrator changed their own password");
    writeDb(db);

    flash(req, "success", "Your administrator password has been changed successfully.");
    res.redirect("/admin/change-password");
  } catch (err) {
    next(err);
  }
});

app.get("/student/profile", requireStudent, (req, res) => {
  const db = readDb();
  const student = currentStudent(db, req);

  if (!student || student.accountStatus !== "ACTIVE") {
    return res.status(403).render("error", {
      title: "Access denied",
      message: "An approved student account is required."
    });
  }

  res.render("student-profile", {
    title: "Student Profile",
    student,
    pendingRequest: (db.profileRequests || []).find(r => r.prn === student.prn && r.status === "PENDING") || null,
    formData: student.profileCompleted ? {
      mobile: student.mobile || "",
      email: student.email || "",
      cgpa: student.cgpa ?? "",
      semester: student.semester ?? "",
      academicYear: student.academicYear || ""
    } : {},
    error: null
  });
});

app.post("/student/profile", requireStudent, loginLimiter, async (req, res) => {
  const db = readDb();
  const student = currentStudent(db, req);

  if (!student || student.accountStatus !== "ACTIVE") {
    return res.status(403).render("error", { title: "Access denied", message: "Only approved students can complete their profiles." });
  }
  if (student.profileCompleted === true) {
    flash(req, "error", "Your profile is locked after submission. Send an update request to the administrator.");
    return res.redirect("/student/profile");
  }

  const mobile = String(req.body.mobile || "").replace(/[\s-]/g, "");
  const email = String(req.body.email || "").trim().toLowerCase();
  const cgpaInput = String(req.body.cgpa || "").trim();
  const semesterInput = String(req.body.semester || "").trim();
  const academicYear = String(req.body.academicYear || "").trim();
  const cgpa = Number(cgpaInput);
  const semester = Number(semesterInput);
  const formData = { mobile, email, cgpa: cgpaInput, semester: semesterInput, academicYear };

  let error = null;
  if (!/^(?:\+91)?[6-9]\d{9}$/.test(mobile)) {
    error = "Enter a valid 10-digit Indian mobile number, optionally with +91.";
  } else if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    error = "Enter a valid email address.";
  } else if (cgpaInput === "" || !Number.isFinite(cgpa) || cgpa < 0 || cgpa > 10 ||
      !/^\d{1,2}(\.\d{1,2})?$/.test(cgpaInput)) {
    error = "Enter a valid CGPA between 0 and 10, with up to two decimal places.";
  } else if (!/^[1-6]$/.test(semesterInput)) {
    error = "Enter a valid semester between 1 and 6.";
  } else if (!/^\d{4}-\d{2}$/.test(academicYear) ||
      Number(academicYear.slice(5)) !== (Number(academicYear.slice(0, 4)) + 1) % 100) {
    error = "Enter the academic year in YYYY-YY format, for example 2026-27.";
  }

  if (error) {
    return res.status(400).render("student-profile", {
      title: "Complete Student Profile", student, formData, error
    });
  }

  Object.assign(student, {
    mobile, email, cgpa, semester, academicYear,
    profileCompleted: true,
    profileUpdatedAt: new Date().toISOString()
  });

  audit(db, student.prn, "STUDENT_PROFILE_COMPLETED",
    "Student profile saved in the portal database.");
  writeDb(db);

  flash(req, "success", "Your profile has been saved successfully.");
  return res.redirect("/student");
});

app.post("/student/profile/request", requireStudent, requireCompletedProfile, loginLimiter, (req, res) => {
  const db = readDb();
  const student = currentStudent(db, req);
  const details = String(req.body.details || "").trim();
  if (!details || details.length < 10 || details.length > 1000) {
    flash(req, "error", "Explain the correction needed (10–1000 characters).");
    return res.redirect("/student/profile");
  }
  db.profileRequests ||= [];
  const existing = db.profileRequests.find(r => r.prn === student.prn && r.status === "PENDING");
  if (existing) {
    flash(req, "error", "You already have a pending profile update request.");
    return res.redirect("/student/profile");
  }
  const request = {
    id: db.counters.profileRequest = (db.counters.profileRequest || 1),
    prn: student.prn,
    studentName: student.name,
    details,
    status: "PENDING",
    requestedAt: new Date().toISOString(),
    reviewedAt: null,
    reviewedBy: null,
    decisionNote: ""
  };
  db.counters.profileRequest = request.id + 1;
  db.profileRequests.push(request);
  audit(db, student.prn, "PROFILE_UPDATE_REQUESTED", details);
  writeDb(db);
  flash(req, "success", "Your update request has been sent to the administrator.");
  res.redirect("/student/profile");
});

app.get("/student", requireStudent, requireCompletedProfile, (req, res) => {
  const db = readDb();
  const student = currentStudent(db, req);
  const prefs = db.preferences.filter(p => p.prn === student.prn).sort((a,b) => a.rank - b.rank);
  const allotment = db.allotments.find(a => a.prn === student.prn) || null;
  res.render("student-dashboard", { title: "Student dashboard", student, courses: db.courses, preferences: prefs, allotment, preferencesOpen: db.meta.preferencesOpen });
});

app.post("/student/preferences", requireStudent, requireCompletedProfile, (req, res) => {
  const db = readDb();
  if (!db.meta.preferencesOpen) { flash(req, "error", "Preference submission is currently closed."); return res.redirect("/student"); }
  const student = currentStudent(db, req);
  const submittedRanks = req.body.ranks && typeof req.body.ranks === "object" ? req.body.ranks : {};
  const selected = Object.entries(submittedRanks)
    .filter(([courseId, rank]) => String(rank).trim() !== "")
    .map(([courseId, rank]) => ({ courseId, rank: Number(rank) }));
  const ids = selected.map(item => item.courseId);
  const ranks = selected.map(item => item.rank);
  const valid = selected.length >= 1 &&
    selected.length <= config.maxPreferences &&
    new Set(ids).size === ids.length &&
    ids.every(id => db.courses.some(c => c.id === id)) &&
    ranks.every(rank => Number.isInteger(rank) && rank >= 1 && rank <= config.maxPreferences) &&
    new Set(ranks).size === ranks.length;
  if (!valid) {
    flash(req, "error", `Assign a unique priority from 1 to ${config.maxPreferences} to each selected course. Leave unselected courses blank.`);
    return res.redirect("/student");
  }
  // Current demo policy: students may select any listed course, including their own department's course.
  db.preferences = db.preferences.filter(p => p.prn !== student.prn);
  selected.sort((a, b) => a.rank - b.rank).forEach(item => db.preferences.push({
    id: db.counters.preference++, prn: student.prn, courseId: item.courseId, rank: item.rank, submittedAt: new Date().toISOString()
  }));
  audit(db, student.prn, "PREFERENCES_SAVED", `${selected.length} preferences saved`);
  writeDb(db);
  flash(req, "success", "Your course preferences have been saved.");
  res.redirect("/student");
});

app.get("/admin", requireAdmin, (req, res) => {
  const db = readDb();
  const pending = db.students.filter(s => s.accountStatus === "PENDING");
  const active = db.students.filter(s => s.accountStatus === "ACTIVE");
  const registered = db.students.filter(s => s.accountStatus !== "NOT_REGISTERED");
  const studentsWithPrefs = new Set(db.preferences.map(p => p.prn)).size;
  const allottedCount = db.allotments.filter(a => a.status === "PROPOSED" || a.status === "APPROVED").length;

  const stats = {
    totalStudents: db.students.length,
    registered: registered.length,
    pending: pending.length,
    active: active.length,
    totalPreferences: db.preferences.length,
    studentsWithPrefs,
    allotted: allottedCount,
    unallocated: db.allotments.filter(a => a.status === "UNALLOCATED").length,
    totalCourses: db.courses.length,
    totalCapacity: db.courses.reduce((sum, c) => sum + c.capacity, 0)
  };

  const deptStats = db.departments.map(dept => {
    const ds = db.students.filter(s => s.department === dept.code);
    return {
      code: dept.code, name: dept.name, total: ds.length,
      active: ds.filter(s => s.accountStatus === "ACTIVE").length,
      pending: ds.filter(s => s.accountStatus === "PENDING").length,
      prefsSubmitted: ds.filter(s => db.preferences.some(p => p.prn === s.prn)).length
    };
  });

  const courseStats = db.courses.map(course => {
    const prefs = db.preferences.filter(p => p.courseId === course.id);
    const seated = db.allotments.filter(a => a.courseId === course.id && ["PROPOSED","APPROVED"].includes(a.status)).length;
    return {
      id: course.id, name: course.name, offeredBy: course.offeredBy,
      capacity: course.capacity, totalPrefs: prefs.length,
      firstChoice: prefs.filter(p => p.rank === 1).length,
      seated, utilization: course.capacity > 0 ? Math.round((seated / course.capacity) * 100) : 0
    };
  });

  const recentAudit = db.audit.slice(0, 10);
  res.render("admin-dashboard", { title: "Admin dashboard", db, pending, stats, deptStats, courseStats, recentAudit });
});

app.get("/admin/registration-requests", requireAdmin, (req, res) => {
  const db = readDb();
  const pendingRegistrations = db.students
    .filter(student => student.accountStatus === "PENDING")
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  const reviewedRegistrations = db.students
    .filter(student => ["ACTIVE", "REJECTED"].includes(student.accountStatus) && student.createdAt)
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 50);
  res.render("admin-registration-requests", {
    title: "Student Registration Approvals",
    pendingRegistrations,
    reviewedRegistrations
  });
});

app.post("/admin/students/approve-selected", requireAdmin, (req, res) => {
  const db = readDb();
  const submitted = req.body.prns;
  const selectedPrns = [...new Set((Array.isArray(submitted) ? submitted : submitted ? [submitted] : [])
    .map(value => String(value).trim()).filter(Boolean))];

  if (!selectedPrns.length) {
    flash(req, "error", "Select at least one pending student to approve.");
    return res.redirect("/admin/registration-requests");
  }

  const selectedSet = new Set(selectedPrns);
  const pendingStudents = db.students.filter(student =>
    selectedSet.has(student.prn) && student.accountStatus === "PENDING"
  );

  if (!pendingStudents.length) {
    flash(req, "error", "No selected students are currently pending approval.");
    return res.redirect("/admin/registration-requests");
  }

  pendingStudents.forEach(student => {
    student.accountStatus = "ACTIVE";
    audit(db, req.session.user.username, "STUDENT_APPROVED", student.prn);
  });
  writeDb(db);
  flash(req, "success", pendingStudents.length + " student registration(s) approved.");
  res.redirect("/admin/registration-requests");
});

app.post("/admin/students/approve-all", requireAdmin, (req, res) => {
  const db = readDb();
  const pendingStudents = db.students.filter(student => student.accountStatus === "PENDING");

  if (!pendingStudents.length) {
    flash(req, "error", "There are no pending student registrations to approve.");
    return res.redirect("/admin/registration-requests");
  }

  pendingStudents.forEach(student => {
    student.accountStatus = "ACTIVE";
    audit(db, req.session.user.username, "STUDENT_APPROVED", student.prn);
  });
  writeDb(db);
  flash(req, "success", "All " + pendingStudents.length + " pending student registration(s) approved.");
  res.redirect("/admin/registration-requests");
});

app.post("/admin/students/:prn/approve", requireAdmin, (req, res) => {
  const db = readDb();
  const student = db.students.find(s => s.prn === req.params.prn);
  if (!student || student.accountStatus !== "PENDING") { flash(req, "error", "Student not found or not pending."); return res.redirect("/admin"); }
  student.accountStatus = "ACTIVE";
  audit(db, req.session.user.username, "STUDENT_APPROVED", student.prn);
  writeDb(db);
  flash(req, "success", `${student.prn} approved.`);
  res.redirect("/admin");
});

app.post("/admin/students/:prn/reject", requireAdmin, (req, res) => {
  const db = readDb();
  const student = db.students.find(s => s.prn === req.params.prn);
  if (!student || student.accountStatus !== "PENDING") { flash(req, "error", "Student not found or not pending."); return res.redirect("/admin"); }
  student.accountStatus = "REJECTED";
  student.passwordHash = null;
  audit(db, req.session.user.username, "STUDENT_REJECTED", student.prn);
  writeDb(db);
  flash(req, "success", `${student.prn} rejected.`);
  res.redirect("/admin");
});

app.get("/admin/students", requireAdmin, (req, res) => {
  const db = readDb();
  res.render("admin-students", { title: "Student management", students: db.students });
});

app.get("/admin/profile-requests", requireAdmin, (req, res) => {
  const db = readDb();
  const requests = (db.profileRequests || []).slice().sort((a,b) => new Date(b.requestedAt) - new Date(a.requestedAt));
  res.render("admin-profile-requests", { title: "Profile Update Requests", requests });
});

app.post("/admin/profile-requests/:id/:decision", requireAdmin, (req, res) => {
  const db = readDb();
  const request = (db.profileRequests || []).find(r => String(r.id) === String(req.params.id));
  if (!request || request.status !== "PENDING" || !["approve", "reject"].includes(req.params.decision)) {
    flash(req, "error", "Request not found or already reviewed.");
    return res.redirect("/admin/profile-requests");
  }
  request.status = req.params.decision === "approve" ? "APPROVED" : "REJECTED";
  request.reviewedAt = new Date().toISOString();
  request.reviewedBy = req.session.user.username;
  request.decisionNote = String(req.body.note || "").trim().slice(0, 500);
  audit(db, req.session.user.username, "PROFILE_UPDATE_REQUEST_" + request.status, request.prn + ": " + request.details);
  writeDb(db);
  flash(req, "success", "Profile update request " + request.status.toLowerCase() + ". " + (request.status === "APPROVED" ? "Now edit the student's record from Student Management." : ""));
  res.redirect("/admin/profile-requests");
});

app.get("/admin/students/:prn/edit", requireAdmin, (req, res) => {
  const db = readDb();
  const student = db.students.find(s => s.prn === req.params.prn);
  if (!student) { flash(req, "error", "Student not found."); return res.redirect("/admin/students"); }
  res.render("admin-student-edit", { title: "Edit Student", student, departments: db.departments, error: null });
});

app.post("/admin/students/:prn/edit", requireAdmin, loginLimiter, async (req, res) => {
  const db = readDb();
  const student = db.students.find(s => s.prn === req.params.prn);
  if (!student) { flash(req, "error", "Student not found."); return res.redirect("/admin/students"); }
  const mobile = String(req.body.mobile || "").replace(/[\s-]/g, "");
  const email = String(req.body.email || "").trim().toLowerCase();
  const cgpaInput = String(req.body.cgpa || "").trim();
  const semesterInput = String(req.body.semester || "").trim();
  const academicYear = String(req.body.academicYear || "").trim();
  const name = String(req.body.name || "").trim();
  const department = String(req.body.department || "").trim().toUpperCase();
  const cgpa = Number(cgpaInput), semester = Number(semesterInput);
  let error = null;
  if (!name || name.length > 120) error = "Enter a valid student name.";
  else if (!db.departments.some(d => d.code === department)) error = "Select a valid department.";
  else if (!/^(?:\+91)?[6-9]\d{9}$/.test(mobile)) error = "Enter a valid Indian mobile number.";
  else if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) error = "Enter a valid email address.";
  else if (!Number.isFinite(cgpa) || cgpa < 0 || cgpa > 10) error = "CGPA must be between 0 and 10.";
  else if (!/^[1-6]$/.test(semesterInput)) error = "Semester must be between 1 and 6.";
  else if (!/^\d{4}-\d{2}$/.test(academicYear) || Number(academicYear.slice(5)) !== (Number(academicYear.slice(0,4))+1)%100) error = "Use academic year format YYYY-YY.";
  if (error) return res.status(400).render("admin-student-edit", { title: "Edit Student", student: { ...student, name, department, mobile, email, cgpa: cgpaInput, semester: semesterInput, academicYear }, departments: db.departments, error });
  Object.assign(student, {
    name, department, mobile, email, cgpa, semester, academicYear,
    profileCompleted: true,
    profileUpdatedAt: new Date().toISOString()
  });
  audit(db, req.session.user.username, "ADMIN_STUDENT_PROFILE_EDITED", student.prn + " profile updated");
  writeDb(db);
  flash(req, "success", "Student record updated successfully.");
  res.redirect("/admin/students");
});

app.get("/admin/courses", requireAdmin, (req, res) => {
  const db = readDb();
  const rows = db.courses.map(course => {
    const courseAllotments = db.allotments.filter(a => a.courseId === course.id);
    const used = courseAllotments.filter(a => ["PROPOSED","APPROVED"].includes(a.status)).length;
    const preferenceCount = db.preferences.filter(p => p.courseId === course.id).length;
    return {
      ...course, used, remaining: course.capacity - used,
      preferenceCount, allotmentCount: courseAllotments.length
    };
  });
  res.render("admin-courses", {
    title: "Course management",
    courses: rows,
    departments: db.departments
  });
});

app.post("/admin/courses", requireAdmin, (req, res) => {
  const db = readDb();
  const id = String(req.body.id || "").trim().toUpperCase();
  const name = String(req.body.name || "").trim();
  const offeredBy = String(req.body.offeredBy || "").trim().toUpperCase();
  const description = String(req.body.description || "").trim();
  const capacity = Number(req.body.capacity);
  if (!/^[A-Z0-9][A-Z0-9_-]{2,39}$/.test(id) || db.courses.some(c => c.id === id)) {
    flash(req, "error", "Enter a unique course code (3–40 letters, numbers, hyphens or underscores).");
    return res.redirect("/admin/courses");
  }
  if (!name || name.length > 120 || !db.departments.some(d => d.code === offeredBy) ||
      !Number.isInteger(capacity) || capacity < 1 || capacity > 500 || description.length > 500) {
    flash(req, "error", "Check the course name, department, capacity (1–500) and description (maximum 500 characters).");
    return res.redirect("/admin/courses");
  }
  db.courses.push({ id, name, offeredBy, capacity, description });
  audit(db, req.session.user.username, "COURSE_CREATED", id + ": " + name + " (" + offeredBy + ")");
  writeDb(db);
  flash(req, "success", "Course added successfully.");
  res.redirect("/admin/courses");
});

app.post("/admin/courses/:id/edit", requireAdmin, (req, res) => {
  const db = readDb();
  const course = db.courses.find(c => c.id === req.params.id);
  if (!course) { flash(req, "error", "Course not found."); return res.redirect("/admin/courses"); }
  const name = String(req.body.name || "").trim();
  const offeredBy = String(req.body.offeredBy || "").trim().toUpperCase();
  const description = String(req.body.description || "").trim();
  const capacity = Number(req.body.capacity);
  const used = db.allotments.filter(a => a.courseId === course.id && ["PROPOSED", "APPROVED"].includes(a.status)).length;
  if (!name || name.length > 120 || !db.departments.some(d => d.code === offeredBy) ||
      !Number.isInteger(capacity) || capacity < used || capacity > 500 || capacity < 1 || description.length > 500) {
    flash(req, "error", "Check the course name, department, capacity (1–500 and not below current allotments) and description (maximum 500 characters).");
    return res.redirect("/admin/courses");
  }
  const previous = course.name + " (" + course.offeredBy + ")";
  Object.assign(course, { name, offeredBy, capacity, description });
  audit(db, req.session.user.username, "COURSE_UPDATED", course.id + ": " + previous + " -> " + name + " (" + offeredBy + ")");
  writeDb(db);
  flash(req, "success", "Course details updated.");
  res.redirect("/admin/courses");
});

app.post("/admin/courses/:id/delete", requireAdmin, (req, res) => {
  const db = readDb();
  const course = db.courses.find(c => c.id === req.params.id);
  if (!course) { flash(req, "error", "Course not found."); return res.redirect("/admin/courses"); }
  const preferenceCount = db.preferences.filter(p => p.courseId === course.id).length;
  const allotmentCount = db.allotments.filter(a => a.courseId === course.id).length;
  if (preferenceCount || allotmentCount) {
    flash(req, "error", "This course cannot be removed because student preferences or allotment records refer to it. Keep it, or resolve those records first.");
    return res.redirect("/admin/courses");
  }
  db.courses = db.courses.filter(c => c.id !== course.id);
  audit(db, req.session.user.username, "COURSE_DELETED", course.id + ": " + course.name);
  writeDb(db);
  flash(req, "success", "Course removed successfully.");
  res.redirect("/admin/courses");
});

app.post("/admin/courses/:id/capacity", requireAdmin, (req, res) => {
  const db = readDb();
  const course = db.courses.find(c => c.id === req.params.id);
  const capacity = Number(req.body.capacity);
  if (!course || !Number.isInteger(capacity) || capacity < 1 || capacity > 500) { flash(req, "error", "Enter a valid capacity from 1 to 500."); return res.redirect("/admin/courses"); }
  const currentlyAssigned = db.allotments.filter(a => a.courseId === course.id && ["PROPOSED", "APPROVED"].includes(a.status)).length;
  if (capacity < currentlyAssigned) {
    flash(req, "error", `Capacity cannot be lower than the ${currentlyAssigned} currently proposed or approved allotments.`);
    return res.redirect("/admin/courses");
  }
  course.capacity = capacity;
  audit(db, req.session.user.username, "COURSE_CAPACITY_CHANGED", `${course.id}: ${capacity}`);
  writeDb(db);
  flash(req, "success", "Course capacity updated.");
  res.redirect("/admin/courses");
});

app.get("/admin/preferences", requireAdmin, (req, res) => {
  const db = readDb();
  const rows = db.students.map(s => ({
    student: s,
    preferences: db.preferences.filter(p => p.prn === s.prn).sort((a,b) => a.rank-b.rank).map(p => ({ ...p, course: db.courses.find(c => c.id === p.courseId) }))
  })).filter(x => x.preferences.length);
  res.render("admin-preferences", { title: "Student preferences", rows });
});

app.post("/admin/preferences/toggle", requireAdmin, (req, res) => {
  const db = readDb();
  db.meta.preferencesOpen = !db.meta.preferencesOpen;
  audit(db, req.session.user.username, "PREFERENCE_WINDOW_TOGGLED", String(db.meta.preferencesOpen));
  writeDb(db);
  flash(req, "success", `Preference submission ${db.meta.preferencesOpen ? "opened" : "closed"}.`);
  res.redirect("/admin");
});

app.post("/admin/allocation/run", requireAdmin, (req, res) => {
  const db = readDb();
  if (db.meta.preferencesOpen) { flash(req, "error", "Close preference submission before running allocation."); return res.redirect("/admin"); }
  db.allotments = [];
  const preferenceMap = new Map();
  db.preferences.forEach(p => {
    if (!preferenceMap.has(p.prn)) preferenceMap.set(p.prn, []);
    preferenceMap.get(p.prn).push(p);
  });
  // Allocation priority: CGPA > 8.00 students are processed first.
  // Within each group, higher CGPA wins; identical CGPA is resolved by PRN ascending.
  const eligible = db.students
    .filter(s => s.accountStatus === "ACTIVE" && preferenceMap.has(s.prn))
    .sort((a, b) => {
      const aCgpa = Number(a.cgpa) || 0;
      const bCgpa = Number(b.cgpa) || 0;
      const aPriorityGroup = aCgpa > 8 ? 0 : 1;
      const bPriorityGroup = bCgpa > 8 ? 0 : 1;
      return aPriorityGroup - bPriorityGroup ||
        bCgpa - aCgpa ||
        String(a.prn).localeCompare(String(b.prn));
    });
  const counts = Object.fromEntries(db.courses.map(c => [c.id, 0]));
  const ties = [];
  for (let i = 1; i < eligible.length; i++) {
    if (Number(eligible[i].cgpa) === Number(eligible[i-1].cgpa)) {
      ties.push({ cgpa: Number(eligible[i].cgpa), prns: [eligible[i-1].prn, eligible[i].prn] });
    }
  }
  eligible.forEach(student => {
    const prefs = preferenceMap.get(student.prn).sort((a,b) => a.rank-b.rank);
    const chosen = prefs.find(p => {
      const course = db.courses.find(c => c.id === p.courseId);
      return course && counts[course.id] < course.capacity;
    });
    if (chosen) {
      counts[chosen.courseId]++;
      db.allotments.push({
        prn: student.prn, courseId: chosen.courseId, cgpa: student.cgpa,
        preferenceRank: chosen.rank, status: "PROPOSED", tieFlag: ties.some(t => t.prns.includes(student.prn)),
        reviewedBy: null, reviewedAt: null
      });
    } else {
      db.allotments.push({ prn: student.prn, courseId: null, cgpa: student.cgpa, preferenceRank: null, status: "UNALLOCATED", tieFlag: ties.some(t => t.prns.includes(student.prn)), reviewedBy: null, reviewedAt: null });
    }
  });
  db.meta.allocationStatus = "PENDING_ADMIN_REVIEW";
  audit(db, req.session.user.username, "ALLOCATION_RUN", `Generated ${db.allotments.length} provisional results`);
  writeDb(db);
  flash(req, "success", "Provisional allocation generated. Review ties and approve results.");
  res.redirect("/admin/allotments");
});

app.get("/admin/manual-allocation", requireAdmin, (req, res) => {
  const db = readDb();
  const activeStudents = db.students
    .filter(student => student.accountStatus === "ACTIVE")
    .map(student => ({
      ...student,
      allotment: db.allotments.find(row => row.prn === student.prn) || null
    }))
    .sort((a, b) => a.prn.localeCompare(b.prn));
  const courseUsage = db.courses.map(course => ({
    ...course,
    used: db.allotments.filter(row =>
      row.courseId === course.id && ["PROPOSED", "APPROVED"].includes(row.status)
    ).length
  }));
  res.render("admin-manual-allocation", {
    title: "Manual Course Allocation",
    students: activeStudents,
    courses: courseUsage
  });
});

app.post("/admin/manual-allocation/:prn", requireAdmin, (req, res) => {
  const db = readDb();
  const student = db.students.find(item => item.prn === req.params.prn && item.accountStatus === "ACTIVE");
  if (!student) {
    flash(req, "error", "Active student not found.");
    return res.redirect("/admin/manual-allocation");
  }

  const courseId = String(req.body.courseId || "").trim();
  let allotment = db.allotments.find(row => row.prn === student.prn);
  const previousCourseId = allotment ? allotment.courseId : null;

  if (courseId && !db.courses.some(course => course.id === courseId)) {
    flash(req, "error", "Select a valid course.");
    return res.redirect("/admin/manual-allocation");
  }

  if (courseId) {
    const course = db.courses.find(item => item.id === courseId);
    const occupied = db.allotments.filter(row =>
      row.prn !== student.prn &&
      row.courseId === courseId &&
      ["PROPOSED", "APPROVED"].includes(row.status)
    ).length;
    if (occupied >= course.capacity) {
      flash(req, "error", course.name + " has reached its capacity (" + course.capacity + ").");
      return res.redirect("/admin/manual-allocation");
    }
  }

  const now = new Date().toISOString();
  if (!allotment) {
    allotment = {
      prn: student.prn,
      courseId: null,
      cgpa: Number(student.cgpa) || 0,
      preferenceRank: null,
      status: "UNALLOCATED",
      tieFlag: false,
      reviewedBy: null,
      reviewedAt: null
    };
    db.allotments.push(allotment);
  }

  allotment.courseId = courseId || null;
  allotment.cgpa = Number(student.cgpa) || 0;
  allotment.preferenceRank = null;
  allotment.status = courseId ? "APPROVED" : "UNALLOCATED";
  allotment.reviewedBy = req.session.user.username;
  allotment.reviewedAt = now;

  const oldName = db.courses.find(course => course.id === previousCourseId)?.name || "Not allocated";
  const newName = db.courses.find(course => course.id === courseId)?.name || "Not allocated";
  audit(db, req.session.user.username, "MANUAL_COURSE_ALLOCATION",
    student.prn + ": " + oldName + " -> " + newName);
  db.meta.allocationStatus = "MANUAL_ADMIN_UPDATED";
  writeDb(db);

  flash(req, "success", courseId
    ? student.prn + " allocated to " + newName + "."
    : student.prn + " is now marked as not allocated.");
  res.redirect("/admin/manual-allocation");
});

app.get("/admin/allotments", requireAdmin, (req, res) => {
  const db = readDb();
  const rows = db.allotments.map(a => ({
    ...a,
    student: db.students.find(s => s.prn === a.prn),
    course: db.courses.find(c => c.id === a.courseId) || null
  })).sort((a,b) => (b.cgpa || 0) - (a.cgpa || 0));
  res.render("admin-allotments", { title: "Allotment review", rows, status: db.meta.allocationStatus });
});

app.post("/admin/allotments/:prn/approve", requireAdmin, (req, res) => {
  const db = readDb();
  const row = db.allotments.find(a => a.prn === req.params.prn);
  if (!row || row.status !== "PROPOSED") { flash(req, "error", "Only proposed allotments can be approved."); return res.redirect("/admin/allotments"); }
  row.status = "APPROVED";
  row.reviewedBy = req.session.user.username;
  row.reviewedAt = new Date().toISOString();
  audit(db, req.session.user.username, "ALLOTMENT_APPROVED", row.prn);
  if (db.allotments.every(a => ["APPROVED","UNALLOCATED"].includes(a.status))) db.meta.allocationStatus = "APPROVED";
  writeDb(db);
  flash(req, "success", `Allotment approved for ${row.prn}.`);
  res.redirect("/admin/allotments");
});

app.post("/admin/allotments/:prn/reject", requireAdmin, (req, res) => {
  const db = readDb();
  const row = db.allotments.find(a => a.prn === req.params.prn);
  if (!row || row.status !== "PROPOSED") { flash(req, "error", "Only proposed allotments can be rejected."); return res.redirect("/admin/allotments"); }
  row.status = "REJECTED";
  row.reviewedBy = req.session.user.username;
  row.reviewedAt = new Date().toISOString();
  audit(db, req.session.user.username, "ALLOTMENT_REJECTED", row.prn);
  db.meta.allocationStatus = "PENDING_ADMIN_REVIEW";
  writeDb(db);
  flash(req, "success", `Allotment rejected for ${row.prn}.`);
  res.redirect("/admin/allotments");
});

app.get("/admin/audit", requireAdmin, (req, res) => {
  const db = readDb();
  res.render("admin-audit", { title: "Audit log", entries: db.audit });
});

app.get("/student/result", requireStudent, requireCompletedProfile, (req, res) => {
  const db = readDb();
  const result = db.allotments.find(a => a.prn === req.session.user.prn);
  const course = result && result.courseId ? db.courses.find(c => c.id === result.courseId) : null;
  res.render("student-result", { title: "My allotment", result, course });
});

app.use((req, res) => res.status(404).render("error", { title: "Page not found", message: "The page you requested does not exist." }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render("error", { title: "Something went wrong", message: "An unexpected server error occurred. Check the terminal for details." });
});

app.listen(PORT, () => {
  console.log(`Open Elective demo running at http://localhost:${PORT}`);
  console.log("Student demo password is created during registration.");
});
