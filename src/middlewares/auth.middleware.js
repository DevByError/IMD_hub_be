const { verifyAccessToken } = require('../utils/tokens');
const { AppError } = require('./errorHandler.middleware');
const { User } = require('../models');

// Verifies the access token and attaches the current user to req.user.
// This only establishes *authentication* (who you are) — every route that
// needs *authorization* (what you're allowed to do) must additionally go
// through requirePermission() from permission.middleware.js. Never treat
// "authenticated" as "authorized" in this app.
const requireAuth = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new AppError(401, 'Not authenticated.');

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch (err) {
      throw new AppError(401, 'Invalid or expired session.');
    }

    const user = await User.findByPk(payload.sub);
    if (!user || user.status !== 'active') {
      throw new AppError(401, 'Account is not active.');
    }

    // If the token was issued before the user's last password reset /
    // forced logout, reject it even though it hasn't expired yet.
    if (user.tokenValidAfter && payload.iat * 1000 < new Date(user.tokenValidAfter).getTime()) {
      throw new AppError(401, 'Session has been invalidated. Please log in again.');
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { requireAuth };
