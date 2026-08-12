const teamService = require('../services/team.service');
const { asyncHandler } = require('../utils/asyncHandler');

const list = asyncHandler(async (req, res) => {
  res.json({ teams: await teamService.listTeams() });
});

const listPublic = asyncHandler(async (req, res) => {
  res.json({ teams: await teamService.listTeamsPublic() });
});

const get = asyncHandler(async (req, res) => {
  res.json({ team: await teamService.getTeam(req.params.teamId) });
});

const create = asyncHandler(async (req, res) => {
  const team = await teamService.createTeam(req.body, req.user, req);
  res.status(201).json({ message: 'Team created.', team });
});

const remove = asyncHandler(async (req, res) => {
  await teamService.deleteTeam(req.params.teamId, req.user, req);
  res.status(204).send();
});

const addMember = asyncHandler(async (req, res) => {
  await teamService.setStaffTeam(req.body.userId, req.params.teamId, req.user, req);
  res.status(204).send();
});

const removeMember = asyncHandler(async (req, res) => {
  await teamService.removeStaffFromTeam(req.params.teamId, req.params.userId, req.user, req);
  res.status(204).send();
});

module.exports = { list, listPublic, get, create, remove, addMember, removeMember };
