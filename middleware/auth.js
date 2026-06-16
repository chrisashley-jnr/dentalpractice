// middleware/auth.js

function exposeSessionToViews(req, res, next) {
  res.locals.currentPatient = req.session.patientId ? { id: req.session.patientId, name: req.session.patientName } : null;
  res.locals.currentStaff = req.session.staffId ? { id: req.session.staffId, name: req.session.staffName } : null;
  next();
}

function requirePatientLogin(req, res, next) {
  if (!req.session.patientId) {
    return res.redirect(`/login?next=${encodeURIComponent(req.originalUrl)}`);
  }
  next();
}

function requireStaffLogin(req, res, next) {
  if (!req.session.staffId) {
    return res.redirect('/staff/login');
  }
  next();
}

module.exports = {
  exposeSessionToViews,
  requirePatientLogin,
  requireStaffLogin
};
