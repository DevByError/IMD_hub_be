const { z } = require('zod');
const { validateBody } = require('./auth.validator');

const createTeamSchema = z.object({
  name: z.string().min(2).max(100),
});

const setStaffTeamSchema = z.object({
  userId: z.string().uuid(),
});

module.exports = { validateBody, createTeamSchema, setStaffTeamSchema };
