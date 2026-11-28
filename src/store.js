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
function readDb() {
  ensureDir();
  if (!fs.existsSync(DB_FILE)) seedDatabase(false);
  return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
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
