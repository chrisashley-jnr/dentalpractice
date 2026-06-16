// routes/staff.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { requireStaffLogin } = require('../middleware/auth');

// ---- Staff login / logout ---------------------------------------------------
router.get('/staff/login', (req, res) => {
  res.render('staff-login', { title: 'Staff Login', error: null });
});

router.post('/staff/login', (req, res) => {
  const { username, password } = req.body;
  const staff = db.prepare('SELECT * FROM staff WHERE username = ?').get((username || '').trim());

  if (!staff || !bcrypt.compareSync(password || '', staff.password_hash)) {
    return res.render('staff-login', { title: 'Staff Login', error: 'Incorrect username or password.' });
  }

  req.session.staffId = staff.id;
  req.session.staffName = staff.full_name;
  res.redirect('/staff/dashboard');
});

router.post('/staff/logout', (req, res) => {
  req.session.staffId = null;
  req.session.staffName = null;
  res.redirect('/staff/login');
});

// ---- Dashboard ---------------------------------------------------------------
router.get('/staff/dashboard', requireStaffLogin, (req, res) => {
  const stats = {
    patientCount: db.prepare('SELECT COUNT(*) AS c FROM patients').get().c,
    futureCount: db.prepare("SELECT COUNT(*) AS c FROM appointments WHERE appointment_date >= date('now') AND status = 'booked'").get().c,
    pastCount: db.prepare("SELECT COUNT(*) AS c FROM appointments WHERE appointment_date < date('now') OR status = 'completed'").get().c,
    enquiryCount: db.prepare('SELECT COUNT(*) AS c FROM enquiries').get().c
  };
  res.render('staff-dashboard', { title: 'Staff Dashboard', stats });
});

router.post('/staff/appointments/:id/status', requireStaffLogin, (req, res) => {
  const nextStatus = req.body.status;
  if (!['completed', 'cancelled'].includes(nextStatus)) {
    return res.redirect(req.get('Referrer') || '/staff/dashboard');
  }

  const appt = db.prepare('SELECT id, status FROM appointments WHERE id = ?').get(req.params.id);
  if (appt && appt.status === 'booked') {
    db.prepare('UPDATE appointments SET status = ? WHERE id = ?').run(nextStatus, appt.id);
  }

  res.redirect(req.get('Referrer') || '/staff/dashboard');
});

// ---- Report 1: List of patients ----------------------------------------------
router.get('/staff/reports/patients', requireStaffLogin, (req, res) => {
  const search = (req.query.q || '').trim();
  let patients;
  if (search) {
    patients = db.prepare(`
      SELECT * FROM patients
      WHERE first_name LIKE ? OR last_name LIKE ? OR email LIKE ?
      ORDER BY last_name, first_name
    `).all(`%${search}%`, `%${search}%`, `%${search}%`);
  } else {
    patients = db.prepare('SELECT * FROM patients ORDER BY last_name, first_name').all();
  }
  res.render('staff/patients', { title: 'Patient List Report', patients, search });
});

router.get('/staff/reports/patients.csv', requireStaffLogin, (req, res) => {
  const patients = db.prepare('SELECT * FROM patients ORDER BY last_name, first_name').all();
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="patients.csv"');
  const header = 'First Name,Last Name,Date of Birth,Phone,Email,Postcode,Registered\n';
  const rows = patients.map(p =>
    [p.first_name, p.last_name, p.date_of_birth, p.phone, p.email, p.postcode, p.registered_at]
      .map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
  ).join('\n');
  res.send(header + rows);
});

// ---- Report 2: Future appointments -------------------------------------------
function futureAppointmentsQuery(search) {
  const base = `
    SELECT a.id, a.appointment_date, a.appointment_time, a.status, a.notes,
           p.id AS patient_id, p.first_name, p.last_name, p.first_name || ' ' || p.last_name AS patient_name,
           p.date_of_birth, p.gender, p.address_line1, p.address_line2, p.city, p.postcode,
           p.phone AS patient_phone, p.email AS patient_email,
           p.emergency_contact_name, p.emergency_contact_phone, p.medical_conditions,
           d.full_name AS dentist_name, s.name AS service_name
    FROM appointments a
    JOIN patients p ON p.id = a.patient_id
    JOIN dentists d ON d.id = a.dentist_id
    JOIN services s ON s.id = a.service_id
    WHERE a.appointment_date >= date('now') AND a.status = 'booked'
  `;
  if (search) {
    return db.prepare(base + ' AND (p.first_name LIKE ? OR p.last_name LIKE ? OR d.full_name LIKE ?) ORDER BY a.appointment_date, a.appointment_time')
      .all(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  return db.prepare(base + ' ORDER BY a.appointment_date, a.appointment_time').all();
}

router.get('/staff/reports/future-appointments', requireStaffLogin, (req, res) => {
  const search = (req.query.q || '').trim();
  const appointments = futureAppointmentsQuery(search);
  res.render('staff/future-appointments', { title: 'Future Appointments Report', appointments, search });
});

// ---- Report 3: Past appointments ----------------------------------------------
function pastAppointmentsQuery(search) {
  const base = `
    SELECT a.id, a.appointment_date, a.appointment_time, a.status, a.notes,
           p.id AS patient_id, p.first_name, p.last_name, p.first_name || ' ' || p.last_name AS patient_name,
           p.date_of_birth, p.gender, p.address_line1, p.address_line2, p.city, p.postcode,
           p.phone AS patient_phone, p.email AS patient_email,
           p.emergency_contact_name, p.emergency_contact_phone, p.medical_conditions,
           d.full_name AS dentist_name, s.name AS service_name
    FROM appointments a
    JOIN patients p ON p.id = a.patient_id
    JOIN dentists d ON d.id = a.dentist_id
    JOIN services s ON s.id = a.service_id
    WHERE (a.appointment_date < date('now') OR a.status = 'completed') AND a.status != 'cancelled'
  `;
  if (search) {
    return db.prepare(base + ' AND (p.first_name LIKE ? OR p.last_name LIKE ? OR d.full_name LIKE ?) ORDER BY a.appointment_date DESC, a.appointment_time DESC')
      .all(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  return db.prepare(base + ' ORDER BY a.appointment_date DESC, a.appointment_time DESC').all();
}

router.get('/staff/reports/past-appointments', requireStaffLogin, (req, res) => {
  const search = (req.query.q || '').trim();
  const appointments = pastAppointmentsQuery(search);
  res.render('staff/past-appointments', { title: 'Past Appointments Report', appointments, search });
});

// CSV export for both appointment reports (extra functionality)
router.get('/staff/reports/:type(future-appointments|past-appointments).csv', requireStaffLogin, (req, res) => {
  const isFuture = req.params.type === 'future-appointments';
  const rows = isFuture ? futureAppointmentsQuery('') : pastAppointmentsQuery('');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${req.params.type}.csv"`);
  const header = 'Date,Time,Patient,Phone,Dentist,Service,Status,Notes\n';
  const body = rows.map(r =>
    [r.appointment_date, r.appointment_time, r.patient_name, r.patient_phone, r.dentist_name, r.service_name, r.status, r.notes || '']
      .map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
  ).join('\n');
  res.send(header + body);
});

// ---- Enquiries (contact form submissions) - bonus visibility for staff -------
router.get('/staff/reports/enquiries', requireStaffLogin, (req, res) => {
  const enquiries = db.prepare('SELECT * FROM enquiries ORDER BY submitted_at DESC').all();
  res.render('staff/enquiries', { title: 'Contact Enquiries', enquiries });
});

module.exports = router;
