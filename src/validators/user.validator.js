const { z } = require('zod');
const { validateBody } = require('./auth.validator');

// Deliberately excludes email (needs a separate verified-change flow) and
// staffId/status (identity/access fields — always admin-controlled).
// Which of these actually apply to a given request is enforced server-side
// in user.service.js based on who's asking (self vs. user.manage/team.manage),
// not by this shape alone.
const updateProfileSchema = z.object({
  phoneNumber: z.string().max(30).optional(),
  address: z.string().max(500).optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  nextOfKinName: z.string().max(150).optional(),
  nextOfKinContact: z.string().max(30).optional(),

  fullName: z.string().min(2).max(150).optional(),
  idDocumentType: z.enum(['passport', 'ic']).optional(),
  idDocumentNumber: z.string().max(50).optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  position: z.string().max(150).optional(),
  employmentType: z.enum(['full_time', 'part_time', 'contract']).optional(),
  dateJoined: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  nationality: z.string().max(100).optional(),
  staffId: z.string().max(50).optional(),
  status: z.enum(['pending', 'active', 'inactive', 'suspended']).optional(),
  staffStatus: z.enum(['active', 'inactive']).optional(),
  lastAppraisalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// Loose shape check only — mime allow-list and the real size cap are
// enforced in user.service.js (the source of truth for both), since a data
// URI's total length varies with image content and re-checking exact byte
// size here would just duplicate that logic.
const updatePhotoSchema = z.object({
  imageBase64: z.string().startsWith('data:image/').max(4 * 1024 * 1024),
});

module.exports = { validateBody, updateProfileSchema, updatePhotoSchema };
