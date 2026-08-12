const express = require('express');
const teamController = require('../controllers/team.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/permission.middleware');
const { validateBody, createTeamSchema, setStaffTeamSchema } = require('../validators/team.validator');

const router = express.Router();

// Public — must come before requireAuth below. Used by the registration
// form's team dropdown, id/name only (see team.service.js listTeamsPublic).
router.get('/public', teamController.listPublic);

router.use(requireAuth);

router.get('/', teamController.list); // any authenticated user can see the team list
router.get('/:teamId', teamController.get);
router.post('/', requirePermission('team.create'), validateBody(createTeamSchema), teamController.create);
router.delete('/:teamId', requirePermission('team.create'), teamController.remove);

// team.manage is checked scoped to :teamId — a Team Admin whose assignment
// is scoped to this specific team passes; a global grant (Manager/Dept Admin) passes too.
router.post(
  '/:teamId/members',
  requirePermission('team.manage', { scopeParam: 'teamId' }),
  validateBody(setStaffTeamSchema),
  teamController.addMember
);
router.delete(
  '/:teamId/members/:userId',
  requirePermission('team.manage', { scopeParam: 'teamId' }),
  teamController.removeMember
);

module.exports = router;
