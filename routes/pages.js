// routes/pages.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');

router.get('/', (req, res) => {
  const services = db.prepare('SELECT * FROM services ORDER BY id LIMIT 6').all();
  res.render('index', { title: 'Home', services });
});

router.get('/about', (req, res) => {
  const dentists = db.prepare('SELECT * FROM dentists ORDER BY id').all();
  res.render('about', { title: 'About Us', dentists });
});

router.get('/services', (req, res) => {
  const services = db.prepare('SELECT * FROM services ORDER BY id').all();
  res.render('services', { title: 'Our Services', services });
});

router.get('/contact', (req, res) => {
  res.render('contact', { title: 'Contact Us', sent: false });
});

router.post('/contact', (req, res) => {
  const { name, email, message } = req.body;
  if (!name || !email || !message) {
    return res.render('contact', { title: 'Contact Us', sent: false, error: 'Please fill in every field.' });
  }
  db.prepare('INSERT INTO enquiries (name, email, message) VALUES (?,?,?)').run(name, email, message);
  res.render('contact', { title: 'Contact Us', sent: true });
});

module.exports = router;
