module.exports = (sequelize, DataTypes) => {
  const AuditLog = sequelize.define(
    'AuditLog',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      actorUserId: { type: DataTypes.UUID, allowNull: true }, // null for unauthenticated events e.g. failed login
      action: { type: DataTypes.STRING, allowNull: false }, // e.g. "leave.approve", "role.assign", "auth.password_reset"
      targetType: { type: DataTypes.STRING, allowNull: true },
      targetId: { type: DataTypes.UUID, allowNull: true },
      metadata: { type: DataTypes.JSON, allowNull: true },
      ipAddress: { type: DataTypes.STRING, allowNull: true },
      userAgent: { type: DataTypes.STRING, allowNull: true },
    },
    {
      tableName: 'audit_logs',
      updatedAt: false,
    }
  );

  AuditLog.associate = (models) => {
    AuditLog.belongsTo(models.User, { foreignKey: 'actorUserId', as: 'actor' });
  };

  return AuditLog;
};
