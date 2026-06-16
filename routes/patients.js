// routes/patients.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { requirePatientLogin } = require('../middleware/auth');

// ---- Registration ----------------------------------------------------------
router.get('/register', (req, res) => {
  res.render('register', { title: 'Register', error: null, values: {} });
});

router.post('/register', (req, res) => {
  const {
    first_name, last_name, date_of_birth, gender,
    address_line1, address_line2, city, postcode,
    phone, email, password, confirm_password,
    emergency_contact_name, emergency_contact_phone,
    medical_conditions, marketing_consent
  } = req.body;

  // Server-side validation (mirrors client-side checks - never trust the client alone)
  if (!first_name || !last_name || !date_of_birth || !address_line1 || !city ||
      !postcode || !phone || !email || !password) {
    return res.render('register', { title: 'Register', error: 'Please complete all required fields.', values: req.body });
  }
  if (password.length < 8) {
    return res.render('register', { title: 'Register', error: 'Password must be at least 8 characters long.', values: req.body });
  }
  if (password !== confirm_password) {
    return res.render('register', { title: 'Register', error: 'Passwords do not match.', values: req.body });
  }

  const existing = db.prepare('SELECT id FROM patients WHERE email = ?').get(email.toLowerCase());
  if (existing) {
    return res.render('register', { title: 'Register', error: 'An account with that email already exists. Please log in instead.', values: req.body });
  }

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare(`INSERT INTO patients
    (first_name, last_name, date_of_birth, gender, address_line1, address_line2, city, postcode,
     phone, email, password_hash, emergency_contact_name, emergency_contact_phone, medical_conditions, marketing_consent)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    first_name.trim(), last_name.trim(), date_of_birth, gender || null,
    address_line1.trim(), address_line2 ? address_line2.trim() : null, city.trim(), postcode.trim(),
    phone.trim(), email.trim().toLowerCase(), hash,
    emergency_contact_name || null, emergency_contact_phone || null,
    medical_conditions || null, marketing_consent ? 1 : 0
  );

  req.session.patientId = result.lastInsertRowid;
  req.session.patientName = first_name;
  res.redirect('/book-appointment?welcome=1');
});

// ---- Login / logout ---------------------------------------------------------
router.get('/login', (req, res) => {
  res.render('login', { title: 'Patient Login', error: null, next: req.query.next || '/dashboard' });
});

router.post('/login', (req, res) => {
  const { email, password, next } = req.body;
  const patient = db.prepare('SELECT * FROM patients WHERE email = ?').get((email || '').trim().toLowerCase());

  if (!patient || !bcrypt.compareSync(password || '', patient.password_hash)) {
    return res.render('login', { title: 'Patient Login', error: 'Incorrect email or password.', next: next || '/dashboard' });
  }

  req.session.patientId = patient.id;
  req.session.patientName = patient.first_name;
  res.redirect(next && next.startsWith('/') ? next : '/dashboard');
});

router.post('/logout', (req, res) => {
  req.session.patientId = null;
  req.session.patientName = null;
  res.redirect('/');
});

// ---- Patient self-service dashboard (extra functionality) -------------------
router.get('/dashboard', requirePatientLogin, (req, res) => {
  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(req.session.patientId);

  const upcoming = db.prepare(`
    SELECT a.id, a.appointment_date, a.appointment_time, a.status,
           s.name AS service_name, d.full_name AS dentist_name, d.title AS dentist_title
    FROM appointments a
    JOIN services s ON s.id = a.service_id
    JOIN dentists d ON d.id = a.dentist_id
    WHERE a.patient_id = ? AND a.appointment_date >= date('now') AND a.status = 'booked'
    ORDER BY a.appointment_date ASC, a.appointment_time ASC
  `).all(patient.id);

  const past = db.prepare(`
    SELECT a.id, a.appointment_date, a.appointment_time, a.status,
           s.name AS service_name, d.full_name AS dentist_name, d.title AS dentist_title
    FROM appointments a
    JOIN services s ON s.id = a.service_id
    JOIN dentists d ON d.id = a.dentist_id
    WHERE a.patient_id = ? AND (a.appointment_date < date('now') OR a.status = 'completed')
    ORDER BY a.appointment_date DESC, a.appointment_time DESC
  `).all(patient.id);

  res.render('patient-dashboard', {
    title: 'My Account',
    patient,
    upcoming,
    past,
    booked: req.query.booked === '1'
  });
});

router.post('/appointments/:id/cancel', requirePatientLogin, (req, res) => {
  const appt = db.prepare('SELECT * FROM appointments WHERE id = ? AND patient_id = ?')
    .get(req.params.id, req.session.patientId);
  if (appt && appt.status === 'booked') {
    db.prepare("UPDATE appointments SET status = 'cancelled' WHERE id = ?").run(appt.id);
  }
  res.redirect('/dashboard');
});

module.exports = router;
