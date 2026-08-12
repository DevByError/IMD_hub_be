const bcrypt = require('bcrypt');
const crypto = require('crypto');

const OTP_LENGTH = 6;
const OTP_TTL_MINUTES = 10; // long enough to survive slow email delivery
const MAX_OTP_ATTEMPTS = 5;

const generateOtp = () => {
  // Cryptographically random, not Math.random().
  const n = crypto.randomInt(0, 10 ** OTP_LENGTH);
  return String(n).padStart(OTP_LENGTH, '0');
};

const hashOtp = (otp) => bcrypt.hash(otp, 10);
const compareOtp = (otp, hash) => bcrypt.compare(otp, hash);

module.exports = { generateOtp, hashOtp, compareOtp, OTP_TTL_MINUTES, MAX_OTP_ATTEMPTS };
