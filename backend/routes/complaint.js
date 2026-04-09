const express = require('express');
const { pool } = require('../db');
const { authMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

// submit complaint
router.post('/submit', authMiddleware, async (req, res) => {
  const { category, subject, description } = req.body;
  const complainantId = req.user.complainantId;

  if (!category || !subject || !description) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  try {
    const conn = await pool.getConnection();

    // generate complaint ID
    const [countRow] = await conn.execute('SELECT COUNT(*) as count FROM complaints');
    const count = countRow[0].count;
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const complaintId = `CMP-${today}-${String(count + 1).padStart(4, '0')}`;

    await conn.execute(
      'INSERT INTO complaints (complaint_id, complainant_id, category, subject, description) VALUES (?,?,?,?,?)',
      [complaintId, complainantId, category, subject, description]
    );

    // first status entry
    await conn.execute(
      'INSERT INTO status_history (complaint_id, status, remark, changed_by) VALUES (?,?,?,?)',
      [complaintId, 'Submitted', 'Complaint received by the system.', 'System']
    );

    conn.release();
    res.json({ message: 'Complaint submitted successfully.', complaintId });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// get my complaints
router.get('/mine', authMiddleware, async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [complaints] = await conn.execute(
      'SELECT * FROM complaints WHERE complainant_id = ? ORDER BY created_at DESC',
      [req.user.complainantId]
    );
    conn.release();
    res.json(complaints);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// get complaint with history
router.get('/track/:complaintId', authMiddleware, async (req, res) => {
  const { complaintId } = req.params;

  try {
    const conn = await pool.getConnection();

    // only show own complaints
    const [complaints] = await conn.execute(
      'SELECT * FROM complaints WHERE complaint_id = ? AND complainant_id = ?',
      [complaintId, req.user.complainantId]
    );

    if (!complaints.length) {
      conn.release();
      return res.status(404).json({ error: 'Complaint not found.' });
    }

    const [history] = await conn.execute(
      'SELECT * FROM status_history WHERE complaint_id = ? ORDER BY changed_at ASC',
      [complaintId]
    );

    conn.release();
    res.json({ complaint: complaints[0], history });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
