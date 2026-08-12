const express = require('express');
const uploadController = require('../controllers/upload.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { uploadCv, uploadProfilePhoto, uploadMcDocument, verifyUploadedFileContent } = require('../middlewares/upload.middleware');

const router = express.Router();

router.use(requireAuth);

router.post('/cv', uploadCv, verifyUploadedFileContent, uploadController.uploadCv);
router.post('/profile-photo', uploadProfilePhoto, verifyUploadedFileContent, uploadController.uploadProfilePhoto);
router.post('/mc-document', uploadMcDocument, verifyUploadedFileContent, uploadController.uploadMcDocument);
router.get('/:id', uploadController.download);

module.exports = router;
