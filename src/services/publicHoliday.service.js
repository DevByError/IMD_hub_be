const { Op } = require('sequelize');
const { PublicHoliday } = require('../models');
const { AppError } = require('../middlewares/errorHandler.middleware');
const { recordAudit } = require('./audit.service');

// Read-only for anyone authenticated (staff should be able to see the
// calendar while planning leave); mutation is gated by leave.policy.manage
// at the route level — see routes/publicHoliday.routes.js.
const listHolidays = ({ year } = {}) => {
  const where = year ? { date: { [Op.gte]: `${year}-01-01`, [Op.lte]: `${year}-12-31` } } : {};
  return PublicHoliday.findAll({ where, order: [['date', 'ASC']] });
};

const createHoliday = async ({ date, name }, actor, req) => {
  const existing = await PublicHoliday.findOne({ where: { date } });
  if (existing) throw new AppError(409, `A public holiday ("${existing.name}") is already recorded for this date.`);

  const holiday = await PublicHoliday.create({ date, name });

  await recordAudit({
    actorUserId: actor.id,
    action: 'public_holiday.create',
    targetType: 'PublicHoliday',
    targetId: holiday.id,
    metadata: { date, name },
    req,
  });

  return holiday;
};

const deleteHoliday = async (id, actor, req) => {
  const holiday = await PublicHoliday.findByPk(id);
  if (!holiday) throw new AppError(404, 'Public holiday not found.');

  await holiday.destroy();

  await recordAudit({
    actorUserId: actor.id,
    action: 'public_holiday.delete',
    targetType: 'PublicHoliday',
    targetId: id,
    metadata: { date: holiday.date, name: holiday.name },
    req,
  });
};

module.exports = { listHolidays, createHoliday, deleteHoliday };
