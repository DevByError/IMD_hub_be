const registrationService = require('../services/registration.service');
const { asyncHandler } = require('../utils/asyncHandler');

const list = asyncHandler(async (req, res) => {
  const requests = await registrationService.listPending();
  res.json({ requests });
});

const listReviewed = asyncHandler(async (req, res) => {
  const requests = await registrationService.listReviewed();
  res.json({ requests });
});

const approve = asyncHandler(async (req, res) => {
  const user = await registrationService.approve(req.params.id, req.body, req.user, req);
  res.json({ message: 'Registration approved.', user: { id: user.id, fullName: user.fullName, email: user.email } });
});

const reject = asyncHandler(async (req, res) => {
  const request = await registrationService.reject(req.params.id, req.body.reason, req.user, req);
  res.json({ message: 'Registration rejected.', request: { id: request.id, status: request.status } });
});

const revealIdDocument = asyncHandler(async (req, res) => {
  res.json(await registrationService.revealIdDocumentNumber(req.params.id, req.user, req));
});

module.exports = { list, listReviewed, approve, reject, revealIdDocument };
