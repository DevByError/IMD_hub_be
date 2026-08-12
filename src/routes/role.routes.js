const express = require('express');
const roleController = require('../controllers/role.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { requirePermission, requireAnyPermission } = require('../middlewares/permission.middleware');
const {
  validateBody,
  createRoleSchema,
  updatePermissionsSchema,
  createAssignmentSchema,
} = require('../validators/role.validator');

const router = express.Router();

router.use(requireAuth);

// Narrow read-only list (id/name, assignable roles only) for whoever needs
// to pick a role on a form — registration approval (registration.approve)
// and day-to-day assignment (role.assign) — without exposing the full
// role/permission editor those people shouldn't have access to. Must come
// before the role.create-gated GET '/' below.
router.get('/assignable', requireAnyPermission(['role.create', 'role.assign', 'registration.approve']), roleController.listAssignableRoles);

// Everything else here is gated by role.create / role.assign — the two
// non-delegable permissions that, per the spec, only the seeded Department
// Manager account will ever hold.
router.get('/', requirePermission('role.create'), roleController.listRoles);
router.get('/permissions', requirePermission('role.create'), roleController.listPermissions);
router.post('/', requirePermission('role.create'), validateBody(createRoleSchema), roleController.createRole);
router.patch(
  '/:id/permissions',
  requirePermission('role.create'),
  validateBody(updatePermissionsSchema),
  roleController.updateRolePermissions
);
router.delete('/:id', requirePermission('role.create'), roleController.deleteRole);

router.get('/assignments', requirePermission('role.assign'), roleController.listAssignments);
router.get('/assignments/history', requirePermission('role.assign'), roleController.listAssignmentHistory);
router.post(
  '/assignments',
  requirePermission('role.assign'),
  validateBody(createAssignmentSchema),
  roleController.createAssignment
);
router.delete('/assignments/:id', requirePermission('role.assign'), roleController.revokeAssignment);

module.exports = router;
