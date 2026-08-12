const { Op } = require('sequelize');
const {
  LeaveType,
  LeavePolicy,
  LeaveBalance,
  LeaveRequest,
  LeaveAttachment,
  PublicHoliday,
  User,
  TeamMember,
  Notification,
  UploadedFile,
  sequelize,
} = require('../models');
const { AppError } = require('../middlewares/errorHandler.middleware');
const { hasPermission, isManagerAccount } = require('./permission.service');
const { countLeaveDays, yearsOfService } = require('../utils/dateUtils');
const { sendLeaveDecisionEmail } = require('../utils/email');
const { recordAudit } = require('./audit.service');
const { logger } = require('../utils/logger');

// Only these two leave types draw down a tracked yearly balance. Special
// and Unpaid are handled case-by-case with no entitlement pool.
const BALANCE_TRACKED_TYPES = ['annual', 'medical'];

const getLeaveTypes = () => LeaveType.findAll({ include: [{ model: LeavePolicy, as: 'policies' }] });

const getApplicantTeamId = async (userId) => {
  const membership = await TeamMember.findOne({ where: { userId } });
  return membership ? membership.teamId : null;
};

// Confirmed rule: the Manager sits outside the leave system entirely — no
// applications, no balances. (isManagerAccount now lives in
// permission.service.js — shared with team.service.js/user.service.js,
// which enforce the same "not real staff" rule for teams.)

const getHolidaySet = async (startDate, endDate) => {
  const holidays = await PublicHoliday.findAll({ where: { date: { [Op.between]: [startDate, endDate] } } });
  return new Set(holidays.map((h) => h.date));
};

// Picks the tier with the greatest minYearsService the user has already
// reached (e.g. exactly 5 years reaches the 5+/18-day tier). Adjust the
// comparison here if you'd rather have the boundary year stay in the lower
// tier until it's fully passed.
const calculateEntitlement = async (user, leaveTypeId) => {
  const years = yearsOfService(user.dateJoined);
  const policies = await LeavePolicy.findAll({ where: { leaveTypeId }, order: [['minYearsService', 'ASC']] });
  if (policies.length === 0) return 0;

  let matched = policies[0];
  for (const p of policies) {
    if (years >= Number(p.minYearsService)) matched = p;
  }
  return Number(matched.daysEntitledPerYear);
};

const ensureBalance = async (user, leaveType, year) => {
  let balance = await LeaveBalance.findOne({ where: { userId: user.id, leaveTypeId: leaveType.id, year } });
  if (balance) return balance;

  const entitledDays = await calculateEntitlement(user, leaveType.id);

  let carriedOverDays = 0;
  if (leaveType.allowCarryOver) {
    const prevBalance = await LeaveBalance.findOne({ where: { userId: user.id, leaveTypeId: leaveType.id, year: year - 1 } });
    if (prevBalance) {
      const prevRemaining =
        Number(prevBalance.entitledDays) + Number(prevBalance.carriedOverDays) - Number(prevBalance.usedDays);
      carriedOverDays = Math.max(0, prevRemaining); // confirmed: uncapped carry-over
    }
  }

  return LeaveBalance.create({ userId: user.id, leaveTypeId: leaveType.id, year, entitledDays, usedDays: 0, carriedOverDays });
};

// Sum of unpaidDays across every closed-out ("approved") Medical Leave
// request this user had in the given year — the running "unpaid days"
// figure shown alongside the balance (see Users page leave-balance panel).
const getMedicalUnpaidDays = async (userId, leaveTypeId, year) => {
  const requests = await LeaveRequest.findAll({
    where: {
      userId,
      leaveTypeId,
      status: 'approved',
      startDate: { [Op.gte]: `${year}-01-01`, [Op.lte]: `${year}-12-31` },
    },
    attributes: ['unpaidDays'],
  });
  return requests.reduce((sum, r) => sum + Number(r.unpaidDays || 0), 0);
};

const getBalances = async (user, year = new Date().getFullYear()) => {
  const leaveTypes = await LeaveType.findAll();
  const balances = [];
  for (const lt of leaveTypes) {
    if (!BALANCE_TRACKED_TYPES.includes(lt.name)) continue;
    const balance = await ensureBalance(user, lt, year);
    const entry = {
      leaveType: lt.name,
      entitledDays: Number(balance.entitledDays),
      carriedOverDays: Number(balance.carriedOverDays),
      usedDays: Number(balance.usedDays),
      remainingDays: Number(balance.entitledDays) + Number(balance.carriedOverDays) - Number(balance.usedDays),
    };
    if (lt.name === 'medical') {
      entry.unpaidDays = await getMedicalUnpaidDays(user.id, lt.id, year);
    }
    balances.push(entry);
  }
  return balances;
};

const getMyBalances = (user, year) => getBalances(user, year);

// Same data, but for a user OTHER than the caller — used by the Users page
// so a manager/team admin/department admin can see a staff member's
// entitlement/remaining/unpaid days without that person having to be logged
// in. Gated by the same leave.view.* permission (scoped to the target's
// team) that already governs seeing that person's leave requests at all.
const getBalancesForUser = async (targetUserId, viewer, year) => {
  if (await isManagerAccount(targetUserId)) return [];

  const targetUser = await User.findByPk(targetUserId);
  if (!targetUser) throw new AppError(404, 'User not found.');

  if (targetUserId !== viewer.id) {
    const teamId = await getApplicantTeamId(targetUserId);
    const allowed =
      (await hasPermission(viewer.id, 'leave.view.medical', { scopeTeamId: teamId })) ||
      (await hasPermission(viewer.id, 'leave.view.annual', { scopeTeamId: teamId }));
    if (!allowed) throw new AppError(403, "You do not have permission to view this user's leave balances.");
  }

  return getBalances(targetUser, year);
};

const notify = async (userId, type, message, related) => {
  await Notification.create({
    userId,
    type,
    message,
    relatedEntityType: related?.type,
    relatedEntityId: related?.id,
  }).catch((err) => logger.error(`Failed to create notification: ${err.message}`));
};

// --- Submission -----------------------------------------------------------

const submitRequest = async (applicant, { leaveTypeId, startDate, endDate, reason, attachmentFileIds = [] }, req) => {
  if (await isManagerAccount(applicant.id)) {
    throw new AppError(400, 'The Manager account does not use the leave system.');
  }

  const leaveType = await LeaveType.findByPk(leaveTypeId);
  if (!leaveType) throw new AppError(400, 'Leave type not found.');

  // Medical Leave is the one exception to "you must give an end date": there
  // is no known end date until the staff member actually comes back, so it's
  // submitted with a start date only. Every other type still needs both.
  const isMedical = leaveType.name === 'medical';

  if (!isMedical) {
    if (!endDate) throw new AppError(400, 'End date is required.');
    if (new Date(endDate) < new Date(startDate)) throw new AppError(400, 'End date must be on or after the start date.');
  }

  if (leaveType.requiresDocument && attachmentFileIds.length === 0) {
    throw new AppError(400, `${leaveType.name} leave requires an uploaded document.`);
  }

  // Each referenced file must actually exist, belong to this applicant, and
  // have been uploaded for this exact purpose — never trust a raw URL
  // string from the client for something as sensitive as a medical document.
  let attachmentFiles = [];
  if (attachmentFileIds.length > 0) {
    attachmentFiles = await UploadedFile.findAll({ where: { id: attachmentFileIds } });
    if (attachmentFiles.length !== attachmentFileIds.length) {
      throw new AppError(400, 'One or more attached files could not be found.');
    }
    const invalid = attachmentFiles.find((f) => f.ownerUserId !== applicant.id || f.purpose !== 'mc_document');
    if (invalid) {
      throw new AppError(400, 'Attached files must be your own, uploaded as an MC document.');
    }
  }

  if (leaveType.submissionCutoffRule?.submitBeforeDayOfMonth) {
    const cutoffDay = leaveType.submissionCutoffRule.submitBeforeDayOfMonth;
    if (new Date().getDate() >= cutoffDay) {
      throw new AppError(400, `${leaveType.name} leave must be submitted before day ${cutoffDay} of the current month.`);
    }
  }

  // Medical Leave skips day-counting and balance-checking entirely at
  // submission time — there's no end date yet, so there's nothing to count.
  // That all happens later in setMedicalReturnDate, once the return date is
  // known. It only needs to check that the staff member doesn't already
  // have one still open.
  if (isMedical) {
    const stillOpen = await LeaveRequest.findOne({
      where: { userId: applicant.id, leaveTypeId: leaveType.id, status: 'awaiting_return' },
    });
    if (stillOpen) {
      throw new AppError(400, 'You already have a medical leave awaiting a return date. It must be closed out before applying again.');
    }
  }

  let totalDays = null;
  const year = new Date(startDate).getFullYear();

  if (!isMedical) {
    const holidaySet = leaveType.excludePublicHolidays ? await getHolidaySet(startDate, endDate) : new Set();
    totalDays = countLeaveDays(startDate, endDate, {
      excludeWeekends: leaveType.excludeWeekends,
      excludePublicHolidays: leaveType.excludePublicHolidays,
      holidayDatesSet: holidaySet,
    });
    if (totalDays <= 0) throw new AppError(400, 'Selected date range contains no working days.');

    if (BALANCE_TRACKED_TYPES.includes(leaveType.name)) {
      const balance = await ensureBalance(applicant, leaveType, year);
      const remaining = Number(balance.entitledDays) + Number(balance.carriedOverDays) - Number(balance.usedDays);

      // Also subtract days already reserved by this user's own pending/approved
      // requests of this type, so several simultaneous pending requests can't
      // jointly overbook a balance that looks fine one request at a time.
      const reserved = await LeaveRequest.sum('totalDays', {
        where: { userId: applicant.id, leaveTypeId: leaveType.id, status: { [Op.in]: ['pending', 'approved'] } },
      });
      const availableNow = remaining - (Number(reserved) || 0);

      if (totalDays > availableNow) {
        throw new AppError(400, `Insufficient ${leaveType.name} leave balance. Available: ${availableNow} day(s).`);
      }
    }
  }

  const request = await sequelize.transaction(async (t) => {
    const created = await LeaveRequest.create(
      {
        userId: applicant.id,
        leaveTypeId: leaveType.id,
        startDate,
        endDate: isMedical ? null : endDate,
        totalDays: isMedical ? null : totalDays,
        reason,
        status: isMedical ? 'awaiting_return' : (leaveType.autoApprove ? 'approved' : 'pending'),
        reviewedAt: isMedical ? null : (leaveType.autoApprove ? new Date() : null),
      },
      { transaction: t }
    );

    if (attachmentFiles.length > 0) {
      await LeaveAttachment.bulkCreate(
        attachmentFiles.map((f) => ({ leaveRequestId: created.id, fileUrl: `/api/files/${f.id}` })),
        { transaction: t }
      );
    }

    if (!isMedical && leaveType.autoApprove && BALANCE_TRACKED_TYPES.includes(leaveType.name)) {
      const balance = await ensureBalance(applicant, leaveType, year);
      balance.usedDays = Number(balance.usedDays) + totalDays;
      await balance.save({ transaction: t });
    }

    return created;
  });

  await recordAudit({
    actorUserId: applicant.id,
    action: 'leave.submit',
    targetType: 'LeaveRequest',
    targetId: request.id,
    metadata: { leaveType: leaveType.name, totalDays, autoApproved: leaveType.autoApprove, awaitingReturn: isMedical },
    req,
  });

  if (isMedical) {
    await notify(
      applicant.id,
      'leave_decision',
      'Your medical leave has been recorded. Ask your admin to log your return date once you\'re back so it can be finalized.',
      { type: 'LeaveRequest', id: request.id }
    );
  } else if (leaveType.autoApprove) {
    sendLeaveDecisionEmail(applicant.email, {
      fullName: applicant.fullName,
      leaveTypeName: leaveType.name,
      status: 'approved',
      startDate,
      endDate,
    }).catch((err) => logger.error(`Failed to send auto-approval email: ${err.message}`));
  }

  return request;
};

// --- Medical Leave return date (closes out an "awaiting_return" request) --

// Called once the staff member is back: computes the actual working days
// away (weekends/public holidays excluded, same as every other leave type),
// draws down the medical balance by whatever fits, and records anything
// beyond the remaining balance as unpaidDays on this same request — per the
// confirmed rule, no separate "unpaid leave" application is auto-created.
const setMedicalReturnDate = async (requestId, endDate, actor, req) => {
  const request = await LeaveRequest.findByPk(requestId, {
    include: [
      { model: LeaveType, as: 'leaveType' },
      { model: User, as: 'applicant' },
    ],
  });
  if (!request) throw new AppError(404, 'Leave request not found.');
  if (request.leaveType.name !== 'medical') throw new AppError(400, 'This action only applies to Medical Leave.');
  if (request.status !== 'awaiting_return') throw new AppError(409, 'This medical leave already has a return date recorded.');

  if (request.userId === actor.id) {
    throw new AppError(403, 'You cannot record your own return date.');
  }

  if (new Date(endDate) < new Date(request.startDate)) {
    throw new AppError(400, 'Return date must be on or after the start date.');
  }

  const applicantTeamId = await getApplicantTeamId(request.userId);
  const allowed = await hasPermission(actor.id, 'leave.approve.medical', { scopeTeamId: applicantTeamId });
  if (!allowed) throw new AppError(403, 'You do not have permission to record this return date.');

  const holidaySet = request.leaveType.excludePublicHolidays ? await getHolidaySet(request.startDate, endDate) : new Set();
  const totalDays = countLeaveDays(request.startDate, endDate, {
    excludeWeekends: request.leaveType.excludeWeekends,
    excludePublicHolidays: request.leaveType.excludePublicHolidays,
    holidayDatesSet: holidaySet,
  });
  if (totalDays <= 0) throw new AppError(400, 'The return date must cover at least one working day away.');

  const year = new Date(request.startDate).getFullYear();
  const balance = await ensureBalance(request.applicant, request.leaveType, year);
  const remaining = Math.max(0, Number(balance.entitledDays) + Number(balance.carriedOverDays) - Number(balance.usedDays));
  const usedPortion = Math.min(totalDays, remaining);
  const unpaidPortion = Math.max(0, totalDays - remaining);

  await sequelize.transaction(async (t) => {
    balance.usedDays = Number(balance.usedDays) + usedPortion;
    await balance.save({ transaction: t });

    request.endDate = endDate;
    request.totalDays = totalDays;
    request.unpaidDays = unpaidPortion;
    request.status = 'approved';
    request.reviewedBy = actor.id;
    request.reviewedAt = new Date();
    await request.save({ transaction: t });
  });

  await recordAudit({
    actorUserId: actor.id,
    action: 'leave.medical_return',
    targetType: 'LeaveRequest',
    targetId: request.id,
    metadata: { totalDays, usedPortion, unpaidPortion },
    req,
  });

  const summary = unpaidPortion > 0
    ? `${totalDays} day(s) total — ${usedPortion} covered by your medical leave balance, ${unpaidPortion} recorded as unpaid.`
    : `${totalDays} day(s), fully covered by your medical leave balance.`;

  await notify(request.userId, 'leave_decision', `Your medical leave return date has been recorded: ${summary}`, {
    type: 'LeaveRequest',
    id: request.id,
  });

  sendLeaveDecisionEmail(request.applicant.email, {
    fullName: request.applicant.fullName,
    leaveTypeName: 'medical',
    status: 'approved',
    startDate: request.startDate,
    endDate,
    comment: unpaidPortion > 0 ? `${unpaidPortion} day(s) exceeded your medical leave balance and were recorded as unpaid.` : undefined,
  }).catch((err) => logger.error(`Failed to send medical return email: ${err.message}`));

  return request;
};

// --- Approval / rejection --------------------------------------------------

const decide = async (requestId, decision, actor, { comment } = {}, req) => {
  const request = await LeaveRequest.findByPk(requestId, {
    include: [
      { model: LeaveType, as: 'leaveType' },
      { model: User, as: 'applicant' },
    ],
  });
  if (!request) throw new AppError(404, 'Leave request not found.');
  if (request.status !== 'pending') throw new AppError(409, 'This request has already been decided.');

  // No self-approval, regardless of permission held. This is also what
  // makes a Team Admin's (or Department Admin's) own leave escalate: their
  // own team/global-scoped approve permission is excluded here by identity,
  // so only someone else holding the permission at the right scope can act —
  // for a Team Admin's own request, that's necessarily Department
  // Admin/Manager, since no other Team Admin is scoped to that team.
  if (request.userId === actor.id) {
    throw new AppError(403, 'You cannot act on your own leave request.');
  }

  const permissionKey = `leave.approve.${request.leaveType.name}`;
  const applicantTeamId = await getApplicantTeamId(request.userId);
  const allowed = await hasPermission(actor.id, permissionKey, { scopeTeamId: applicantTeamId });
  if (!allowed) throw new AppError(403, 'You do not have permission to decide this request.');

  const status = decision === 'approve' ? 'approved' : 'rejected';

  await sequelize.transaction(async (t) => {
    request.status = status;
    request.reviewedBy = actor.id;
    request.reviewedAt = new Date();
    request.reviewComment = comment || null;
    await request.save({ transaction: t });

    if (status === 'approved' && BALANCE_TRACKED_TYPES.includes(request.leaveType.name)) {
      const year = new Date(request.startDate).getFullYear();
      const balance = await ensureBalance(request.applicant, request.leaveType, year);
      balance.usedDays = Number(balance.usedDays) + Number(request.totalDays);
      await balance.save({ transaction: t });
    }
  });

  await recordAudit({
    actorUserId: actor.id,
    action: `leave.${decision}`,
    targetType: 'LeaveRequest',
    targetId: request.id,
    metadata: { comment },
    req,
  });

  await notify(request.userId, 'leave_decision', `Your ${request.leaveType.name} leave request was ${status}.`, {
    type: 'LeaveRequest',
    id: request.id,
  });

  sendLeaveDecisionEmail(request.applicant.email, {
    fullName: request.applicant.fullName,
    leaveTypeName: request.leaveType.name,
    status,
    startDate: request.startDate,
    endDate: request.endDate,
    comment,
  }).catch((err) => logger.error(`Failed to send decision email: ${err.message}`));

  return request;
};

// --- Cancellation (override-only, per confirmed no-self-cancel rule) ------

const cancel = async (requestId, actor, req) => {
  const request = await LeaveRequest.findByPk(requestId, { include: [{ model: LeaveType, as: 'leaveType' }] });
  if (!request) throw new AppError(404, 'Leave request not found.');
  if (['cancelled', 'rejected'].includes(request.status)) throw new AppError(409, 'This request is already closed.');

  const allowed = await hasPermission(actor.id, 'leave.override');
  if (!allowed) throw new AppError(403, 'Only an administrator can cancel a submitted leave request.');

  const wasApproved = request.status === 'approved';
  request.status = 'cancelled';
  await request.save();

  if (wasApproved && BALANCE_TRACKED_TYPES.includes(request.leaveType.name)) {
    const year = new Date(request.startDate).getFullYear();
    const balance = await LeaveBalance.findOne({ where: { userId: request.userId, leaveTypeId: request.leaveTypeId, year } });
    if (balance) {
      balance.usedDays = Math.max(0, Number(balance.usedDays) - Number(request.totalDays));
      await balance.save();
    }
  }

  await recordAudit({ actorUserId: actor.id, action: 'leave.cancel', targetType: 'LeaveRequest', targetId: request.id, req });
  return request;
};

// --- Listing ----------------------------------------------------------------

const listMyRequests = (userId) =>
  LeaveRequest.findAll({
    where: { userId },
    include: [
      { model: LeaveType, as: 'leaveType' },
      { model: LeaveAttachment, as: 'attachments' },
      { model: User, as: 'reviewer', attributes: ['id', 'fullName', 'email'] },
    ],
    order: [['createdAt', 'DESC']],
  });

// Pulls every request then filters by scope-aware permission per row. Fine
// for the data volumes a single-department system will see; if this ever
// becomes a bottleneck, push the scope check into the SQL WHERE instead of
// filtering in JS.
const listForReview = async (actor) => {
  const requests = await LeaveRequest.findAll({
    include: [
      { model: LeaveType, as: 'leaveType' },
      { model: User, as: 'applicant', attributes: ['id', 'fullName', 'email'] },
      { model: User, as: 'reviewer', attributes: ['id', 'fullName', 'email'] },
    ],
    order: [['createdAt', 'DESC']],
  });

  const visible = [];
  for (const r of requests) {
    const teamId = await getApplicantTeamId(r.userId);
    const allowed = await hasPermission(actor.id, `leave.view.${r.leaveType.name}`, { scopeTeamId: teamId });
    if (allowed) visible.push(r);
  }
  return visible;
};

module.exports = {
  getLeaveTypes,
  getMyBalances,
  getBalancesForUser,
  submitRequest,
  setMedicalReturnDate,
  decide,
  cancel,
  listMyRequests,
  listForReview,
};
