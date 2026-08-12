const { Team, TeamMember, User, sequelize } = require('../models');
const { AppError } = require('../middlewares/errorHandler.middleware');
const { recordAudit } = require('./audit.service');
const { isManagerAccount } = require('./permission.service');

const listTeams = () =>
  Team.findAll({
    include: [{ model: User, as: 'staff', attributes: ['id', 'fullName', 'email'], through: { attributes: [] } }],
    order: [['createdAt', 'ASC']],
  });

// Public — for the registration form's team dropdown, which runs before the
// applicant has an account. Deliberately id/name only: never expose staff
// lists or anything else about a team to an unauthenticated caller.
const listTeamsPublic = () => Team.findAll({ attributes: ['id', 'name'], order: [['name', 'ASC']] });

const getTeam = async (teamId) => {
  const team = await Team.findByPk(teamId, {
    include: [{ model: User, as: 'staff', attributes: ['id', 'fullName', 'email'], through: { attributes: [] } }],
  });
  if (!team) throw new AppError(404, 'Team not found.');
  return team;
};

const createTeam = async ({ name }, creator, req) => {
  const team = await Team.create({ name, createdBy: creator.id });
  await recordAudit({ actorUserId: creator.id, action: 'team.create', targetType: 'Team', targetId: team.id, metadata: { name }, req });
  return team;
};

const deleteTeam = async (teamId, actor, req) => {
  const team = await Team.findByPk(teamId);
  if (!team) throw new AppError(404, 'Team not found.');

  const memberCount = await TeamMember.count({ where: { teamId } });
  if (memberCount > 0) throw new AppError(409, 'Remove all staff from this team before deleting it.');

  await team.destroy();
  await recordAudit({ actorUserId: actor.id, action: 'team.delete', targetType: 'Team', targetId: teamId, req });
};

// "Set" rather than "add" — enforces the confirmed rule that a staff member
// belongs to exactly one team at a time. The team_members table itself is
// still many-to-many for future flexibility (see spec section 3); this is
// the application-level rule enforced on top of it.
const setStaffTeam = async (userId, teamId, actor, req) => {
  const user = await User.findByPk(userId);
  if (!user) throw new AppError(404, 'User not found.');

  // The Department Manager sits outside the team structure entirely (same
  // rule that keeps them out of the leave system) — never a team's staff.
  if (await isManagerAccount(userId)) {
    throw new AppError(400, 'The Department Manager account cannot be assigned to a team as staff.');
  }

  const team = await Team.findByPk(teamId);
  if (!team) throw new AppError(404, 'Team not found.');

  await sequelize.transaction(async (t) => {
    await TeamMember.destroy({ where: { userId }, transaction: t });
    await TeamMember.create({ teamId, userId }, { transaction: t });
  });

  await recordAudit({ actorUserId: actor.id, action: 'team.member_set', targetType: 'User', targetId: userId, metadata: { teamId }, req });
};

const removeStaffFromTeam = async (teamId, userId, actor, req) => {
  const deleted = await TeamMember.destroy({ where: { teamId, userId } });
  if (deleted === 0) throw new AppError(404, 'That staff member is not on this team.');

  await recordAudit({ actorUserId: actor.id, action: 'team.member_remove', targetType: 'User', targetId: userId, metadata: { teamId }, req });
};

module.exports = { listTeams, listTeamsPublic, getTeam, createTeam, deleteTeam, setStaffTeam, removeStaffFromTeam };
