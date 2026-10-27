const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');

// Checks JWT for HTTP routes
function authMiddleware(req, res, next) {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Not logged in' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// Checks JWT for sockets
function socketAuth(socket, next) {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('auth'));
  try {
    socket.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    next(new Error('auth'));
  }
}

module.exports = { authMiddleware, socketAuth };
