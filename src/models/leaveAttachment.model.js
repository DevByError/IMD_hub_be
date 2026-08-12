module.exports = (sequelize, DataTypes) => {
  const LeaveAttachment = sequelize.define(
    'LeaveAttachment',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      leaveRequestId: { type: DataTypes.UUID, allowNull: false },
      fileUrl: { type: DataTypes.STRING, allowNull: false },
      uploadedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      tableName: 'leave_attachments',
      updatedAt: false,
    }
  );

  LeaveAttachment.associate = (models) => {
    LeaveAttachment.belongsTo(models.LeaveRequest, { foreignKey: 'leaveRequestId', as: 'leaveRequest' });
  };

  return LeaveAttachment;
};
