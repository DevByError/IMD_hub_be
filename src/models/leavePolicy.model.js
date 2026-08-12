module.exports = (sequelize, DataTypes) => {
  const LeavePolicy = sequelize.define(
    'LeavePolicy',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      leaveTypeId: { type: DataTypes.UUID, allowNull: false },
      minYearsService: { type: DataTypes.DECIMAL(4, 1), allowNull: false, defaultValue: 0 },
      maxYearsService: { type: DataTypes.DECIMAL(4, 1), allowNull: true }, // null = no upper bound
      daysEntitledPerYear: { type: DataTypes.DECIMAL(4, 1), allowNull: false },
    },
    {
      tableName: 'leave_policies',
    }
  );

  LeavePolicy.associate = (models) => {
    LeavePolicy.belongsTo(models.LeaveType, { foreignKey: 'leaveTypeId', as: 'leaveType' });
  };

  return LeavePolicy;
};
