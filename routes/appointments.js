// routes/appointments.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requirePatientLogin } = require('../middleware/auth');

router.get('/book-appointment', requirePatientLogin, (req, res) => {
  // Lookups: populate dropdowns from the database rather than hard-coding them
  const services = db.prepare('SELECT * FROM services ORDER BY name').all();
  const dentists = db.prepare('SELECT * FROM dentists ORDER BY full_name').all();
  res.render('book-appointment', {
    title: 'Book an Appointment',
    services, dentists,
    error: null,
    welcome: req.query.welcome === '1'
  });
});

// AJAX endpoint: returns already-taken time slots for a given dentist + date
// so the booking form can grey them out before the user even submits.
router.get('/api/availability', requirePatientLogin, (req, res) => {
  const { dentist_id, date } = req.query;
  if (!dentist_id || !date) return res.json({ taken: [] });
  const rows = db.prepare(`
    SELECT appointment_time FROM appointments
    WHERE dentist_id = ? AND appointment_date = ? AND status = 'booked'
  `).all(dentist_id, date);
  res.json({ taken: rows.map(r => r.appointment_time) });
});

router.post('/book-appointment', requirePatientLogin, (req, res) => {
  const { dentist_id, service_id, appointment_date, appointment_time, notes } = req.body;
  const services = db.prepare('SELECT * FROM services ORDER BY name').all();
  const dentists = db.prepare('SELECT * FROM dentists ORDER BY full_name').all();

  if (!dentist_id || !service_id || !appointment_date || !appointment_time) {
    return res.render('book-appointment', { title: 'Book an Appointment', services, dentists, error: 'Please complete every field.', welcome: false });
  }

  const today = new Date().toISOString().slice(0, 10);
  if (appointment_date < today) {
    return res.render('book-appointment', { title: 'Book an Appointment', services, dentists, error: 'You cannot book an appointment in the past.', welcome: false });
  }

  // Conflict-prevention query: refuse to double-book the same dentist at the same time
  const clash = db.prepare(`
    SELECT id FROM appointments
    WHERE dentist_id = ? AND appointment_date = ? AND appointment_time = ? AND status = 'booked'
  `).get(dentist_id, appointment_date, appointment_time);

  if (clash) {
    return res.render('book-appointment', {
      title: 'Book an Appointment', services, dentists, welcome: false,
      error: 'That dentist is already booked at this time. Please choose a different slot.'
    });
  }

  db.prepare(`INSERT INTO appointments (patient_id, dentist_id, service_id, appointment_date, appointment_time, notes)
    VALUES (?,?,?,?,?,?)`).run(req.session.patientId, dentist_id, service_id, appointment_date, appointment_time, notes || '');

  res.redirect('/dashboard?booked=1');
});

module.exports = router;
