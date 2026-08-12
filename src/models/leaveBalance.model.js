module.exports = (sequelize, DataTypes) => {
  const LeaveBalance = sequelize.define(
    'LeaveBalance',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false },
      leaveTypeId: { type: DataTypes.UUID, allowNull: false },
      year: { type: DataTypes.INTEGER, allowNull: false },
      entitledDays: { type: DataTypes.DECIMAL(5, 1), allowNull: false, defaultValue: 0 },
      usedDays: { type: DataTypes.DECIMAL(5, 1), allowNull: false, defaultValue: 0 },
      carriedOverDays: { type: DataTypes.DECIMAL(5, 1), allowNull: false, defaultValue: 0 },
    },
    {
      tableName: 'leave_balances',
      indexes: [{ unique: true, fields: ['user_id', 'leave_type_id', 'year'] }],
    }
  );

  LeaveBalance.associate = (models) => {
    LeaveBalance.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
    LeaveBalance.belongsTo(models.LeaveType, { foreignKey: 'leaveTypeId', as: 'leaveType' });
  };

  return LeaveBalance;
};
