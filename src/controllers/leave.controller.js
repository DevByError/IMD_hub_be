const leaveService = require('../services/leave.service');
const { asyncHandler } = require('../utils/asyncHandler');

const listTypes = asyncHandler(async (req, res) => {
  res.json({ leaveTypes: await leaveService.getLeaveTypes() });
});

const myBalances = asyncHandler(async (req, res) => {
  const year = req.query.year ? Number(req.query.year) : undefined;
  res.json({ balances: await leaveService.getMyBalances(req.user, year) });
});

const balancesForUser = asyncHandler(async (req, res) => {
  const year = req.query.year ? Number(req.query.year) : undefined;
  res.json({ balances: await leaveService.getBalancesForUser(req.params.userId, req.user, year) });
});

const myRequests = asyncHandler(async (req, res) => {
  res.json({ requests: await leaveService.listMyRequests(req.user.id) });
});

const submit = asyncHandler(async (req, res) => {
  const request = await leaveService.submitRequest(req.user, req.body, req);
  res.status(201).json({ message: 'Leave request submitted.', request });
});

const forReview = asyncHandler(async (req, res) => {
  res.json({ requests: await leaveService.listForReview(req.user) });
});

const approve = asyncHandler(async (req, res) => {
  res.json({ request: await leaveService.decide(req.params.id, 'approve', req.user, req.body, req) });
});

const reject = asyncHandler(async (req, res) => {
  res.json({ request: await leaveService.decide(req.params.id, 'reject', req.user, req.body, req) });
});

const cancel = asyncHandler(async (req, res) => {
  res.json({ request: await leaveService.cancel(req.params.id, req.user, req) });
});

const recordMedicalReturn = asyncHandler(async (req, res) => {
  res.json({ request: await leaveService.setMedicalReturnDate(req.params.id, req.body.endDate, req.user, req) });
});

module.exports = {
  listTypes,
  myBalances,
  balancesForUser,
  myRequests,
  submit,
  forReview,
  approve,
  reject,
  cancel,
  recordMedicalReturn,
};
