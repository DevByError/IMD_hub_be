const publicHolidayService = require('../services/publicHoliday.service');
const { asyncHandler } = require('../utils/asyncHandler');

const list = asyncHandler(async (req, res) => {
  const year = req.query.year ? Number(req.query.year) : undefined;
  res.json({ holidays: await publicHolidayService.listHolidays({ year }) });
});

const create = asyncHandler(async (req, res) => {
  const holiday = await publicHolidayService.createHoliday(req.body, req.user, req);
  res.status(201).json({ message: 'Public holiday added.', holiday });
});

const remove = asyncHandler(async (req, res) => {
  await publicHolidayService.deleteHoliday(req.params.id, req.user, req);
  res.status(204).send();
});

module.exports = { list, create, remove };
