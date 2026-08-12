const rateLimit = require('express-rate-limit');

// Per-IP limits. These are a starting point — pair with the per-account
// attempt counters in auth.service.js (login lockout, OTP attempts) since
// IP-based limiting alone doesn't stop a distributed attempt.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'TooManyRequests', message: 'Too many login attempts. Please try again later.' },
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'TooManyRequests', message: 'Too many reset requests. Please try again later.' },
});

const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'TooManyRequests', message: 'Too many attempts. Please try again later.' },
});

// Registration is public and now accepts file uploads + a full set of PII —
// worth a tighter cap than login to discourage spam submissions/disk abuse.
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'TooManyRequests', message: 'Too many registration attempts. Please try again later.' },
});

module.exports = { loginLimiter, forgotPasswordLimiter, otpVerifyLimiter, registerLimiter };
