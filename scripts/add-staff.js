/*
 * Reusable helper for onboarding real staff accounts with their full
 * profile in one shot, rather than the bare fullName/email/role a fresh
 * self-registration produces.
 *
 * Why this exists instead of a seeder: seeders are for one-time schema/data
 * setup tracked in SequelizeMeta (roles, permissions, the bootstrap Manager
 * account, in seeders/20250102000006-seed-manager-account.js). Onboarding
 * staff is an ongoing admin task, not a one-time setup step, so it lives
 * here as a plain script instead.
 *
 * Why not a raw SQL INSERT: going through the real Sequelize models means
 * password hashing (bcrypt) happens the same way login checks it, and
 * idDocumentNumber is encrypted automatically by the model's getter/setter
 * (see models/user.model.js) — a raw INSERT would silently store it as
 * plaintext.
 *
 * Usage:
 *   1. Copy scripts/staff-data.example.json to scripts/staff-data.json
 *      (gitignored — see be/.gitignore) and fill it with a JSON array, one
 *      object per person — see the field list on createStaffAccount below
 *      for what's accepted. Add as many as you want; all 50 in one file is
 *      fine, this loops over every row in one run.
 *   2. From be/, run:  npm run add-staff   (or: node scripts/add-staff.js)
 *   3. Every field you leave out (undefined, null, or '') is simply not
 *      set — it's left NULL, not defaulted to some placeholder — so it
 *      shows up blank until someone fills it in.
 *
 *      IMPORTANT: not every blank field can be filled in later by the
 *      employee themselves. Compare against user.service.js:
 *        - Self-editable (the employee can fill these in from their own
 *          profile page): phoneNumber, address, gender, nextOfKinName,
 *          nextOfKinContact.
 *        - Admin-only (only someone with user.manage can fill these in,
 *          from the Users page — the employee cannot): fullName,
 *          idDocumentType, idDocumentNumber, dateOfBirth, position,
 *          employmentType, dateJoined, nationality, staffId,
 *          lastAppraisalDate, status, staffStatus.
 *      Leave the self-editable ones blank freely. If you leave an
 *      admin-only one blank, plan on an admin (not the employee) filling
 *      it in later.
 *
 * Safe to rerun: any email that already exists is skipped, not duplicated.
 */

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const { sequelize, User, Role, Team, UserRoleAssignment } = require('../src/models');
const { recordAudit } = require('../src/services/audit.service');

const DEFAULT_STAFF_PASSWORD = 'password123';

// Every user_role_assignments row records who granted it (required, not
// just informational — see models/userRoleAssignment.model.js). This picks
// whichever real admin/manager account is doing the onboarding by email —
// set ONBOARDED_BY_EMAIL below to that account, or export it as an env var
// before running. Not a hardcoded person; you tell it who you are.
const ONBOARDED_BY_EMAIL = process.env.ONBOARDED_BY_EMAIL || process.env.BOOTSTRAP_MANAGER_EMAIL;

// Only these keys are ever sent to User.create — anything falsy (undefined,
// null, '') is dropped rather than written as null/empty explicitly, which
// keeps the behavior identical to "never mentioned this field at all".
const PROFILE_FIELDS = [
  'fullName',
  'email',
  'phoneNumber',
  'idDocumentType', // 'passport' | 'ic'
  'idDocumentNumber', // encrypted automatically by the model
  'dateOfBirth', // 'YYYY-MM-DD'
  'address',
  'gender', // 'male' | 'female' | 'other'
  'nationality',
  'position',
  'employmentType', // 'full_time' | 'part_time' | 'contract'
  'dateJoined', // 'YYYY-MM-DD'
  'staffId',
  'nextOfKinName',
  'nextOfKinContact',
  'lastAppraisalDate', // 'YYYY-MM-DD'
];

// Not "profile data" in the sense above (they govern login/HR state, not a
// biographical field), but still fully overridable — pass them in `data` if
// a particular hire needs something other than the default. Deliberately
// NOT part of PROFILE_FIELDS/pickNonEmpty: an empty string here should not
// silently fall through to the Sequelize column default, it should resolve
// to the explicit 'active' fallback below.
const ACCOUNT_STATE_FIELDS = ['status', 'staffStatus'];

const pickNonEmpty = (source, keys) => {
  const out = {};
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null && value !== '') out[key] = value;
  }
  return out;
};

// Data pasted in from a spreadsheet reliably carries stray leading/trailing
// whitespace (a copied cell, a trailing space someone's cursor left behind)
// that's invisible when you look at it but fails strict validation —
// that's exactly what happened here: " micdlymapang@..." and
// "Ahmed.H@example.com " both failed Sequelize's isEmail check purely
// because of the surrounding space. Trim every string field up front so
// this can't silently break a row 40 entries deep in a batch of 50.
const trimStrings = (obj) => {
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    out[key] = typeof value === 'string' ? value.trim() : value;
  }
  return out;
};

// Creates one staff account with the full profile — every User field except
// profilePhotoUrl and cvUrl, which are deliberately left out (those go
// through the app's upload flow later, not this script). `data` may include
// any of PROFILE_FIELDS above, plus:
//   - status / staffStatus: optional overrides (default 'active' for both)
//     — see ACCOUNT_STATE_FIELDS above.
//   - role: role name to assign (e.g. 'Staff', 'Team Admin') — optional; if
//     omitted, the account is created with no role and can be assigned one
//     later from the Roles & Permissions / Users page.
//   - team: team name — optional, only used if `role` is also set; when
//     present the role is granted scoped to that team instead of globally
//     (mirrors registration.service.js's approve() logic).
// Returns the created User, or null if the email already existed (skipped).
const createStaffAccount = async (rawData, { grantedByUserId }) => {
  const data = trimStrings(rawData);

  if (!data.fullName || !data.email) {
    throw new Error('fullName and email are required for every staff account.');
  }

  const existing = await User.findOne({ where: { email: data.email } });
  if (existing) {
    console.log(`Skipping ${data.email} — account already exists.`);
    return null;
  }

  const passwordHash = await bcrypt.hash(DEFAULT_STAFF_PASSWORD, 12);
  const profile = pickNonEmpty(data, PROFILE_FIELDS);

  let roleGrant = null; // { roleId, scopeType, scopeId } if a role ends up assigned

  const newUser = await sequelize.transaction(async (t) => {
    const created = await User.create(
      {
        ...profile,
        passwordHash,
        status: data.status || 'active', // 'pending' | 'active' | 'inactive' | 'suspended' — defaults to active so they can log in immediately
        staffStatus: data.staffStatus || 'active', // 'active' | 'inactive' (HR employment status)
      },
      { transaction: t }
    );

    if (data.role) {
      const role = await Role.findOne({ where: { name: data.role }, transaction: t });
      if (!role) {
        console.warn(`${data.email}: no role named "${data.role}" found — account created without a role.`);
      } else {
        let scopeType = 'global';
        let scopeId = null;
        if (data.team) {
          const team = await Team.findOne({ where: { name: data.team }, transaction: t });
          if (!team) {
            console.warn(`${data.email}: no team named "${data.team}" found — assigning "${data.role}" globally instead.`);
          } else {
            scopeType = 'team';
            scopeId = team.id;
          }
        }

        await UserRoleAssignment.create(
          {
            userId: created.id,
            roleId: role.id,
            scopeType,
            scopeId,
            grantedBy: grantedByUserId,
            validUntil: null,
            status: 'active',
          },
          { transaction: t }
        );

        roleGrant = { roleId: role.id, scopeType, scopeId };
      }
    }

    return created;
  });

  // Logged the same way the Users/Roles admin UI logs these actions (see
  // role.service.js, registration.service.js) — after the transaction
  // commits, same as those do — so an account created by this script shows
  // up in the Audit Log exactly like one created through the UI. Running
  // this script is not a way to grant access invisibly.
  await recordAudit({
    actorUserId: grantedByUserId,
    action: 'user.create_via_script',
    targetType: 'User',
    targetId: newUser.id,
    metadata: { source: 'scripts/add-staff.js' },
  });

  if (roleGrant) {
    await recordAudit({
      actorUserId: grantedByUserId,
      action: 'role.assign',
      targetType: 'User',
      targetId: newUser.id,
      metadata: roleGrant,
    });
  }

  console.log(`Created ${data.email}${data.role ? ` (${data.role})` : ' (no role assigned)'}.`);
  return newUser;
};

// Real employee data does NOT live in this file. It goes in
// scripts/staff-data.json, which is listed in be/.gitignore and never gets
// committed — this file (the logic) is safe to commit, staff-data.json
// (names, ID numbers, addresses, role grants) never is. Copy
// scripts/staff-data.example.json to scripts/staff-data.json and fill in
// real rows there; this script just reads whatever's in it.
const STAFF_DATA_PATH = path.join(__dirname, 'staff-data.json');
const STAFF = fs.existsSync(STAFF_DATA_PATH) ? JSON.parse(fs.readFileSync(STAFF_DATA_PATH, 'utf8')) : [];

const run = async () => {
  if (STAFF.length === 0) {
    console.log(
      `No staff to add — ${fs.existsSync(STAFF_DATA_PATH) ? 'staff-data.json is empty' : 'staff-data.json not found'}. Copy scripts/staff-data.example.json to scripts/staff-data.json and fill in your real employee data.`
    );
    return;
  }

  await sequelize.authenticate();

  const grantedByUser = await User.findOne({ where: { email: ONBOARDED_BY_EMAIL } });
  if (!grantedByUser) {
    throw new Error(
      `Could not find an account for ONBOARDED_BY_EMAIL "${ONBOARDED_BY_EMAIL}". Set it to an existing admin/manager account's email (env var ONBOARDED_BY_EMAIL, or BOOTSTRAP_MANAGER_EMAIL in .env).`
    );
  }

  // One bad row (a typo'd enum value, a duplicate staffId, etc.) shouldn't
  // take out the other 49 — each person is tried independently and any
  // failure is collected instead of thrown, so a batch of 50 always
  // finishes and tells you exactly which ones (if any) need a second look.
  const created = [];
  const skipped = [];
  const failed = [];

  for (const staff of STAFF) {
    try {
      const result = await createStaffAccount(staff, { grantedByUserId: grantedByUser.id });
      if (result) created.push(staff.email);
      else skipped.push(staff.email);
    } catch (err) {
      failed.push({ email: staff.email || '(no email given)', reason: err.message });
    }
  }

  console.log('\n--- Summary ---');
  console.log(`Created: ${created.length}`);
  console.log(`Skipped (already existed): ${skipped.length}`);
  console.log(`Failed: ${failed.length}`);
  if (failed.length > 0) {
    failed.forEach((f) => console.log(`  - ${f.email}: ${f.reason}`));
  }

  await sequelize.close();
};

module.exports = { createStaffAccount };

if (require.main === module) {
  run().catch((err) => {
    console.error('Failed to add staff:', err.message);
    process.exit(1);
  });
}