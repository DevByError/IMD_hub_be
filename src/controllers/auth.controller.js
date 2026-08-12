const authService = require('../services/auth.service');
const { asyncHandler } = require('../utils/asyncHandler');

const REFRESH_COOKIE_NAME = 'imd_refresh_token';

const refreshCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  domain: process.env.COOKIE_DOMAIN || undefined,
  path: '/api/auth',
  maxAge: authService.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
});

const setRefreshCookie = (res, token) => res.cookie(REFRESH_COOKIE_NAME, token, refreshCookieOptions());
const clearRefreshCookie = (res) => res.clearCookie(REFRESH_COOKIE_NAME, { ...refreshCookieOptions(), maxAge: undefined });

const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body, req.files);
  res.status(201).json({ message: 'Registration request submitted. An administrator will review it.', request: result });
});

const login = asyncHandler(async (req, res) => {
  const { user, accessToken, refreshToken } = await authService.login(req.body, req.headers['user-agent'], req);
  setRefreshCookie(res, refreshToken);
  res.json({
    accessToken,
    user: { id: user.id, fullName: user.fullName, email: user.email, status: user.status },
  });
});

// Note: this deliberately never responds with a 401, even when there's no
// valid session. It's used as a silent "am I already logged in?" check on
// every page load (see AuthContext), including public pages where a fresh
// visitor has no session yet — that's an expected outcome, not an error, so
// it's reported as `{ authenticated: false }` on a normal 200 rather than an
// HTTP error status. That keeps the browser's own network-failure logging
// from flagging it as a failed request. Genuine unexpected errors (e.g. a
// DB outage) still propagate to the error handler as usual.
const refresh = async (req, res, next) => {
  try {
    const rawToken = req.cookies?.[REFRESH_COOKIE_NAME];
    const { user, accessToken, refreshToken } = await authService.refresh(rawToken, req.headers['user-agent']);
    setRefreshCookie(res, refreshToken);
    return res.json({ authenticated: true, accessToken, user: { id: user.id, fullName: user.fullName, email: user.email } });
  } catch (err) {
    if (err.statusCode === 401) {
      clearRefreshCookie(res);
      return res.json({ authenticated: false });
    }
    return next(err);
  }
};

const logout = asyncHandler(async (req, res) => {
  const rawToken = req.cookies?.[REFRESH_COOKIE_NAME];
  await authService.logout(rawToken, req.user?.id, req);
  clearRefreshCookie(res);
  res.status(204).send();
});

const forgotPassword = asyncHandler(async (req, res) => {
  await authService.forgotPassword(req.body.email, req);
  // Same response whether or not the email exists — see auth.service.js.
  res.json({ message: 'If an account exists for this email, a verification code has been sent.' });
});

const verifyOtp = asyncHandler(async (req, res) => {
  const result = await authService.verifyOtp(req.body.email, req.body.otp);
  res.json({ message: 'Code verified.', ...result });
});

const resetPassword = asyncHandler(async (req, res) => {
  await authService.resetPassword(req.body.resetToken, req.body.newPassword, req);
  res.json({ message: 'Password reset successful. Please log in with your new password.' });
});

module.exports = { register, login, refresh, logout, forgotPassword, verifyOtp, resetPassword };
