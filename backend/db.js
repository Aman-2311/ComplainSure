const mysql  = require('mysql2/promise');
require('dotenv').config();

// create connection pool
const pool = mysql.createPool({
  host:     process.env.DB_HOST,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10
});

// create database and all tables if they don't exist
async function initDB() {
  // first connect without selecting a database to create it
  const tempConn = await mysql.createConnection({
    host:     process.env.DB_HOST,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD
  });

  await tempConn.execute(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\``);
  await tempConn.end();

  // now create tables
  const conn = await pool.getConnection();

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS students (
      id            INT AUTO_INCREMENT PRIMARY KEY,
      name          VARCHAR(100) NOT NULL,
      email         VARCHAR(100) UNIQUE NOT NULL,
      roll_no       VARCHAR(50)  NOT NULL,
      password      VARCHAR(255) NOT NULL,
      complainant_id VARCHAR(20) UNIQUE NOT NULL,
      created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS admins (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      username    VARCHAR(100) UNIQUE NOT NULL,
      password    VARCHAR(255) NOT NULL,
      role        ENUM('admin','head_admin') DEFAULT 'admin',
      display_name VARCHAR(100)
    )
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS complaints (
      id             INT AUTO_INCREMENT PRIMARY KEY,
      complaint_id   VARCHAR(30) UNIQUE NOT NULL,
      complainant_id VARCHAR(20) NOT NULL,
      category       VARCHAR(50) NOT NULL,
      subject        VARCHAR(150) NOT NULL,
      description    TEXT NOT NULL,
      status         VARCHAR(30) DEFAULT 'Submitted',
      eta            VARCHAR(100),
      created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS status_history (
      id           INT AUTO_INCREMENT PRIMARY KEY,
      complaint_id VARCHAR(30) NOT NULL,
      status       VARCHAR(30) NOT NULL,
      remark       TEXT,
      changed_by   VARCHAR(100),
      changed_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // seed default admin accounts if not present
  const [admins] = await conn.execute('SELECT COUNT(*) as count FROM admins');
  if (admins[0].count === 0) {
    const bcrypt = require('bcryptjs');
    const adminPass = await bcrypt.hash('admin123', 10);
    const headPass  = await bcrypt.hash('head123', 10);

    await conn.execute(
      'INSERT INTO admins (username, password, role, display_name) VALUES (?,?,?,?)',
      ['admin@ghrcemp.raisoni.net', adminPass, 'admin', 'Admin']
    );
    await conn.execute(
      'INSERT INTO admins (username, password, role, display_name) VALUES (?,?,?,?)',
      ['head@ghrcemp.raisoni.net', headPass, 'head_admin', 'Head Admin']
    );
    console.log('✅ Default admin accounts created');
  }

  conn.release();
  console.log('✅ Database and tables ready');
}

module.exports = { pool, initDB };
