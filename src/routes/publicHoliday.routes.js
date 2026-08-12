const express = require('express');
const controller = require('../controllers/publicHoliday.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/permission.middleware');
const { validateBody, createHolidaySchema } = require('../validators/publicHoliday.validator');

const router = express.Router();

router.use(requireAuth);

// Any authenticated user can see the calendar (useful context while applying
// for leave); adding/removing dates is gated by leave.policy.manage, which —
// per the confirmed setup — only the Manager holds by default, but is
// delegable to any role via Roles & Permissions.
router.get('/', controller.list);
router.post('/', requirePermission('leave.policy.manage'), validateBody(createHolidaySchema), controller.create);
router.delete('/:id', requirePermission('leave.policy.manage'), controller.remove);

module.exports = router;
