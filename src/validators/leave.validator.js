const { z } = require('zod');
const { validateBody } = require('./auth.validator');

const submitSchema = z.object({
  leaveTypeId: z.string().uuid(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate must be YYYY-MM-DD'),
  // Optional: Medical Leave is submitted with a start date only — there's no
  // known end date until the staff member actually comes back (see
  // leave.service.js submitRequest / setMedicalReturnDate). Every other
  // leave type still requires it; that's enforced in the service, not here.
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'endDate must be YYYY-MM-DD').optional(),
  reason: z.string().max(1000).optional(),
  // References to files already uploaded via POST /api/files/mc-document —
  // never a raw URL string from the client (see leave.service.js).
  attachmentFileIds: z.array(z.string().uuid()).default([]),
});

const decisionSchema = z.object({
  comment: z.string().max(1000).optional(),
});

const medicalReturnSchema = z.object({
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'endDate must be YYYY-MM-DD'),
});

module.exports = { validateBody, submitSchema, decisionSchema, medicalReturnSchema };
