const { v4: uuidv4 } = require('uuid');

module.exports = {
  up: async (queryInterface) => {
    const now = new Date();
    await queryInterface.bulkInsert('leave_types', [
      {
        id: uuidv4(), name: 'annual', requires_document: false, auto_approve: false,
        submission_cutoff_rule: null, exclude_weekends: true, exclude_public_holidays: true,
        allow_carry_over: true, created_at: now, updated_at: now,
      },
      {
        id: uuidv4(), name: 'medical', requires_document: true, auto_approve: true,
        submission_cutoff_rule: null, exclude_weekends: true, exclude_public_holidays: true,
        allow_carry_over: false, created_at: now, updated_at: now,
      },
      {
        id: uuidv4(), name: 'special', requires_document: false, auto_approve: false,
        submission_cutoff_rule: null, exclude_weekends: true, exclude_public_holidays: true,
        allow_carry_over: false, created_at: now, updated_at: now,
      },
      {
        id: uuidv4(), name: 'unpaid', requires_document: false, auto_approve: false,
        submission_cutoff_rule: JSON.stringify({ submitBeforeDayOfMonth: 25 }),
        exclude_weekends: true, exclude_public_holidays: true,
        allow_carry_over: false, created_at: now, updated_at: now,
      },
    ]);
  },
  down: async (queryInterface) => {
    await queryInterface.bulkDelete('leave_types', null, {});
  },
};
