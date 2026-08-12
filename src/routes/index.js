const express = require('express');
const authRoutes = require('./auth.routes');
const roleRoutes = require('./role.routes');
const teamRoutes = require('./team.routes');
const userRoutes = require('./user.routes');
const registrationRoutes = require('./registration.routes');
const leaveRoutes = require('./leave.routes');
const uploadRoutes = require('./upload.routes');
const publicHolidayRoutes = require('./publicHoliday.routes');
const auditRoutes = require('./audit.routes');
// System Updates is no longer a backend-managed feature — see
// migration 20250101000029-drop-system-updates.js and
// fe/lib/systemUpdate.config.js for the replacement (a static,
// developer-edited config with client-side per-user acknowledgment).

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/roles', roleRoutes);
router.use('/teams', teamRoutes);
router.use('/users', userRoutes);
router.use('/registration-requests', registrationRoutes);
router.use('/leave', leaveRoutes);
router.use('/files', uploadRoutes);
router.use('/public-holidays', publicHolidayRoutes);
router.use('/audit-logs', auditRoutes);

module.exports = router;
