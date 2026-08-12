const { v4: uuidv4 } = require('uuid');

// Developer-seeded test data for the System Updates feature — these 6 rows
// exist purely to exercise the whole flow (history list, per-user
// acknowledgment gate, pulsing nav badge) without needing to publish
// anything through the Manager's UI first. created_by is left NULL since
// these weren't published by any particular user account. The notes below
// double as a real changelog of the last several feature batches, so this
// is also genuinely useful content rather than throwaway placeholder text.
// Timestamps are staggered a minute apart so "newest first" ordering is
// unambiguous — v1.0.0.6 is the latest, and is what the gate will show.
module.exports = {
  up: async (queryInterface) => {
    const base = Date.now();
    const at = (minutesAgo) => new Date(base - minutesAgo * 60 * 1000);

    await queryInterface.bulkInsert('system_updates', [
      {
        id: uuidv4(),
        version: '1.0.0.1',
        title: 'Role assignment history',
        notes:
          'The Role Assignments table now only shows each user\'s current active role. Every past grant or revoke is preserved in a new Role Assignment History table, so you can trace who held what role and when.',
        created_by: null,
        created_at: at(50),
      },
      {
        id: uuidv4(),
        version: '1.0.0.2',
        title: 'Logout confirmation + Manager visibility fixes',
        notes:
          'Logging out now asks for confirmation first. The Manager account no longer appears as an assignable option in Role Assignments or team-staff pickers, since it sits outside the normal staff structure.',
        created_by: null,
        created_at: at(40),
      },
      {
        id: uuidv4(),
        version: '1.0.0.3',
        title: 'Medical Leave overhaul',
        notes:
          'Medical Leave is now applied for with a start date only. Once the staff member returns, an admin records the return date and the system automatically counts working days (weekends and public holidays excluded), draws down the medical leave balance, and records any days beyond the entitlement as unpaid. Remaining/entitled/unpaid days are now visible on each staff member\'s profile in the Users page.',
        created_by: null,
        created_at: at(30),
      },
      {
        id: uuidv4(),
        version: '1.0.0.4',
        title: 'Team Admin scoping + Public Holidays tab',
        notes:
          'A Team Admin can now only manage their own team, not every team, unless the Manager grants broader access. Added a new Public Holidays tab (Manager-managed, delegable) — every date added there is automatically excluded from all leave day calculations app-wide.',
        created_by: null,
        created_at: at(20),
      },
      {
        id: uuidv4(),
        version: '1.0.0.5',
        title: 'Users page leave balance panel',
        notes:
          'Opening a staff member\'s profile in the Users page now shows a Leave Balance section (entitled/remaining/unpaid days) right after their team, visible to whoever manages that person\'s leave. The Edit staff record button now sits at the very bottom of the panel.',
        created_by: null,
        created_at: at(10),
      },
      {
        id: uuidv4(),
        version: '1.0.0.6',
        title: 'System Updates — this feature',
        notes:
          'Introducing System Updates: whenever a new version is published here, every user is shown a mandatory notice they must agree to before doing anything else in the app, and the System Updates tab shows a pulsing reminder until they do. These 6 entries are seeded test data to verify that flow end-to-end.',
        created_by: null,
        created_at: at(0),
      },
    ]);
  },
  down: async (queryInterface) => {
    await queryInterface.bulkDelete('system_updates', { version: ['1.0.0.1', '1.0.0.2', '1.0.0.3', '1.0.0.4', '1.0.0.5', '1.0.0.6'] });
  },
};
