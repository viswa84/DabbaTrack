const jwt = require('jsonwebtoken');
const { users } = require('./data/store');

const JWT_SECRET = process.env.JWT_SECRET || 'dabba-track-development-secret';

function createToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: '7d' },
  );
}

function authMiddleware(req, _res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '');
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      const user = users.find((candidate) => candidate.id === payload.id);
      if (user) {
        req.user = { id: user.id, role: user.role, email: user.email, name: user.name };
      }
    } catch (err) {
      console.warn('Invalid token provided', err.message);
    }
  }
  next();
}

module.exports = {
  authMiddleware,
  createToken,
};
