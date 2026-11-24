const crypto = require("crypto");

function requireAuth(req, res, next) {
  if (!req.session.user) {
    req.session.flash = { type: "error", message: "Please sign in to continue." };
    return res.redirect("/login");
  }
  next();
}
function requireStudent(req, res, next) {
  if (!req.session.user || req.session.user.role !== "STUDENT") return res.status(403).render("error", { title: "Access denied", message: "Student access is required." });
  next();
}
function requireAdmin(req, res, next) {
  if (!req.session.user || !["ADMIN", "SUPER_ADMIN"].includes(req.session.user.role)) return res.status(403).render("error", { title: "Access denied", message: "Administrator access is required." });
  next();
}
function csrf(req, res, next) {
  if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(32).toString("hex");
  res.locals.csrfToken = req.session.csrfToken;
  if (req.method === "POST") {
    const token = req.body && req.body._csrf;
    const expected = req.session.csrfToken;
    if (typeof token !== "string" || !expected || token.length !== expected.length ||
        !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))) {
      return res.status(403).render("error", { title: "Request rejected", message: "The form security token was invalid. Go back and try again." });
    }
  }
  next();
}
module.exports = { requireAuth, requireStudent, requireAdmin, csrf };
