const jwt = require('jsonwebtoken');

// checks if user is logged in
function authMiddleware(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1]; // get token

  if (!token) {
    return res.status(401).json({ error: 'No token provided. Please log in.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // save user data
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token. Please log in again.' });
  }
}

// checks if user is admin
function adminOnly(req, res, next) {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'head_admin')) {
    return res.status(403).json({ error: 'Access denied. Admins only.' });
  }
  next();
}

module.exports = { authMiddleware, adminOnly };
