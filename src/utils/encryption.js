const crypto = require('crypto');

// Application-layer encryption for sensitive fields at rest — currently just
// idDocumentNumber (passport/IC), per the spec's security checklist ("Sensitive
// fields encrypted at rest and masked in the UI by default"). AES-256-GCM:
// authenticated encryption, so a tampered/corrupted blob fails loudly on
// decrypt rather than silently returning garbage.
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // standard/recommended IV length for GCM
const VERSION_PREFIX = 'v1';

const getKey = () => {
  const raw = process.env.ID_DOCUMENT_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      'ID_DOCUMENT_ENCRYPTION_KEY must be set (32 random bytes, base64-encoded — generate with `openssl rand -base64 32`).'
    );
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error(
      'ID_DOCUMENT_ENCRYPTION_KEY must decode to exactly 32 bytes for AES-256. Generate one with `openssl rand -base64 32`.'
    );
  }
  return key;
};

// Non-deterministic on purpose (fresh random IV every call) — this field is
// never queried by equality/search, so there's no reason to trade that away
// for a deterministic scheme. Stored shape: "v1:<iv>:<authTag>:<ciphertext>",
// all base64 — versioned so the scheme (or key) can change later without
// breaking rows that haven't been re-encrypted yet.
const encryptField = (plaintext) => {
  if (plaintext === null || plaintext === undefined || plaintext === '') return plaintext;
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [VERSION_PREFIX, iv.toString('base64'), authTag.toString('base64'), ciphertext.toString('base64')].join(':');
};

const isEncrypted = (value) => typeof value === 'string' && value.startsWith(`${VERSION_PREFIX}:`);

// Defensive: if a value doesn't look like one of our encrypted blobs (e.g. a
// legacy plaintext row the data migration hasn't reached yet), return it
// as-is rather than throwing — avoids a hard crash on read for a transitional
// row. The migration (see migrations/) is what actually closes that gap.
const decryptField = (stored) => {
  if (stored === null || stored === undefined || stored === '') return stored;
  if (!isEncrypted(stored)) return stored;

  const [, ivB64, authTagB64, ciphertextB64] = stored.split(':');
  const key = getKey();
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const ciphertext = Buffer.from(ciphertextB64, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
};

// Last-4-visible mask for UI display ("••••4821"). Four characters or fewer
// show only the last one — never the full value — so a short ID scheme
// doesn't accidentally reveal everything.
const maskIdNumber = (plaintext) => {
  if (!plaintext) return plaintext;
  const str = String(plaintext);
  const visible = str.length > 4 ? str.slice(-4) : str.slice(-1);
  const hiddenCount = Math.max(str.length - visible.length, 4);
  return `${'•'.repeat(hiddenCount)}${visible}`;
};

module.exports = { encryptField, decryptField, isEncrypted, maskIdNumber };
