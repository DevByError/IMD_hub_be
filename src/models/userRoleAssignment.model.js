module.exports = (sequelize, DataTypes) => {
  const UserRoleAssignment = sequelize.define(
    'UserRoleAssignment',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false },
      roleId: { type: DataTypes.UUID, allowNull: false },
      scopeType: { type: DataTypes.ENUM('global', 'team'), allowNull: false, defaultValue: 'global' },
      scopeId: { type: DataTypes.UUID, allowNull: true }, // team id when scopeType = 'team', else null
      grantedBy: { type: DataTypes.UUID, allowNull: false },
      validFrom: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      validUntil: { type: DataTypes.DATE, allowNull: true }, // null = indefinite
      status: {
        type: DataTypes.ENUM('active', 'expired', 'revoked'),
        allowNull: false,
        defaultValue: 'active',
      },
    },
    {
      tableName: 'user_role_assignments',
    }
  );

  UserRoleAssignment.associate = (models) => {
    UserRoleAssignment.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
    UserRoleAssignment.belongsTo(models.Role, { foreignKey: 'roleId', as: 'role' });
    UserRoleAssignment.belongsTo(models.User, { foreignKey: 'grantedBy', as: 'grantor' });
    UserRoleAssignment.belongsTo(models.Team, { foreignKey: 'scopeId', as: 'scopeTeam', constraints: false });
  };

  return UserRoleAssignment;
};
