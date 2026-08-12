const { z } = require('zod');
const { validateBody } = require('./auth.validator');

const createRoleSchema = z.object({
  name: z.string().min(2).max(100),
  permissionIds: z.array(z.string().uuid()).default([]),
});

const updatePermissionsSchema = z.object({
  permissionIds: z.array(z.string().uuid()).default([]),
});

const createAssignmentSchema = z
  .object({
    userId: z.string().uuid(),
    roleId: z.string().uuid(),
    scopeType: z.enum(['global', 'team']).default('global'),
    scopeId: z.string().uuid().optional(),
    validUntil: z.string().datetime().optional(),
  })
  .refine((data) => data.scopeType !== 'team' || Boolean(data.scopeId), {
    message: 'scopeId is required when scopeType is "team".',
    path: ['scopeId'],
  });

module.exports = { validateBody, createRoleSchema, updatePermissionsSchema, createAssignmentSchema };
