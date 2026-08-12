module.exports = (sequelize, DataTypes) => {
  const LeaveRequest = sequelize.define(
    'LeaveRequest',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false },
      leaveTypeId: { type: DataTypes.UUID, allowNull: false },
      startDate: { type: DataTypes.DATEONLY, allowNull: false },
      // Null for a Medical Leave request until someone records the return
      // date (see leave.service.js setMedicalReturnDate) — every other leave
      // type still sets this at submission time.
      endDate: { type: DataTypes.DATEONLY, allowNull: true },
      totalDays: { type: DataTypes.DECIMAL(5, 1), allowNull: true }, // weekends/holidays already excluded; null until endDate is known
      // Of totalDays, how many exceeded the staff member's remaining Medical
      // Leave balance and were therefore counted as unpaid (0 for every
      // other leave type, and 0 for medical too until it's closed out).
      unpaidDays: { type: DataTypes.DECIMAL(5, 1), allowNull: false, defaultValue: 0 },
      reason: { type: DataTypes.TEXT, allowNull: true },
      status: {
        // 'awaiting_return' is Medical Leave's in-between state: accepted
        // instantly (no rejection), but the day count/balance draw-down
        // can't happen until an admin records when the staff member came
        // back — see setMedicalReturnDate, which flips this to 'approved'.
        type: DataTypes.ENUM('pending', 'approved', 'rejected', 'cancelled', 'awaiting_return'),
        allowNull: false,
        defaultValue: 'pending',
      },
      reviewedBy: { type: DataTypes.UUID, allowNull: true },
      reviewedAt: { type: DataTypes.DATE, allowNull: true },
      reviewComment: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      tableName: 'leave_requests',
      paranoid: true,
    }
  );

  LeaveRequest.associate = (models) => {
    LeaveRequest.belongsTo(models.User, { foreignKey: 'userId', as: 'applicant' });
    LeaveRequest.belongsTo(models.User, { foreignKey: 'reviewedBy', as: 'reviewer' });
    LeaveRequest.belongsTo(models.LeaveType, { foreignKey: 'leaveTypeId', as: 'leaveType' });
    LeaveRequest.hasMany(models.LeaveAttachment, { foreignKey: 'leaveRequestId', as: 'attachments' });
  };

  return LeaveRequest;
};
