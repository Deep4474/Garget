require('dotenv').config();
const nodemailer = require('nodemailer');

(async () => {
  const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
  const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
  const SMTP_USER = process.env.SMTP_USER;
  const SMTP_PASS = process.env.SMTP_PASS;

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  });

  try {
    console.log('Running transporter.verify()...');
    await transporter.verify();
    console.log('SMTP verify succeeded');
  } catch (err) {
    console.error('SMTP verify failed:', err && err.message ? err.message : err);
  }

  try {
    console.log('Attempting to send test message...');
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || SMTP_USER,
      to: SMTP_USER,
      subject: 'SMTP test',
      text: 'This is a test message from smtp-test.js'
    });
    console.log('sendMail success:', info && (info.messageId || info.response));
  } catch (err) {
    console.error('sendMail failed:', err && err.message ? err.message : err);
  }
})();
