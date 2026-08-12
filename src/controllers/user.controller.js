const userService = require('../services/user.service');
const { asyncHandler } = require('../utils/asyncHandler');

const me = asyncHandler(async (req, res) => {
  res.json(await userService.getMe(req.user.id));
});

const list = asyncHandler(async (req, res) => {
  res.json({ users: await userService.listStaff(req.user) });
});

const getProfile = asyncHandler(async (req, res) => {
  res.json({ user: await userService.getProfile(req.params.id, req.user) });
});

const updateProfile = asyncHandler(async (req, res) => {
  res.json({ message: 'Profile updated.', user: await userService.updateProfile(req.params.id, req.body, req.user, req) });
});

const updatePhoto = asyncHandler(async (req, res) => {
  const user = await userService.updateOwnPhoto(req.params.id, req.body.imageBase64, req.user, req);
  res.json({ message: 'Profile photo updated.', user });
});

// Deliberately separate from getProfile — the ordinary profile response
// always masks this field (see user.service.js sanitizeUser); fetching the
// real value is its own explicit, audited action.
const revealIdDocument = asyncHandler(async (req, res) => {
  res.json(await userService.revealIdDocumentNumber(req.params.id, req.user, req));
});

module.exports = { me, list, getProfile, updateProfile, updatePhoto, revealIdDocument };
