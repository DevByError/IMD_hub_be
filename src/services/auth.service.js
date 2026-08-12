const bcrypt = require('bcrypt');
const { Op } = require('sequelize');
const { User, RegistrationRequest, RefreshToken, OtpVerification, ResetToken, Role, sequelize } = require('../models');
const { AppError } = require('../middlewares/errorHandler.middleware');
const { signAccessToken, generateOpaqueToken, hashOpaqueToken } = require('../utils/tokens');
const { generateOtp, hashOtp, compareOtp, OTP_TTL_MINUTES, MAX_OTP_ATTEMPTS } = require('../utils/otp');
const { sendOtpEmail, sendPasswordChangedEmail } = require('../utils/email');
const { logger } = require('../utils/logger');
const { recordAudit } = require('./audit.service');

const PASSWORD_MIN_LENGTH = 8;
const REFRESH_TOKEN_TTL_DAYS = 7;
const RESET_TOKEN_TTL_MINUTES = 10;

const assertPasswordPolicy = (password) => {
  if (
    !password ||
    password.length < PASSWORD_MIN_LENGTH ||
    !/[a-zA-Z]/.test(password) ||
    !/[0-9]/.test(password)
  ) {
    throw new AppError(400, `Password must be at least ${PASSWORD_MIN_LENGTH} characters and include a letter and a number.`);
  }
};

// --- Registration -----------------------------------------------------

const register = async (fields, files = {}) => {
  const {
    fullName, email, password, phoneNumber, requestedRoleId, requestedTeamId,
    idDocumentType, idDocumentNumber, dateOfBirth, address, gender, nationality,
    nextOfKinName, nextOfKinContact,
  } = fields;

  assertPasswordPolicy(password);

  const existingUser = await User.findOne({ where: { email } });
  if (existingUser) throw new AppError(409, 'An account with this email already exists.');

  const existingRequest = await RegistrationRequest.findOne({ where: { email, status: 'pending' } });
  if (existingRequest) throw new AppError(409, 'A registration request for this email is already pending.');

  const passwordHash = await bcrypt.hash(password, 12);

  const cvFile = files.cv?.[0];
  const profilePhotoFile = files.profilePhoto?.[0];

  // Files arrive via req.files (multer), outside the zod-validated body, so
  // their required-ness has to be checked here rather than in the schema.
  if (!cvFile) throw new AppError(400, 'CV is required.');
  if (!profilePhotoFile) throw new AppError(400, 'Profile photo is required.');

  const request = await RegistrationRequest.create({
    fullName,
    email,
    phoneNumber,
    passwordHash,
    requestedRoleId: requestedRoleId || null,
    requestedTeamId: requestedTeamId || null,
    status: 'pending',
    idDocumentType: idDocumentType || null,
    idDocumentNumber: idDocumentNumber || null,
    dateOfBirth: dateOfBirth || null,
    address: address || null,
    gender: gender || null,
    nationality: nationality || null,
    nextOfKinName: nextOfKinName || null,
    nextOfKinContact: nextOfKinContact || null,
    ...(cvFile
      ? { cvOriginalName: cvFile.originalname, cvStoredPath: cvFile.path, cvMimeType: cvFile.mimetype, cvSizeBytes: cvFile.size }
      : {}),
    ...(profilePhotoFile
      ? {
          profilePhotoOriginalName: profilePhotoFile.originalname,
          profilePhotoStoredPath: profilePhotoFile.path,
          profilePhotoMimeType: profilePhotoFile.mimetype,
          profilePhotoSizeBytes: profilePhotoFile.size,
        }
      : {}),
  });

  return { id: request.id, status: request.status };
};

// --- Login / sessions ---------------------------------------------------

const issueSession = async (user, deviceInfo) => {
  const accessToken = signAccessToken(user);

  const refreshTokenRaw = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

  await RefreshToken.create({
    userId: user.id,
    tokenHash: hashOpaqueToken(refreshTokenRaw),
    expiresAt,
    deviceInfo: deviceInfo || null,
  });

  return { accessToken, refreshToken: refreshTokenRaw, refreshTokenExpiresAt: expiresAt };
};

const login = async ({ email, password }, deviceInfo, req) => {
  const user = await User.findOne({ where: { email } });
  // Same error for "no such user" and "wrong password" — don't tell an
  // attacker which part was wrong. The audit trail still distinguishes them
  // internally (metadata.reason), since that's exactly the forensic detail
  // you want when reviewing failed-login patterns later — it just never
  // reaches the HTTP response.
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    await recordAudit({
      actorUserId: user ? user.id : null,
      action: 'auth.login_failed',
      targetType: 'User',
      targetId: user ? user.id : null,
      metadata: { email, reason: user ? 'bad_password' : 'no_such_user' },
      req,
    });
    throw new AppError(401, 'Invalid email or password.');
  }
  if (user.status !== 'active') {
    await recordAudit({
      actorUserId: user.id,
      action: 'auth.login_failed',
      targetType: 'User',
      targetId: user.id,
      metadata: { email, reason: 'account_not_active' },
      req,
    });
    throw new AppError(403, 'Your account is not active yet. Contact your administrator.');
  }

  await recordAudit({ actorUserId: user.id, action: 'auth.login', targetType: 'User', targetId: user.id, req });

  return { user, ...(await issueSession(user, deviceInfo)) };
};

const refresh = async (rawRefreshToken, deviceInfo) => {
  if (!rawRefreshToken) throw new AppError(401, 'Not authenticated.');

  const tokenHash = hashOpaqueToken(rawRefreshToken);
  const existing = await RefreshToken.findOne({ where: { tokenHash } });

  if (!existing || existing.revokedAt || existing.expiresAt < new Date()) {
    throw new AppError(401, 'Session expired. Please log in again.');
  }

  const user = await User.findByPk(existing.userId);
  if (!user || user.status !== 'active') throw new AppError(401, 'Account is not active.');

  // Rotate: revoke the used refresh token, issue a fresh pair. If a revoked
  // token is ever presented again, that's a strong signal of token theft —
  // worth alerting/logging in a production build.
  existing.revokedAt = new Date();
  await existing.save();

  return { user, ...(await issueSession(user, deviceInfo)) };
};

const logout = async (rawRefreshToken, actorUserId, req) => {
  if (!rawRefreshToken) return;
  const tokenHash = hashOpaqueToken(rawRefreshToken);
  await RefreshToken.update({ revokedAt: new Date() }, { where: { tokenHash, revokedAt: null } });
  if (actorUserId) {
    await recordAudit({ actorUserId, action: 'auth.logout', targetType: 'User', targetId: actorUserId, req });
  }
};

// --- Password reset (three-step, token-gated) ---------------------------

const forgotPassword = async (email, req) => {
  const user = await User.findOne({ where: { email } });

  // Always return the same generic response whether or not the account
  // exists, to avoid leaking which emails are registered. Still worth an
  // audit entry either way — a burst of "unknown email" requests against
  // real-looking addresses is exactly the pattern you'd want to notice.
  if (!user) {
    logger.info(`Password reset requested for unknown email: ${email}`);
    await recordAudit({
      actorUserId: null,
      action: 'auth.password_reset_requested',
      metadata: { email, reason: 'no_such_user' },
      req,
    });
    return;
  }

  const otp = generateOtp();
  const otpHash = await hashOtp(otp);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  await OtpVerification.create({
    userId: user.id,
    otpHash,
    purpose: 'password_reset',
    expiresAt,
  });

  await recordAudit({
    actorUserId: user.id,
    action: 'auth.password_reset_requested',
    targetType: 'User',
    targetId: user.id,
    req,
  });

  await sendOtpEmail(email, otp, { minutesValid: OTP_TTL_MINUTES });
};

const verifyOtp = async (email, otp) => {
  const user = await User.findOne({ where: { email } });
  if (!user) throw new AppError(400, 'Invalid or expired code.');

  const record = await OtpVerification.findOne({
    where: { userId: user.id, purpose: 'password_reset', consumedAt: null },
    order: [['createdAt', 'DESC']],
  });

  if (!record || record.expiresAt < new Date()) {
    throw new AppError(400, 'Invalid or expired code.');
  }
  if (record.attempts >= MAX_OTP_ATTEMPTS) {
    throw new AppError(429, 'Too many incorrect attempts. Please request a new code.');
  }

  const matches = await compareOtp(otp, record.otpHash);
  if (!matches) {
    record.attempts += 1;
    await record.save();
    throw new AppError(400, 'Invalid or expired code.');
  }

  // Consuming the OTP here — and requiring the resulting reset token for the
  // final step — is what stops someone from skipping straight to
  // reset-password with a guessed code.
  record.consumedAt = new Date();
  await record.save();

  const resetTokenRaw = generateOpaqueToken();
  await ResetToken.create({
    userId: user.id,
    tokenHash: hashOpaqueToken(resetTokenRaw),
    expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000),
  });

  return { resetToken: resetTokenRaw, expiresIn: RESET_TOKEN_TTL_MINUTES * 60 };
};

const resetPassword = async (resetTokenRaw, newPassword, req) => {
  assertPasswordPolicy(newPassword);

  const tokenHash = hashOpaqueToken(resetTokenRaw);
  const record = await ResetToken.findOne({ where: { tokenHash, consumedAt: null } });

  if (!record || record.expiresAt < new Date()) {
    throw new AppError(400, 'This reset link has expired. Please start again.');
  }

  const user = await User.findByPk(record.userId);
  if (!user) throw new AppError(400, 'This reset link is no longer valid.');

  await sequelize.transaction(async (t) => {
    user.passwordHash = await bcrypt.hash(newPassword, 12);
    user.tokenValidAfter = new Date(); // invalidates every access token already issued
    await user.save({ transaction: t });

    record.consumedAt = new Date();
    await record.save({ transaction: t });

    // Kill every existing session for this account.
    await RefreshToken.update(
      { revokedAt: new Date() },
      { where: { userId: user.id, revokedAt: null }, transaction: t }
    );
  });

  await recordAudit({
    actorUserId: user.id,
    action: 'auth.password_reset_completed',
    targetType: 'User',
    targetId: user.id,
    req,
  });

  await sendPasswordChangedEmail(user.email).catch((err) => logger.error(`Failed to send password-changed email: ${err.message}`));
};

module.exports = { register, login, refresh, logout, forgotPassword, verifyOtp, resetPassword, REFRESH_TOKEN_TTL_DAYS };
