const { z } = require('zod');
const { validateBody } = require('./auth.validator');

const createHolidaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  name: z.string().min(1).max(200),
});

module.exports = { validateBody, createHolidaySchema };
