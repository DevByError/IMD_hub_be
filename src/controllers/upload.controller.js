const path = require('path');
const uploadService = require('../services/upload.service');
const { hasPermission } = require('../services/permission.service');
const { asyncHandler } = require('../utils/asyncHandler');
const { AppError } = require('../middlewares/errorHandler.middleware');

const makeUploadHandler = (purpose) =>
  asyncHandler(async (req, res) => {
    const ownerUserId = req.body.ownerUserId || req.user.id;

    // Only an admin (user.manage) can upload a file on someone else's behalf.
    if (ownerUserId !== req.user.id) {
      const allowed = await hasPermission(req.user.id, 'user.manage');
      if (!allowed) throw new AppError(403, 'You can only upload files for your own profile.');
    }

    const result = await uploadService.saveUpload({ file: req.file, purpose, ownerUserId, uploader: req.user, req });
    res.status(201).json({ message: 'File uploaded.', file: result });
  });

const uploadCv = makeUploadHandler('cv');
const uploadProfilePhoto = makeUploadHandler('profile_photo');
const uploadMcDocument = makeUploadHandler('mc_document');

const download = asyncHandler(async (req, res) => {
  const record = await uploadService.getFileForDownload(req.params.id, req.user);
  res.setHeader('Content-Type', record.mimeType);
  res.setHeader('Content-Disposition', `inline; filename="${record.originalName}"`);
  res.sendFile(path.resolve(record.storedPath));
});

module.exports = { uploadCv, uploadProfilePhoto, uploadMcDocument, download };
