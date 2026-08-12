const { v4: uuidv4 } = require('uuid');

// Annual and Medical share the same tenure formula (14 days for 1-5 years of
// service, 18 days for 5+), but are seeded against separate leave_type_id
// values, so they track as fully independent balances per the confirmed
// requirement — using up one has no effect on the other.
module.exports = {
  up: async (queryInterface) => {
    const now = new Date();
    const [leaveTypes] = await queryInterface.sequelize.query('SELECT id, name FROM leave_types');
    const idByName = Object.fromEntries(leaveTypes.map((lt) => [lt.name, lt.id]));

    const rows = [];
    ['annual', 'medical'].forEach((typeName) => {
      rows.push(
        {
          id: uuidv4(), leave_type_id: idByName[typeName],
          min_years_service: 1, max_years_service: 5, days_entitled_per_year: 14,
          created_at: now, updated_at: now,
        },
        {
          id: uuidv4(), leave_type_id: idByName[typeName],
          min_years_service: 5, max_years_service: null, days_entitled_per_year: 18,
          created_at: now, updated_at: now,
        }
      );
    });

    await queryInterface.bulkInsert('leave_policies', rows);
  },
  down: async (queryInterface) => {
    await queryInterface.bulkDelete('leave_policies', null, {});
  },
};
