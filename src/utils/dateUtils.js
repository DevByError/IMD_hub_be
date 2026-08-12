const MS_PER_DAY = 24 * 60 * 60 * 1000;

const toDateOnly = (d) => {
  const date = d instanceof Date ? d : new Date(d);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

const yearsOfService = (dateJoined, asOf = new Date()) => {
  if (!dateJoined) return 0;
  const joined = toDateOnly(dateJoined);
  const now = toDateOnly(asOf);
  return (now.getTime() - joined.getTime()) / (MS_PER_DAY * 365.25);
};

// Inclusive of both startDate and endDate. Uses UTC-normalized DATEONLY
// values throughout so this can't drift by a day depending on server
// timezone — see spec section 10 on why leave dates use DATEONLY, not
// DATETIME.
const countLeaveDays = (startDate, endDate, { excludeWeekends = true, excludePublicHolidays = true, holidayDatesSet = new Set() } = {}) => {
  const start = toDateOnly(startDate);
  const end = toDateOnly(endDate);
  if (end < start) return 0;

  let count = 0;
  for (let d = new Date(start); d <= end; d = new Date(d.getTime() + MS_PER_DAY)) {
    const dayOfWeek = d.getUTCDay(); // 0 = Sunday, 6 = Saturday
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isoDate = d.toISOString().slice(0, 10);
    const isHoliday = holidayDatesSet.has(isoDate);

    if (excludeWeekends && isWeekend) continue;
    if (excludePublicHolidays && isHoliday) continue;
    count += 1;
  }
  return count;
};

module.exports = { yearsOfService, countLeaveDays, toDateOnly };
