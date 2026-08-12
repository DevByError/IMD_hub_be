const { v4: uuidv4 } = require('uuid');

// key, description, category, isDelegable
// The three "false" rows are the Manager-exclusive, non-delegable permissions
// discussed in the spec — they must never be offered when building a custom
// bundle for anyone else, enforced again at the service layer, not just here.
const PERMISSIONS = [
  ['role.create', 'Create custom roles / permission bundles', 'system', false],
  ['role.assign', 'Assign, reassign, or revoke a role for any user', 'system', false],
  ['permission_bundle.create', 'Build a custom named permission bundle', 'system', false],

  ['team.create', 'Create a team', 'team', true],
  ['team.manage', 'Manage a team and its staff', 'team', true],
  ['user.manage', 'Edit staff profiles', 'user', true],
  ['registration.approve', 'Approve or reject registration requests', 'user', true],

  ['leave.view.annual', 'View Annual Leave requests', 'leave', true],
  ['leave.approve.annual', 'Approve/reject Annual Leave requests', 'leave', true],
  ['leave.view.medical', 'View Medical Leave requests', 'leave', true],
  ['leave.view.special', 'View Special Leave requests', 'leave', true],
  ['leave.approve.special', 'Approve/reject Special Leave requests', 'leave', true],
  ['leave.view.unpaid', 'View Unpaid Leave requests', 'leave', true],
  ['leave.approve.unpaid', 'Approve/reject Unpaid Leave requests', 'leave', true],
  ['leave.policy.manage', 'Configure leave policies, entitlements, holiday calendar', 'leave', true],
  ['leave.override', 'Edit or cancel a leave request on the applicant\'s behalf after submission', 'leave', true],

  ['attendance.view', 'View attendance records (future module)', 'attendance', true],
  ['attendance.manage', 'Manage attendance records (future module)', 'attendance', true],
  ['attendance.approve', 'Approve attendance corrections (future module)', 'attendance', true],

  ['audit.view', 'View the audit log', 'system', true],
];

module.exports = {
  up: async (queryInterface) => {
    const now = new Date();
    const rows = PERMISSIONS.map(([key, description, category, isDelegable]) => ({
      id: uuidv4(),
      key,
      description,
      category,
      is_delegable: isDelegable,
      created_at: now,
      updated_at: now,
    }));
    await queryInterface.bulkInsert('permissions', rows);
  },
  down: async (queryInterface) => {
    await queryInterface.bulkDelete('permissions', null, {});
  },
};
