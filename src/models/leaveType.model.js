module.exports = (sequelize, DataTypes) => {
  const LeaveType = sequelize.define(
    'LeaveType',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      name: { type: DataTypes.ENUM('annual', 'medical', 'special', 'unpaid'), allowNull: false, unique: true },
      requiresDocument: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      autoApprove: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      // e.g. { "submitBeforeDayOfMonth": 25 } for Unpaid Leave
      submissionCutoffRule: { type: DataTypes.JSON, allowNull: true },
      excludeWeekends: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      excludePublicHolidays: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      allowCarryOver: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    },
    {
      tableName: 'leave_types',
    }
  );

  LeaveType.associate = (models) => {
    LeaveType.hasMany(models.LeavePolicy, { foreignKey: 'leaveTypeId', as: 'policies' });
    LeaveType.hasMany(models.LeaveBalance, { foreignKey: 'leaveTypeId', as: 'balances' });
    LeaveType.hasMany(models.LeaveRequest, { foreignKey: 'leaveTypeId', as: 'requests' });
  };

  return LeaveType;
};
