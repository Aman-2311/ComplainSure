const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { pool } = require('../db');

const router = express.Router();

// student signup
router.post('/signup', async (req, res) => {
  const { name, email, roll, password } = req.body;

  // check all fields
  if (!name || !email || !roll || !password) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  // check email domain
  if (!email.endsWith('@ghrcemp.raisoni.net')) {
    return res.status(400).json({ error: 'Please use your college email (@ghrcemp.raisoni.net).' });
  }

  // check roll number
  if (roll.trim().length < 3) {
    return res.status(400).json({ error: 'Please enter a valid roll number.' });
  }

  // check password
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  try {
    const conn = await pool.getConnection();

    // check if email already exists
    const [emailCheck] = await conn.execute('SELECT id FROM students WHERE email = ?', [email]);
    if (emailCheck.length > 0) {
      conn.release();
      return res.status(400).json({ error: 'Account with this email already exists.' });
    }

    // check if roll already exists
    const [rollCheck] = await conn.execute('SELECT id FROM students WHERE roll_no = ?', [roll]);
    if (rollCheck.length > 0) {
      conn.release();
      return res.status(400).json({ error: 'Account with this roll number already exists.' });
    }

    // create anonymous ID like CSE-482910
    const dept = roll.replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase() || 'STU';
    const complainantId = dept + '-' + Date.now().toString().slice(-6);

    // hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    await conn.execute(
      'INSERT INTO students (name, email, roll_no, password, complainant_id) VALUES (?,?,?,?,?)',
      [name, email, roll, hashedPassword, complainantId]
    );

    conn.release();
    res.json({ message: 'Account created successfully! Please log in.' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// student login
router.post('/login/student', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Please fill in all fields.' });
  }

  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.execute('SELECT * FROM students WHERE email = ?', [email]);
    conn.release();

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const student = rows[0];
    const match   = await bcrypt.compare(password, student.password);

    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // create token (valid 8 hrs)
    const token = jwt.sign(
      { id: student.id, complainantId: student.complainant_id, name: student.name, role: 'student' },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      user: {
        name:         student.name,
        email:        student.email,
        complainantId: student.complainant_id,
        role:         'student'
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// HARDCODED ADMIN PROFILES
// ONLY add emails and details here manually to grant access
const HARDCODED_ADMINS = [
  { 
    username: 'admin@ghrcemp.raisoni.net', 
    password: 'adminpassword', 
    role: 'admin', 
    display_name: 'Admin' 
  },
  { 
    username: 'head@ghrcemp.raisoni.net', 
    password: 'headpassword', 
    role: 'head_admin', 
    display_name: 'Head Admin' 
  }
];

// admin login
router.post('/login/admin', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Please fill in all fields.' });
  }

  try {
    // Check against hardcoded array instead of database for absolute security
    const admin = HARDCODED_ADMINS.find(a => a.username === username);

    if (!admin) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    // Direct string comparison since passwords are hardcoded (no bcrypt needed here)
    if (admin.password !== password) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const token = jwt.sign(
      { username: admin.username, role: admin.role, displayName: admin.display_name },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      user: {
        username:    admin.username,
        role:        admin.role,
        displayName: admin.display_name
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

module.exports = router;
