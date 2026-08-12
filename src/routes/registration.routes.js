const express = require('express');
const registrationController = require('../controllers/registration.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/permission.middleware');
const { validateBody, approveSchema, rejectSchema } = require('../validators/registration.validator');

const router = express.Router();

router.use(requireAuth, requirePermission('registration.approve'));

router.get('/', registrationController.list);
router.get('/reviewed', registrationController.listReviewed);
router.get('/:id/id-document', registrationController.revealIdDocument);
router.post('/:id/approve', validateBody(approveSchema), registrationController.approve);
router.post('/:id/reject', validateBody(rejectSchema), registrationController.reject);

module.exports = router;
