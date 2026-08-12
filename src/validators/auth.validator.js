const { z } = require('zod');

// Sent as multipart/form-data (it carries CV + profile photo files), so every
// field arrives as a string — dates included, validated as YYYY-MM-DD.
// Deliberately excludes: status (system-controlled — a request is always
// "pending" until the Manager decides), and employment fields (position,
// employmentType, dateJoined, staffId) which the Manager sets at approval,
// not the applicant. See registration.validator.js for those.
//
// Personal/identity fields are required, not optional — the frontend form
// enforces this too, but that's bypassable by anyone calling the API
// directly, so the real constraint has to live here. Only phoneNumber and
// the team/role request stay optional. CV/profile-photo presence is checked
// in auth.service.js since files arrive via req.files, not this body.
const registerSchema = z.object({
  fullName: z.string().min(2).max(150),
  email: z.string().email(),
  password: z.string().min(8),
  phoneNumber: z.string().max(30).optional(),
  requestedRoleId: z.string().uuid().optional(),
  requestedTeamId: z.string().uuid().optional(),

  idDocumentType: z.enum(['passport', 'ic']),
  idDocumentNumber: z.string().min(1).max(50),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  address: z.string().min(1).max(500),
  gender: z.enum(['male', 'female', 'other']),
  nationality: z.string().min(1).max(100),
  nextOfKinName: z.string().min(1).max(150),
  nextOfKinContact: z.string().min(1).max(30),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const verifyOtpSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6),
});

const resetPasswordSchema = z.object({
  resetToken: z.string().min(10),
  newPassword: z.string().min(8),
});

// Generic middleware factory: validate req.body against a zod schema.
const validateBody = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: 'ValidationError',
      message: 'Invalid request data.',
      details: result.error.flatten().fieldErrors,
    });
  }
  req.body = result.data;
  next();
};

module.exports = {
  validateBody,
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  verifyOtpSchema,
  resetPasswordSchema,
};
