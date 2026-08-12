const express = require('express');
const userController = require('../controllers/user.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { validateBody, updateProfileSchema, updatePhotoSchema } = require('../validators/user.validator');

const router = express.Router();

router.use(requireAuth);

router.get('/me', userController.me);
router.get('/', userController.list); // scope-filtered inside the service — see user.service.js listStaff()
router.get('/:id', userController.getProfile);
router.patch('/:id', validateBody(updateProfileSchema), userController.updateProfile);

// Full ID document number, on demand — the response from every other route
// above masks it. Self-or-admin check + audit log entry happen in the
// service (see user.service.js revealIdDocumentNumber).
router.get('/:id/id-document', userController.revealIdDocument);

// Self-service avatar upload ("press the profile circle") — saves a base64
// data URI directly, separate from the disk-based CV/MC upload system.
// Self-only, enforced in the service (see updateOwnPhoto).
router.post('/:id/photo', validateBody(updatePhotoSchema), userController.updatePhoto);

// CV/MC uploads still go through /api/files/* (see upload.routes.js), which
// sets cvUrl on the user automatically. Profile photos can also still
// arrive that way at registration approval (an "/api/files/:id" path) —
// the two formats coexist on profilePhotoUrl; see AuthImage.js on the
// frontend for how it tells them apart.

module.exports = router;
