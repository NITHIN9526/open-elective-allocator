const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");

const DATA_DIR = path.join(__dirname, "..", "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

const departments = [
  { code: "CE", name: "Civil Engineering", studentCount: 53 },
  { code: "ME", name: "Mechanical Engineering", studentCount: 56 },
  { code: "EL", name: "Electronics Engineering", studentCount: 59 },
  { code: "CM", name: "Computer Hardware Engineering", studentCount: 51 },
  { code: "IE", name: "Instrumentation Engineering", studentCount: 56 },
  { code: "EE", name: "Electrical & Electronics Engineering", studentCount: 50 }
];

const courses = [
  { id: "OE-CE-501", name: "Disaster Management", offeredBy: "CE", capacity: 65, description: "Risk reduction, preparedness and disaster response." },
  { id: "OE-ME-501", name: "Renewable Energy Technologies", offeredBy: "ME", capacity: 65, description: "Solar, wind and other renewable energy systems." },
  { id: "OE-EL-501", name: "Concepts of IoT", offeredBy: "EL", capacity: 65, description: "Connected devices, sensors and IoT applications." },
  { id: "OE-CM-501", name: "Introduction to IoT", offeredBy: "CM", capacity: 65, description: "IoT architecture, protocols and application development." },
  { id: "OE-IE-501", name: "Mechatronics and Control", offeredBy: "IE", capacity: 65, description: "Sensors, actuators and automated control systems." },
  { id: "OE-EE-501", name: "Electric Vehicles & Traction", offeredBy: "EE", capacity: 65, description: "EV components, drives and traction fundamentals." }
];

const students = [
  ["DEMO-CE-001","Arun Kumar","CE","arun.ce@example.com",9.20],
  ["DEMO-CE-002","Anjali S","CE","anjali.ce@example.com",8.50],
  ["DEMO-ME-001","Adithya Raj","ME","adithya.me@example.com",9.00],
  ["DEMO-ME-002","Amal Dev","ME","amal.me@example.com",8.50],
  ["DEMO-EL-001","Rahul P","EL","rahul.el@example.com",9.40],
  ["DEMO-EL-002","Neha K","EL","neha.el@example.com",8.20],
  ["DEMO-CM-001","Vishnu M","CM","vishnu.cm@example.com",9.10],
  ["DEMO-CM-002","Meera R","CM","meera.cm@example.com",8.70],
  ["DEMO-IE-001","Arjun S","IE","arjun.ie@example.com",8.90],
  ["DEMO-IE-002","Devika P","IE","devika.ie@example.com",7.80],
  ["DEMO-EE-001","Kiran B","EE","kiran.ee@example.com",9.30],
  ["DEMO-EE-002","Anu Thomas","EE","anu.ee@example.com",8.10]
];

function freshDb() {
  return {
    meta: { collegeName: "Government Polytechnic College, Palakkad", semester: 5, academicYear: "2026-27", preferencesOpen: true, allocationStatus: "NOT_STARTED", portalMode: "DEMO" },
    departments,
    courses,
    students: students.map(([prn,name,department,email,cgpa]) => ({
      prn, name, department, semester: 5, email, cgpa,
      passwordHash: null, accountStatus: "NOT_REGISTERED", createdAt: null
    })),
    admins: [{
      username: "admin",
      name: "Demo Administrator",
      passwordHash: bcrypt.hashSync("Admin@12345", 10),
      role: "SUPER_ADMIN",
      active: true
    }],
    preferences: [],
    allotments: [],
    audit: [{ id: 1, actor: "SYSTEM", action: "DEMO_DATABASE_INITIALIZED", details: "Seeded fictional demo records", at: new Date().toISOString() }],
    counters: { preference: 1, audit: 2 }
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
  db.audit.unshift({ id: db.counters.audit++, actor, action, details, at: new Date().toISOString() });
  db.audit = db.audit.slice(0, 1000);
}
module.exports = { readDb, writeDb, seedDatabase, audit, DB_FILE };
