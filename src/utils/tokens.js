const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET; // not used to sign the refresh token itself (it's opaque), kept for future use / rotation-key separation
const ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '15m';

if (!ACCESS_SECRET || !REFRESH_SECRET) {
  throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be set.');
}

const signAccessToken = (user) =>
  jwt.sign({ sub: user.id }, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES_IN });

const verifyAccessToken = (token) => jwt.verify(token, ACCESS_SECRET);

// Refresh tokens are opaque random strings, not JWTs — the server is the
// only party that needs to look them up, and an opaque token can't be
// inspected/tampered with client-side the way a JWT payload can be.
const generateOpaqueToken = () => crypto.randomBytes(48).toString('hex');

const hashOpaqueToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

module.exports = { signAccessToken, verifyAccessToken, generateOpaqueToken, hashOpaqueToken };
