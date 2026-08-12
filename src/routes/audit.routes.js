const express = require('express');
const auditController = require('../controllers/audit.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/permission.middleware');

const router = express.Router();

// The whole router is gated by audit.view — Manager holds it by default,
// Department Admin is granted it too (see seed-role-permissions.js). Nothing
// here needs a scope check beyond that: audit visibility is all-or-nothing,
// not team-scoped, since there's no per-team notion of "your own" audit log.
router.use(requireAuth, requirePermission('audit.view'));

router.get('/', auditController.list);

module.exports = router;
