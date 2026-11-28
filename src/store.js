const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");

const DATA_DIR = path.join(__dirname, "..", "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

// These are the college's department reference records, not student/demo data.
const departments = [
  { code: "CE", name: "Civil Engineering", studentCount: 0 },
  { code: "ME", name: "Mechanical Engineering", studentCount: 0 },
  { code: "EL", name: "Electronics Engineering", studentCount: 0 },
  { code: "CM", name: "Computer Hardware Engineering", studentCount: 0 },
  { code: "IE", name: "Instrumentation Engineering", studentCount: 0 },
  { code: "EE", name: "Electrical & Electronics Engineering", studentCount: 0 }
];

function initialAdmins() {
  const username = String(process.env.INITIAL_ADMIN_USERNAME || "").trim();
  const password = String(process.env.INITIAL_ADMIN_PASSWORD || "");
  const name = String(process.env.INITIAL_ADMIN_NAME || "Portal Administrator").trim();

  if (!username && !password) return [];
  if (!username || password.length < 12 || password.length > 72) {
    throw new Error("Set both INITIAL_ADMIN_USERNAME and INITIAL_ADMIN_PASSWORD (12–72 characters) to provision the first administrator.");
  }

  return [{
    username,
    name,
    passwordHash: bcrypt.hashSync(password, 12),
    role: "SUPER_ADMIN",
    active: true
  }];
}

function freshDb() {
  return {
    meta: {
      collegeName: "Government Polytechnic College, Palakkad",
      semester: 6,
      academicYear: "2026-27",
      preferencesOpen: false,
      allocationStatus: "NOT_STARTED"
    },
    departments,
    courses: [],
    students: [],
    admins: initialAdmins(),
    preferences: [],
    allotments: [],
    profileRequests: [],
    audit: [],
    counters: { preference: 1, audit: 1, profileRequest: 1 }
  };
}

function ensureDir() { fs.mkdirSync(DATA_DIR, { recursive: true }); }
function removeLegacyDemoData(db) {
  let changed = false;
  const demoPrns = new Set((db.students || []).filter(student =>
    /^DEMO-/i.test(String(student.prn || ""))
  ).map(student => student.prn));

  if (demoPrns.size) {
    db.students = (db.students || []).filter(student => !demoPrns.has(student.prn));
    db.preferences = (db.preferences || []).filter(item => !demoPrns.has(item.prn));
    db.allotments = (db.allotments || []).filter(item => !demoPrns.has(item.prn));
    changed = true;
  }

  const demoCourseIds = new Set(["OE-CE-501", "OE-ME-501", "OE-EL-501", "OE-CM-501", "OE-IE-501", "OE-EE-501"]);
  const beforeCourses = (db.courses || []).length;
  db.courses = (db.courses || []).filter(course =>
    !demoCourseIds.has(course.id) &&
    !["Disaster Management", "Renewable Energy Technologies", "Concepts of IoT", "Introduction to IoT", "Mechatronics and Control", "Electric Vehicles & Traction"].includes(course.name)
  );
  if (db.courses.length !== beforeCourses) changed = true;

  const beforeAdmins = (db.admins || []).length;
  db.admins = (db.admins || []).filter(admin =>
    !(String(admin.username).toLowerCase() === "admin" && admin.name === "Demo Administrator")
  );
  if (db.admins.length !== beforeAdmins) changed = true;

  const beforeAudit = (db.audit || []).length;
  db.audit = (db.audit || []).filter(entry =>
    !(entry.action === "DEMO_DATABASE_INITIALIZED" || /seeded fictional demo records/i.test(entry.details || ""))
  );
  if (db.audit.length !== beforeAudit) changed = true;

  if (!db.admins.length) {
    const admins = initialAdmins();
    if (admins.length) {
      db.admins = admins;
      changed = true;
    }
  }

  return changed;
}

function readDb() {
  ensureDir();
  if (!fs.existsSync(DB_FILE)) seedDatabase(false);
  const db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  if (removeLegacyDemoData(db)) writeDb(db);
  return db;
}
function writeDb(db) {
  ensureDir();
  const temp = DB_FILE + ".tmp";
  fs.writeFileSync(temp, JSON.stringify(db, null, 2), "utf8");
  fs.renameSync(temp, DB_FILE);
}
function seedDatabase(force = false) {
  ensureDir();
  if (!force && fs.existsSync(DB_FILE)) return;
  writeDb(freshDb());
}
function audit(db, actor, action, details) {
  db.audit ||= [];
  db.counters ||= {};
  db.counters.audit ||= 1;
  db.audit.unshift({ id: db.counters.audit++, actor, action, details, at: new Date().toISOString() });
  db.audit = db.audit.slice(0, 1000);
}
module.exports = { readDb, writeDb, seedDatabase, audit, DB_FILE };
