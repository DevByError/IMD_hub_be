const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { AppError } = require('./errorHandler.middleware');
const { matchesClaimedType } = require('../utils/fileSignature');

// Stored outside any directory Express serves statically (this app never
// calls express.static on it) — the only way to read a file back is through
// the authenticated GET /api/files/:id route, which checks ownership/
// permission before streaming anything. CVs, MC documents, and photos are
// sensitive personal data; they don't get a guessable public URL.
const UPLOAD_ROOT = path.join(process.cwd(), 'uploads');

const PURPOSE_CONFIG = {
  cv: {
    dir: 'cv',
    maxSizeBytes: 5 * 1024 * 1024,
    allowedMimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
  },
  profile_photo: {
    dir: 'profile-photos',
    maxSizeBytes: 2 * 1024 * 1024,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  },
  mc_document: {
    dir: 'mc-documents',
    maxSizeBytes: 5 * 1024 * 1024,
    allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png'],
  },
};

const sanitizeFilename = (name) => name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100);

const buildUploader = (purpose) => {
  const config = PURPOSE_CONFIG[purpose];
  const destDir = path.join(UPLOAD_ROOT, config.dir);
  fs.mkdirSync(destDir, { recursive: true });

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, destDir),
    filename: (req, file, cb) => cb(null, `${uuidv4()}-${sanitizeFilename(file.originalname)}`),
  });

  return multer({
    storage,
    limits: { fileSize: config.maxSizeBytes },
    fileFilter: (req, file, cb) => {
      // Client-reported mimetype only — a fast, early rejection of obviously
      // wrong uploads before disk I/O even happens. This is NOT the real
      // content check (a renamed .exe with a spoofed Content-Type would
      // pass this on its own); that happens in verifyUploadedFileContent
      // below, which runs after multer writes the file and inspects its
      // actual magic bytes (see utils/fileSignature.js). Both routes that
      // accept uploads chain that middleware in right after this one.
      if (!config.allowedMimeTypes.includes(file.mimetype)) {
        return cb(new AppError(400, `Invalid file type for ${purpose}. Allowed: ${config.allowedMimeTypes.join(', ')}`));
      }
      cb(null, true);
    },
  }).single('file');
};

const uploadCv = buildUploader('cv');
const uploadProfilePhoto = buildUploader('profile_photo');
const uploadMcDocument = buildUploader('mc_document');

// The registration form is the one place a file gets uploaded by someone who
// isn't authenticated yet (no account exists until the Manager approves the
// request). Same per-purpose destination/type/size rules as above, just
// combined into a single two-field multipart handler and, critically,
// rate-limited at the route level (see registerLimiter) since this is a
// public endpoint that now accepts file uploads.
const buildRegistrationStorage = () =>
  multer.diskStorage({
    destination: (req, file, cb) => {
      const purpose = file.fieldname === 'cv' ? 'cv' : 'profile_photo';
      const destDir = path.join(UPLOAD_ROOT, PURPOSE_CONFIG[purpose].dir);
      fs.mkdirSync(destDir, { recursive: true });
      cb(null, destDir);
    },
    filename: (req, file, cb) => cb(null, `${uuidv4()}-${sanitizeFilename(file.originalname)}`),
  });

const uploadRegistrationDocs = multer({
  storage: buildRegistrationStorage(),
  limits: { fileSize: Math.max(PURPOSE_CONFIG.cv.maxSizeBytes, PURPOSE_CONFIG.profile_photo.maxSizeBytes) },
  fileFilter: (req, file, cb) => {
    const purpose = file.fieldname === 'cv' ? 'cv' : file.fieldname === 'profilePhoto' ? 'profile_photo' : null;
    if (!purpose || !PURPOSE_CONFIG[purpose].allowedMimeTypes.includes(file.mimetype)) {
      return cb(new AppError(400, `Invalid file for field "${file.fieldname}".`));
    }
    cb(null, true);
  },
}).fields([
  { name: 'cv', maxCount: 1 },
  { name: 'profilePhoto', maxCount: 1 },
]);

// Runs immediately after multer, once the file(s) are actually sitting on
// disk — fileFilter above can only ever check the client-reported mimetype
// (see the caveat on that function), so this is the real check: does each
// file's content actually start with the magic bytes for the type it claims
// to be (see utils/fileSignature.js)? A renamed .exe with a spoofed
// Content-Type passes fileFilter but fails here. Any mismatch deletes every
// file from this request (never leaves a rejected upload sitting in
// uploads/) and rejects with a 400 instead of reaching the controller.
// Works for both `.single('file')` (req.file) and `.fields([...])`
// (req.files, e.g. the registration form's cv+profilePhoto pair).
const verifyUploadedFileContent = (req, res, next) => {
  const files = req.file ? [req.file] : Object.values(req.files || {}).flat();
  if (files.length === 0) return next();

  const invalid = files.find((f) => !matchesClaimedType(f.path, f.mimetype));
  if (invalid) {
    files.forEach((f) => fs.unlink(f.path, () => {})); // best-effort cleanup, don't block the error response on it
    return next(new AppError(400, `"${invalid.originalname}" does not appear to be a valid file of its claimed type.`));
  }

  next();
};

module.exports = {
  uploadCv,
  uploadProfilePhoto,
  uploadMcDocument,
  uploadRegistrationDocs,
  verifyUploadedFileContent,
  UPLOAD_ROOT,
  PURPOSE_CONFIG,
};
