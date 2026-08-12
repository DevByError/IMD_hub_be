const express = require('express');
const leaveController = require('../controllers/leave.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { validateBody, submitSchema, decisionSchema, medicalReturnSchema } = require('../validators/leave.validator');

const router = express.Router();

router.use(requireAuth);

router.get('/types', leaveController.listTypes);
router.get('/my-balances', leaveController.myBalances);
// Same balance shape as /my-balances, but for someone else — used by the
// Users page. Permission/visibility is checked inside the service, scoped
// to the target's team (see leave.service.js getBalancesForUser).
router.get('/balances/:userId', leaveController.balancesForUser);
router.get('/my-requests', leaveController.myRequests);
router.post('/requests', validateBody(submitSchema), leaveController.submit);

// Visibility and decision authority are both enforced inside the service via
// requirePermission-equivalent checks (leave.view.* / leave.approve.*),
// scoped per request rather than gated once at the route level — see
// leave.service.js listForReview()/decide().
router.get('/requests/review', leaveController.forReview);
router.post('/requests/:id/approve', validateBody(decisionSchema), leaveController.approve);
router.post('/requests/:id/reject', validateBody(decisionSchema), leaveController.reject);
router.post('/requests/:id/cancel', leaveController.cancel);
// Closes out a Medical Leave that's "awaiting_return" — computes total days,
// draws down the balance, and records any overflow as unpaid. Gated by
// leave.approve.medical, scoped to the applicant's team (see
// leave.service.js setMedicalReturnDate).
router.post('/requests/:id/medical-return', validateBody(medicalReturnSchema), leaveController.recordMedicalReturn);

module.exports = router;
