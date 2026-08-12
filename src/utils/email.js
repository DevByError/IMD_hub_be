const { logger } = require('./logger');

let cachedTransporter = null;

const getTransporter = () => {
  if (cachedTransporter) return cachedTransporter;

  let nodemailer;
  try {
    nodemailer = require('nodemailer');
  } catch (err) {
    throw new Error('nodemailer is not installed. Run `npm install`.');
  }

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    throw new Error('Missing GMAIL_USER or GMAIL_APP_PASSWORD in environment.');
  }

  // Gmail SMTP is fine for development/low volume. Before company-wide
  // rollout, swap this for a transactional provider (SES/SendGrid/Postmark) —
  // Gmail has daily sending caps and can throttle automated mail.
  cachedTransporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user, pass },
    connectionTimeout: 30000,
    greetingTimeout: 30000,
    socketTimeout: 30000,
  });

  return cachedTransporter;
};

const sendMail = async ({ to, subject, html }) => {
  const transporter = getTransporter();
  const fromEmail = process.env.GMAIL_USER;
  try {
    await transporter.sendMail({ from: `IMD HUB <${fromEmail}>`, to, subject, html });
  } catch (err) {
    logger.error(`sendMail failed for ${to}: ${err.message}`);
    throw err;
  }
};

const sendOtpEmail = (to, otp, { minutesValid }) =>
  sendMail({
    to,
    subject: 'Your IMD HUB verification code',
    html: `
      <div style="font-family: Arial, sans-serif; padding:20px; max-width:600px; margin:0 auto;">
        <h2>Verification code</h2>
        <p>Use the code below. It expires in <strong>${minutesValid} minutes</strong>.</p>
        <div style="background:#f5f5f5; padding:16px; border-radius:8px; text-align:center; margin:16px 0;">
          <span style="font-size:32px; font-weight:700; letter-spacing:6px;">${otp}</span>
        </div>
        <p style="font-size:12px; color:#666;">If you did not request this, you can ignore this email.</p>
      </div>
    `,
  });

const sendPasswordChangedEmail = (to) =>
  sendMail({
    to,
    subject: 'Your IMD HUB password was changed',
    html: `
      <div style="font-family: Arial, sans-serif; padding:20px; max-width:600px; margin:0 auto;">
        <h2>Password changed</h2>
        <p>Your password was just changed. If this wasn't you, contact your Department Admin or Manager immediately.</p>
      </div>
    `,
  });

const sendRegistrationApprovedEmail = (to, { fullName, loginUrl }) =>
  sendMail({
    to,
    subject: 'Your IMD HUB account has been approved',
    html: `
      <div style="font-family: Arial, sans-serif; padding:20px; max-width:600px; margin:0 auto;">
        <h2>Welcome, ${fullName}</h2>
        <p>Your registration has been approved and your account is now active.</p>
        <p><a href="${loginUrl}">Log in to IMD HUB</a></p>
      </div>
    `,
  });

const sendRegistrationRejectedEmail = (to, { fullName, reason }) =>
  sendMail({
    to,
    subject: 'Your IMD HUB registration request',
    html: `
      <div style="font-family: Arial, sans-serif; padding:20px; max-width:600px; margin:0 auto;">
        <h2>Hi ${fullName},</h2>
        <p>Your registration request was not approved.</p>
        ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
        <p>If you believe this is a mistake, contact your administrator.</p>
      </div>
    `,
  });

const sendLeaveDecisionEmail = (to, { fullName, leaveTypeName, status, startDate, endDate, comment }) =>
  sendMail({
    to,
    subject: `Your ${leaveTypeName} leave request was ${status}`,
    html: `
      <div style="font-family: Arial, sans-serif; padding:20px; max-width:600px; margin:0 auto;">
        <h2>Hi ${fullName},</h2>
        <p>Your ${leaveTypeName} leave request for ${startDate} to ${endDate} was <strong>${status}</strong>.</p>
        ${comment ? `<p><strong>Comment:</strong> ${comment}</p>` : ''}
      </div>
    `,
  });

module.exports = {
  sendMail,
  sendOtpEmail,
  sendPasswordChangedEmail,
  sendRegistrationApprovedEmail,
  sendRegistrationRejectedEmail,
  sendLeaveDecisionEmail,
};
