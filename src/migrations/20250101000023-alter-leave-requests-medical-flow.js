// Supports the "medical leave has no known end date at submission time"
// flow: staff picks only a start date; an admin later records the return
// date, at which point total working days are computed and any days beyond
// the remaining medical balance are recorded as unpaid (see leave.service.js
// submitRequest / setMedicalReturnDate).
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // end_date / total_days are unknown until the return date is recorded,
    // so both must become nullable (previously NOT NULL).
    await queryInterface.changeColumn('leave_requests', 'end_date', {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });
    await queryInterface.changeColumn('leave_requests', 'total_days', {
      type: Sequelize.DECIMAL(5, 1),
      allowNull: true,
    });

    await queryInterface.addColumn('leave_requests', 'unpaid_days', {
      type: Sequelize.DECIMAL(5, 1),
      allowNull: false,
      defaultValue: 0,
    });

    // MySQL ENUMs can't be altered with addColumn/changeColumn helpers alone —
    // a raw MODIFY COLUMN is the standard way to add a new ENUM value.
    await queryInterface.sequelize.query(
      "ALTER TABLE leave_requests MODIFY COLUMN status ENUM('pending','approved','rejected','cancelled','awaiting_return') NOT NULL DEFAULT 'pending'"
    );
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(
      "UPDATE leave_requests SET status = 'pending' WHERE status = 'awaiting_return'"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE leave_requests MODIFY COLUMN status ENUM('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending'"
    );
    await queryInterface.removeColumn('leave_requests', 'unpaid_days');
    await queryInterface.changeColumn('leave_requests', 'total_days', {
      type: Sequelize.DECIMAL(5, 1),
      allowNull: false,
    });
    await queryInterface.changeColumn('leave_requests', 'end_date', {
      type: Sequelize.DATEONLY,
      allowNull: false,
    });
  },
};
