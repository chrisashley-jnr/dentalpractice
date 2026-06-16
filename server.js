// server.js
require('./config/db'); // initialises + seeds the database on first run
const express = require('express');
const session = require('express-session');
const path = require('path');

const { exposeSessionToViews } = require('./middleware/auth');
const pageRoutes = require('./routes/pages');
const patientRoutes = require('./routes/patients');
const appointmentRoutes = require('./routes/appointments');
const staffRoutes = require('./routes/staff');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.get('/dental.svg', (req, res) => {
  res.sendFile(path.join(__dirname, 'dental.svg'));
});

app.use(session({
  secret: process.env.SESSION_SECRET || 'riverside-dental-dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 * 4 } // 4 hour session
}));

app.use(exposeSessionToViews);

app.use('/', pageRoutes);
app.use('/', patientRoutes);
app.use('/', appointmentRoutes);
app.use('/', staffRoutes);

app.use((req, res) => {
  res.status(404).render('404', { title: 'Page Not Found' });
});

app.listen(PORT, () => {
  console.log(`Riverside Dental Practice website running at http://localhost:${PORT}`);
});
