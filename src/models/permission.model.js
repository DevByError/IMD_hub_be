module.exports = (sequelize, DataTypes) => {
  const Permission = sequelize.define(
    'Permission',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      key: { type: DataTypes.STRING, allowNull: false, unique: true }, // e.g. "leave.approve.annual"
      description: { type: DataTypes.STRING, allowNull: true },
      category: { type: DataTypes.STRING, allowNull: true },
      // Manager-exclusive permissions (role.create, role.assign, permission_bundle.create)
      // are is_delegable = false and are filtered out server-side whenever a bundle
      // is being built for anyone other than the Manager. Never trust the client for this.
      isDelegable: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    {
      tableName: 'permissions',
    }
  );

  Permission.associate = (models) => {
    Permission.belongsToMany(models.Role, { through: models.RolePermission, foreignKey: 'permissionId', as: 'roles' });
  };

  return Permission;
};
