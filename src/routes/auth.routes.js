const express = require('express');
const authController = require('../controllers/auth.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { loginLimiter, forgotPasswordLimiter, otpVerifyLimiter, registerLimiter } = require('../middlewares/rateLimiter.middleware');
const { uploadRegistrationDocs, verifyUploadedFileContent } = require('../middlewares/upload.middleware');
const {
  validateBody,
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  verifyOtpSchema,
  resetPasswordSchema,
} = require('../validators/auth.validator');

const router = express.Router();

// multipart/form-data: text fields + optional "cv" and "profilePhoto" files.
// Order matters — multer must parse the body (and write files to disk)
// before verifyUploadedFileContent can inspect them, and both must run
// before zod validates the rest of the body.
router.post(
  '/register',
  registerLimiter,
  uploadRegistrationDocs,
  verifyUploadedFileContent,
  validateBody(registerSchema),
  authController.register
);
router.post('/login', loginLimiter, validateBody(loginSchema), authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', requireAuth, authController.logout);

router.post('/forgot-password', forgotPasswordLimiter, validateBody(forgotPasswordSchema), authController.forgotPassword);
router.post('/verify-otp', otpVerifyLimiter, validateBody(verifyOtpSchema), authController.verifyOtp);
router.post('/reset-password', otpVerifyLimiter, validateBody(resetPasswordSchema), authController.resetPassword);

module.exports = router;
