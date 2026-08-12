const { z } = require('zod');
const { validateBody } = require('./auth.validator');

const approveSchema = z.object({
  roleId: z.string().uuid().optional(),
  teamId: z.string().uuid().optional(),
  scopeType: z.enum(['global', 'team']).optional(),
  validUntil: z.string().datetime().optional(),
  // Employment fields the Manager sets at approval time — not applicant-reported.
  position: z.string().max(150).optional(),
  employmentType: z.enum(['full_time', 'part_time', 'contract']).optional(),
  dateJoined: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  staffId: z.string().max(50).optional(),
});

const rejectSchema = z.object({
  reason: z.string().max(500).optional(),
});

module.exports = { validateBody, approveSchema, rejectSchema };
