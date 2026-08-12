const fs = require('fs');

// Identifies a file's *actual* type from its first few bytes ("magic
// numbers"), independent of whatever extension/Content-Type the client
// claimed at upload time. multer's fileFilter (see middlewares/
// upload.middleware.js) only ever sees the client-reported mimetype, which
// is trivial to spoof — a renamed .exe with `Content-Type: application/pdf`
// sails straight through it. This is the actual content check, run after
// the file has been written to disk.
//
// Deliberately narrow: covers exactly the types this app accepts (PDF, DOC,
// DOCX, JPEG, PNG, WEBP) rather than being a general-purpose sniffer, so
// there's no extra dependency to install or keep patched for it.
//
// One known limitation: DOCX (and every other modern Office format) is a
// ZIP container, and this only verifies the outer bytes are a valid ZIP
// local-file-header — it can't distinguish a real .docx from a same-shaped
// .xlsx/.pptx/.zip without unzipping and checking the internal manifest.
// That's an accepted gap: the goal here is blocking executables/scripts
// disguised as documents, not policing which Office format someone uploads.
const SIGNATURES = {
  'application/pdf': [{ bytes: [0x25, 0x50, 0x44, 0x46] }], // "%PDF"
  'image/jpeg': [{ bytes: [0xff, 0xd8, 0xff] }],
  'image/png': [{ bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }],
  'image/webp': [
    { bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 }, // "RIFF"
    { bytes: [0x57, 0x45, 0x42, 0x50], offset: 8 }, // "WEBP"
  ],
  'application/msword': [{ bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] }], // OLE compound file
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
    { bytes: [0x50, 0x4b, 0x03, 0x04] }, // ZIP local file header ("PK\x03\x04")
  ],
};

const HEADER_BYTES_NEEDED = 16;

const readHeader = (filePath) => {
  const fd = fs.openSync(filePath, 'r');
  try {
    const buffer = Buffer.alloc(HEADER_BYTES_NEEDED);
    const bytesRead = fs.readSync(fd, buffer, 0, HEADER_BYTES_NEEDED, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    fs.closeSync(fd);
  }
};

const matchesSignature = (header, rules) =>
  rules.every(({ bytes, offset = 0 }) => bytes.every((b, i) => header[offset + i] === b));

// True if the file at `filePath` actually starts with the magic bytes
// expected for `claimedMimeType`. An mimetype outside SIGNATURES fails
// closed (returns false) rather than open — shouldn't happen in practice
// since multer's fileFilter already restricts uploads to this same
// allow-list (see PURPOSE_CONFIG in upload.middleware.js), but if the two
// ever drift, this is the safer default.
const matchesClaimedType = (filePath, claimedMimeType) => {
  const rules = SIGNATURES[claimedMimeType];
  if (!rules) return false;
  const header = readHeader(filePath);
  return matchesSignature(header, rules);
};

module.exports = { matchesClaimedType };
