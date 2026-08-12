const fs = require('fs');
const { UploadedFile, User, TeamMember } = require('../models');
const { AppError } = require('../middlewares/errorHandler.middleware');
const { hasPermission } = require('./permission.service');
const { recordAudit } = require('./audit.service');

const PURPOSE_TO_USER_FIELD = { cv: 'cvUrl', profile_photo: 'profilePhotoUrl' };

const saveUpload = async ({ file, purpose, ownerUserId, uploader, req, setOnUserField = true }) => {
  if (!file) throw new AppError(400, 'No file uploaded.');

  const owner = await User.findByPk(ownerUserId);
  if (!owner) throw new AppError(404, 'Owner user not found.');

  const record = await UploadedFile.create({
    ownerUserId,
    uploadedBy: uploader.id,
    purpose,
    originalName: file.originalname,
    storedPath: file.path,
    mimeType: file.mimetype,
    sizeBytes: file.size,
  });

  const fileUrl = `/api/files/${record.id}`;

  if (setOnUserField && PURPOSE_TO_USER_FIELD[purpose]) {
    owner[PURPOSE_TO_USER_FIELD[purpose]] = fileUrl;
    await owner.save();
  }

  await recordAudit({
    actorUserId: uploader.id,
    action: 'file.upload',
    targetType: 'UploadedFile',
    targetId: record.id,
    metadata: { purpose, ownerUserId },
    req,
  });

  return { id: record.id, url: fileUrl, purpose, originalName: record.originalName };
};

// Owner can always fetch their own file. user.manage holders (HR/admin) can
// fetch anyone's. MC documents can additionally be fetched by whoever holds
// leave.view.medical scoped to the owner's team — the approvers reviewing
// the attached document for a pending or past request.
const canAccessFile = async (fileRecord, requester) => {
  if (fileRecord.ownerUserId === requester.id) return true;

  if (await hasPermission(requester.id, 'user.manage')) return true;

  if (fileRecord.purpose === 'mc_document') {
    const membership = await TeamMember.findOne({ where: { userId: fileRecord.ownerUserId } });
    const teamId = membership ? membership.teamId : null;
    return hasPermission(requester.id, 'leave.view.medical', { scopeTeamId: teamId });
  }

  return false;
};

const getFileForDownload = async (fileId, requester) => {
  const record = await UploadedFile.findByPk(fileId);
  if (!record) throw new AppError(404, 'File not found.');

  const allowed = await canAccessFile(record, requester);
  if (!allowed) throw new AppError(403, 'You do not have permission to access this file.');

  if (!fs.existsSync(record.storedPath)) throw new AppError(404, 'File is missing from storage.');

  return record;
};

module.exports = { saveUpload, getFileForDownload };
