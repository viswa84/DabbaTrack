const jwt = require('jsonwebtoken');
const usersRepo = require('./modules/users/repository');

const JWT_SECRET = process.env.JWT_SECRET || 'replace-this-secret';
const TOKEN_TTL = process.env.JWT_EXPIRES_IN || '60d'; // default 60 days

function createToken(user) {
  if (!user || !user.id) {
    throw new Error('Cannot create token without a user id');
  }
  const payload = {
    sub: user.id,
    role: user.role,
    email: user.email,
    name: user.name,
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

function extractToken(req) {
  const authHeader = req.headers.authorization || '';
  if (typeof authHeader !== 'string') {
    return null;
  }
  const [scheme, token] = authHeader.split(' ');
  if (!token || scheme.toLowerCase() !== 'bearer') {
    return null;
  }
  return token.trim();
}

async function resolveUser(token) {
  if (!token) {
    return null;
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (!payload?.sub) {
      return null;
    }
    return usersRepo.findById(payload.sub);
  } catch (err) {
    console.warn('JWT verification failed', err.message);
    return null;
  }
}

async function authMiddleware(req, _res, next) {
  req.user = await resolveUser(extractToken(req));
  next();
}

module.exports = {
  authMiddleware,
  createToken,
};
