const nodemailer = require("nodemailer");

function getTransporter() {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  if (!user || !pass) {
    throw new Error("EMAIL_USER and EMAIL_PASS must be set for email delivery");
  }

  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = parseInt(process.env.SMTP_PORT || "465", 10);
  const secure = process.env.SMTP_SECURE !== "false";

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

/**
 * @param {string} email
 * @param {string} token
 */
async function sendResetEmail(email, token) {
  const transporter = getTransporter();
  const link = `saveabite-app://reset-password?token=${token}`;
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Reset your SaveABite password",
    text: `Reset your password using this link:\n${link}`,
    html: `<p>Reset your password using the link below:</p><p><a href="${link}">${link}</a></p>`,
  });
}

/**
 * @param {string} email
 * @param {string} tempPassword
 */
async function sendTempPasswordEmail(email, tempPassword) {
  const transporter = getTransporter();
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Temporary Password for SaveABite",
    text: `You requested a password reset. Your temporary password is:\n\n${tempPassword}\n\nPlease use this to log in, then change your password immediately from your profile settings under "Privacy & Security".`,
    html: `
      <p>You requested a password reset.</p>
      <p>Your temporary password is:</p>
      <h3 style="font-size: 20px; color: #244F42; background: #f4f4f4; padding: 10px; display: inline-block; border-radius: 5px;">${tempPassword}</h3>
      <p>Please log in to the SaveABite app using this password, and change it immediately from your profile settings under <strong>Privacy & Security</strong>.</p>
    `,
  });
}

module.exports = { sendResetEmail, sendTempPasswordEmail };
