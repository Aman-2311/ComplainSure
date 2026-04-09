const express = require('express');
const { pool } = require('../db');
const { authMiddleware, adminOnly } = require('../middleware/authMiddleware');

const router = express.Router();

// admin-only routes
router.use(authMiddleware, adminOnly);

// get all complaints
router.get('/complaints', async (req, res) => {
  const { status, category } = req.query;

  let query  = 'SELECT * FROM complaints WHERE 1=1';
  const params = [];

  if (status)   { query += ' AND status = ?';   params.push(status); }
  if (category) { query += ' AND category = ?'; params.push(category); }
  query += ' ORDER BY created_at DESC';

  try {
    const conn = await pool.getConnection();
    const [complaints] = await conn.execute(query, params);

    // count per status
    const [counts] = await conn.execute(`
      SELECT status, COUNT(*) as count FROM complaints GROUP BY status
    `);

    conn.release();
    res.json({ complaints, counts });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// get single complaint detail
router.get('/complaint/:complaintId', async (req, res) => {
  const { complaintId } = req.params;

  try {
    const conn = await pool.getConnection();

    const [complaints] = await conn.execute(
      'SELECT * FROM complaints WHERE complaint_id = ?', [complaintId]
    );

    if (!complaints.length) {
      conn.release();
      return res.status(404).json({ error: 'Complaint not found.' });
    }

    const complaint = complaints[0];

    const [history] = await conn.execute(
      'SELECT * FROM status_history WHERE complaint_id = ? ORDER BY changed_at ASC',
      [complaintId]
    );

    // only head admin can see student info
    let identity = null;
    if (req.user.role === 'head_admin') {
      const [students] = await conn.execute(
        'SELECT name, email FROM students WHERE complainant_id = ?',
        [complaint.complainant_id]
      );
      if (students.length) identity = students[0];
    }

    conn.release();
    res.json({ complaint, history, identity });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// update complaint status
router.post('/complaint/:complaintId/update', async (req, res) => {
  const { complaintId } = req.params;
  const { status, remark, eta } = req.body;

  if (!status || !remark) {
    return res.status(400).json({ error: 'Status and remark are required.' });
  }

  try {
    const conn = await pool.getConnection();

    await conn.execute(
      'UPDATE complaints SET status = ?, eta = ? WHERE complaint_id = ?',
      [status, eta || null, complaintId]
    );

    await conn.execute(
      'INSERT INTO status_history (complaint_id, status, remark, changed_by) VALUES (?,?,?,?)',
      [complaintId, status, remark, req.user.username]
    );

    conn.release();
    res.json({ message: 'Status updated successfully.' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
