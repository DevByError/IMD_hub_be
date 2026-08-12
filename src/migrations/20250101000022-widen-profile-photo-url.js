// Profile photos are now saved as base64 data URIs directly on the user row
// (self-service "click your avatar" upload — see user.service.js
// updateOwnPhoto) instead of only ever being a short "/api/files/:id" path.
// A data URI for even a modestly-sized JPEG comfortably exceeds a plain
// STRING(255) column, so this widens it to MEDIUMTEXT (up to ~16MB) —
// existing "/api/files/:id" values (set at registration approval) still
// fit fine, no data migration needed.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('users', 'profile_photo_url', {
      type: Sequelize.TEXT('medium'),
      allowNull: true,
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('users', 'profile_photo_url', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },
};
