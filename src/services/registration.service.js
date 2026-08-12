const fs = require('fs');
const { Op } = require('sequelize');
const { RegistrationRequest, User, Role, Team, UserRoleAssignment, TeamMember, UploadedFile, sequelize } = require('../models');
const { AppError } = require('../middlewares/errorHandler.middleware');
const { sendRegistrationApprovedEmail, sendRegistrationRejectedEmail } = require('../utils/email');
const { recordAudit } = require('./audit.service');
const { assertRoleIsAssignable } = require('./role.service');
const { logger } = require('../utils/logger');
const { maskIdNumber } = require('../utils/encryption');

// Same reasoning as user.service.js sanitizeUser(): the idDocumentNumber
// getter on the model decrypts transparently, so anything handed straight to
// res.json() would leak the full plaintext. Mask it here; the only way to
// get the real value is revealIdDocumentNumber() below, which is audited.
const maskRequest = (request) => {
  const plain = request.toJSON ? request.toJSON() : request;
  return { ...plain, idDocumentNumber: maskIdNumber(plain.idDocumentNumber) };
};

const listPending = async () => {
  const requests = await RegistrationRequest.findAll({
    where: { status: 'pending' },
    attributes: { exclude: ['passwordHash'] },
    order: [['createdAt', 'ASC']],
  });
  return requests.map(maskRequest);
};

// Old records — already accepted or denied, and by whom. Separate from
// listPending() above (which is the action queue); this is a read-only
// history table, so it pulls in the reviewer/requestedRole/requestedTeam
// names directly rather than making the frontend cross-reference ids
// against separate /users, /roles, /teams calls the way the pending list
// does today.
const listReviewed = async () => {
  const requests = await RegistrationRequest.findAll({
    where: { status: { [Op.in]: ['approved', 'rejected'] } },
    attributes: { exclude: ['passwordHash'] },
    include: [
      { model: User, as: 'reviewer', attributes: ['id', 'fullName', 'email'] },
      { model: Role, as: 'requestedRole', attributes: ['id', 'name'] },
      { model: Team, as: 'requestedTeam', attributes: ['id', 'name'] },
    ],
    order: [['reviewedAt', 'DESC']],
  });
  return requests.map(maskRequest);
};

// Full ID document number, on demand — listPending()/listReviewed() above
// always mask it. Permission is already enforced at the router level
// (registration.approve, same as every other route in this file); this just
// adds the audit trail for the one action that actually exposes the value.
const revealIdDocumentNumber = async (requestId, reviewer, req) => {
  const request = await RegistrationRequest.findByPk(requestId, { attributes: ['id', 'idDocumentNumber'] });
  if (!request) throw new AppError(404, 'Registration request not found.');

  await recordAudit({
    actorUserId: reviewer.id,
    action: 'registration.reveal_id_document',
    targetType: 'RegistrationRequest',
    targetId: requestId,
    req,
  });

  return { idDocumentNumber: request.idDocumentNumber || null };
};

// Internal getById (used by approve/reject, which need passwordHash to
// create the User) — deliberately NOT attribute-excluded. listPending()
// above is what the API actually returns to callers.
const getById = async (id) => {
  const request = await RegistrationRequest.findByPk(id);
  if (!request) throw new AppError(404, 'Registration request not found.');
  return request;
};

const approve = async (
  requestId,
  { roleId, teamId, scopeType, validUntil, position, employmentType, dateJoined, staffId },
  reviewer,
  req
) => {
  const request = await getById(requestId);
  if (request.status !== 'pending') throw new AppError(409, 'This request has already been reviewed.');

  const finalRoleId = roleId || request.requestedRoleId;
  const finalTeamId = teamId || request.requestedTeamId;
  if (!finalRoleId) throw new AppError(400, 'A role must be specified to approve this request.');

  await assertRoleIsAssignable(finalRoleId);

  const resolvedScopeType = scopeType || (finalTeamId ? 'team' : 'global');
  if (resolvedScopeType === 'team' && !finalTeamId) {
    throw new AppError(400, 'A team is required for a team-scoped role assignment.');
  }

  if (staffId) {
    const staffIdTaken = await User.findOne({ where: { staffId } });
    if (staffIdTaken) throw new AppError(409, 'That Staff ID is already in use.');
  }

  const user = await sequelize.transaction(async (t) => {
    const newUser = await User.create(
      {
        fullName: request.fullName,
        email: request.email,
        phoneNumber: request.phoneNumber,
        passwordHash: request.passwordHash,
        status: 'active',
        // Applicant-provided personal/identity fields, carried over as-is.
        idDocumentType: request.idDocumentType,
        idDocumentNumber: request.idDocumentNumber,
        dateOfBirth: request.dateOfBirth,
        address: request.address,
        gender: request.gender,
        nationality: request.nationality,
        nextOfKinName: request.nextOfKinName,
        nextOfKinContact: request.nextOfKinContact,
        // Employment fields — Manager-provided at approval, not applicant-reported.
        position: position || null,
        employmentType: employmentType || null,
        dateJoined: dateJoined || null,
        staffId: staffId || null,
      },
      { transaction: t }
    );

    // Hand the already-uploaded CV/photo (stored during registration) over
    // to the new account through the same secure uploaded_files record the
    // rest of the app uses, rather than exposing the raw disk path.
    if (request.cvStoredPath) {
      const cvRecord = await UploadedFile.create(
        {
          ownerUserId: newUser.id,
          uploadedBy: newUser.id,
          purpose: 'cv',
          originalName: request.cvOriginalName,
          storedPath: request.cvStoredPath,
          mimeType: request.cvMimeType,
          sizeBytes: request.cvSizeBytes,
        },
        { transaction: t }
      );
      newUser.cvUrl = `/api/files/${cvRecord.id}`;
    }

    if (request.profilePhotoStoredPath) {
      const photoRecord = await UploadedFile.create(
        {
          ownerUserId: newUser.id,
          uploadedBy: newUser.id,
          purpose: 'profile_photo',
          originalName: request.profilePhotoOriginalName,
          storedPath: request.profilePhotoStoredPath,
          mimeType: request.profilePhotoMimeType,
          sizeBytes: request.profilePhotoSizeBytes,
        },
        { transaction: t }
      );
      newUser.profilePhotoUrl = `/api/files/${photoRecord.id}`;
    }

    if (request.cvStoredPath || request.profilePhotoStoredPath) {
      await newUser.save({ transaction: t });
    }

    await UserRoleAssignment.create(
      {
        userId: newUser.id,
        roleId: finalRoleId,
        scopeType: resolvedScopeType,
        scopeId: resolvedScopeType === 'team' ? finalTeamId : null,
        grantedBy: reviewer.id,
        validUntil: validUntil || null,
        status: 'active',
      },
      { transaction: t }
    );

    if (finalTeamId) {
      await TeamMember.create({ teamId: finalTeamId, userId: newUser.id }, { transaction: t });
    }

    request.status = 'approved';
    request.reviewedBy = reviewer.id;
    request.reviewedAt = new Date();
    await request.save({ transaction: t });

    return newUser;
  });

  await recordAudit({
    actorUserId: reviewer.id,
    action: 'registration.approve',
    targetType: 'User',
    targetId: user.id,
    metadata: { requestId, roleId: finalRoleId, teamId: finalTeamId },
    req,
  });

  sendRegistrationApprovedEmail(user.email, {
    fullName: user.fullName,
    loginUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  }).catch((err) => logger.error(`Failed to send approval email: ${err.message}`));

  return user;
};

const reject = async (requestId, reason, reviewer, req) => {
  const request = await getById(requestId);
  if (request.status !== 'pending') throw new AppError(409, 'This request has already been reviewed.');

  request.status = 'rejected';
  request.reviewedBy = reviewer.id;
  request.reviewedAt = new Date();
  request.rejectionReason = reason || null;
  await request.save();

  // Clean up any CV/photo uploaded during signup — it never got attached to
  // a real account, no reason to keep it on disk.
  for (const filePath of [request.cvStoredPath, request.profilePhotoStoredPath]) {
    if (filePath) fs.unlink(filePath, (err) => err && logger.error(`Failed to remove rejected upload ${filePath}: ${err.message}`));
  }

  await recordAudit({
    actorUserId: reviewer.id,
    action: 'registration.reject',
    targetType: 'RegistrationRequest',
    targetId: request.id,
    metadata: { reason },
    req,
  });

  sendRegistrationRejectedEmail(request.email, { fullName: request.fullName, reason }).catch((err) =>
    logger.error(`Failed to send rejection email: ${err.message}`)
  );

  return request;
};

module.exports = { listPending, listReviewed, getById, approve, reject, revealIdDocumentNumber };
