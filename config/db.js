// config/db.js
const Database = require('better-sqlite3');
const fs = require('fs');
const os = require('os');
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = process.env.SQLITE_PATH || (
  process.env.VERCEL
    ? path.join(os.tmpdir(), 'dental_practice.db')
    : path.join(__dirname, '../dental_practice.db')
);

fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new Database(dbPath);

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    duration_mins INTEGER NOT NULL,
    price_ghs REAL NOT NULL,
    icon_key TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS dentists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    full_name TEXT NOT NULL,
    specialty TEXT NOT NULL,
    bio TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS enquiries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    message TEXT NOT NULL,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS patients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    date_of_birth TEXT NOT NULL,
    gender TEXT,
    address_line1 TEXT NOT NULL,
    address_line2 TEXT,
    city TEXT NOT NULL,
    postcode TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    medical_conditions TEXT,
    marketing_consent INTEGER DEFAULT 0,
    registered_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL,
    dentist_id INTEGER NOT NULL,
    service_id INTEGER NOT NULL,
    appointment_date TEXT NOT NULL,
    appointment_time TEXT NOT NULL,
    status TEXT DEFAULT 'booked',
    notes TEXT,
    FOREIGN KEY (patient_id) REFERENCES patients(id),
    FOREIGN KEY (dentist_id) REFERENCES dentists(id),
    FOREIGN KEY (service_id) REFERENCES services(id)
  );

  CREATE TABLE IF NOT EXISTS staff (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    password_hash TEXT NOT NULL
  );
`);

// Seed default data if services table is empty
const servicesCount = db.prepare('SELECT COUNT(*) AS count FROM services').get().count;
if (servicesCount === 0) {
  const insertService = db.prepare(`
    INSERT INTO services (name, description, duration_mins, price_ghs, icon_key)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  insertService.run('Routine Check-up', 'A thorough examination of your teeth and gums, including x-rays if needed.', 20, 300.00, 'checkup');
  insertService.run('Scale & Polish', 'Removal of plaque and tartar buildup, finished with a professional polish.', 30, 450.00, 'clean');
  insertService.run('Teeth Whitening', 'Professional whitening treatment to lift stains and brighten your smile.', 45, 2000.00, 'whiten');
  insertService.run('White Filling', 'High-quality, tooth-coloured composite filling to repair decay.', 45, 700.00, 'filling');
  insertService.run('Root Canal', 'Therapy to save a badly damaged or infected tooth, avoiding extraction.', 60, 3000.00, 'root');
  insertService.run('Emergency Care', 'Urgent assessment and pain relief for toothache or dental trauma.', 30, 600.00, 'emergency');
}

// Seed default data if dentists table is empty
const dentistsCount = db.prepare('SELECT COUNT(*) AS count FROM dentists').get().count;
if (dentistsCount === 0) {
  const insertDentist = db.prepare(`
    INSERT INTO dentists (title, full_name, specialty, bio)
    VALUES (?, ?, ?, ?)
  `);

  insertDentist.run('Dr.', 'Kwame Mensah', 'General Dentist', 'Kwame has over 12 years of experience in family dentistry, with a focus on gentle check-ups and preventative care across Accra.');
  insertDentist.run('Dr.', 'Akosua Adjei', 'Cosmetic Dentist', 'Akosua specializes in modern aesthetic treatments, including composite bonding and advanced whitening techniques.');
  insertDentist.run('Dr.', 'Kofi Osei', 'Endodontist', 'Kofi is our specialist in root canal treatments and emergency dental care, helping put even the most nervous patients at ease.');
}

// Seed default staff user if staff table is empty
const staffCount = db.prepare('SELECT COUNT(*) AS count FROM staff').get().count;
if (staffCount === 0) {
  const salt = bcrypt.genSaltSync(10);
  const hash = bcrypt.hashSync('password123', salt);
  db.prepare(`
    INSERT INTO staff (username, full_name, password_hash)
    VALUES (?, ?, ?)
  `).run('staff', 'Practice Administrator', hash);
}

// Seed demo patient for testing (matches login page hint)
const demoPatient = db.prepare('SELECT id FROM patients WHERE email = ?').get('kofi.boateng@example.com');
if (!demoPatient) {
  const hash = bcrypt.hashSync('Patient2026!', 10);
  db.prepare(`
    INSERT INTO patients
      (first_name, last_name, date_of_birth, gender, address_line1, address_line2, city, postcode,
       phone, email, password_hash, emergency_contact_name, emergency_contact_phone, medical_conditions, marketing_consent)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    'Kofi', 'Boateng', '1990-04-12', 'Male',
    '14 Ring Road East', null, 'Accra', 'GA-123-4567',
    '+233 24 555 0198', 'kofi.boateng@example.com', hash,
    'Ama Boateng', '+233 24 555 0199', null, 1
  );
}

module.exports = db;
