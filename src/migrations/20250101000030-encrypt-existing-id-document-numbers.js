const { encryptField, isEncrypted } = require('../utils/encryption');

// One-time data migration: encrypts any pre-existing plaintext
// id_document_number values (users + registration_requests) now that the
// model layer (see user.model.js / registrationRequest.model.js) encrypts
// this field transparently going forward. Idempotent — safe to run against a
// table that's empty, already encrypted, or partially encrypted, since only
// rows that don't already look like a "v1:..." blob get touched. Requires
// ID_DOCUMENT_ENCRYPTION_KEY to be set when this runs, same as any other
// migrate invocation from here on.
module.exports = {
  up: async (queryInterface) => {
    for (const table of ['users', 'registration_requests']) {
      const [rows] = await queryInterface.sequelize.query(
        `SELECT id, id_document_number FROM ${table} WHERE id_document_number IS NOT NULL AND id_document_number != ''`
      );

      for (const row of rows) {
        if (isEncrypted(row.id_document_number)) continue;
        const encrypted = encryptField(row.id_document_number);
        await queryInterface.sequelize.query(`UPDATE ${table} SET id_document_number = ? WHERE id = ?`, {
          replacements: [encrypted, row.id],
        });
      }
    }
  },
  down: async () => {
    // Deliberately not reversible: decrypting back to plaintext on rollback
    // would defeat the point of the migration. Restore from a pre-migration
    // backup if you genuinely need to undo this.
  },
};
