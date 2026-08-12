module.exports = (sequelize, DataTypes) => {
  const Role = sequelize.define(
    'Role',
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      name: { type: DataTypes.STRING, allowNull: false, unique: true },
      isSystemRole: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      createdBy: { type: DataTypes.UUID, allowNull: true },
    },
    {
      tableName: 'roles',
    }
  );

  Role.associate = (models) => {
    Role.belongsToMany(models.Permission, { through: models.RolePermission, foreignKey: 'roleId', as: 'permissions' });
    Role.hasMany(models.UserRoleAssignment, { foreignKey: 'roleId', as: 'assignments' });
  };

  return Role;
};
