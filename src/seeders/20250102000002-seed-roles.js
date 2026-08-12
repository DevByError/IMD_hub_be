const { v4: uuidv4 } = require('uuid');

module.exports = {
  up: async (queryInterface) => {
    const now = new Date();
    await queryInterface.bulkInsert('roles', [
      { id: uuidv4(), name: 'Department Manager', is_system_role: true, created_at: now, updated_at: now },
      { id: uuidv4(), name: 'Department Admin', is_system_role: true, created_at: now, updated_at: now },
      { id: uuidv4(), name: 'Team Admin', is_system_role: true, created_at: now, updated_at: now },
      { id: uuidv4(), name: 'Staff', is_system_role: true, created_at: now, updated_at: now },
    ]);
  },
  down: async (queryInterface) => {
    await queryInterface.bulkDelete('roles', { is_system_role: true }, {});
  },
};
