const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');

// Bootstraps the single root Manager account from env vars, since every other
// account in the system (including Department Admin) is created via the
// registration-approval flow, which itself requires a Manager to already exist.
// Set BOOTSTRAP_MANAGER_EMAIL / BOOTSTRAP_MANAGER_PASSWORD before running
// `npm run seed` — never commit real credentials here.
module.exports = {
  up: async (queryInterface) => {
    const email = process.env.BOOTSTRAP_MANAGER_EMAIL;
    const password = process.env.BOOTSTRAP_MANAGER_PASSWORD;
    const fullName = process.env.BOOTSTRAP_MANAGER_NAME || 'Department Manager';

    if (!email || !password) {
      // eslint-disable-next-line no-console
      console.warn(
        'Skipping Manager bootstrap: set BOOTSTRAP_MANAGER_EMAIL and BOOTSTRAP_MANAGER_PASSWORD in .env and rerun `npm run seed` to create the root account.'
      );
      return;
    }

    const now = new Date();
    const userId = uuidv4();
    const passwordHash = await bcrypt.hash(password, 12);

    await queryInterface.bulkInsert('users', [
      {
        id: userId,
        full_name: fullName,
        email,
        password_hash: passwordHash,
        status: 'active',
        created_at: now,
        updated_at: now,
      },
    ]);

    const [[managerRole]] = await queryInterface.sequelize.query(
      "SELECT id FROM roles WHERE name = 'Department Manager' LIMIT 1"
    );

    await queryInterface.bulkInsert('user_role_assignments', [
      {
        id: uuidv4(),
        user_id: userId,
        role_id: managerRole.id,
        scope_type: 'global',
        scope_id: null,
        granted_by: userId, // self-granted at bootstrap time
        valid_from: now,
        valid_until: null,
        status: 'active',
        created_at: now,
        updated_at: now,
      },
    ]);
  },
  down: async (queryInterface) => {
    const email = process.env.BOOTSTRAP_MANAGER_EMAIL;
    if (!email) return;
    await queryInterface.bulkDelete('users', { email }, {});
  },
};
