// Outgoing email (password reset) through the SMTP account of the site's mailbox, e.g. info@apexwave.pro at Hostinger.
// Settings: SMTP_HOST, SMTP_PORT (465 = TLS), SMTP_USER, SMTP_PASS, optional MAIL_FROM. MAIL_OUTBOX=<file> writes mails to a file instead (tests).
import nodemailer from 'nodemailer';
import { appendFileSync } from 'node:fs';

export const mailEnabled = () => Boolean(process.env.MAIL_OUTBOX || (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS));

let transport = null;
function getTransport() {
  const port = Number(process.env.SMTP_PORT || 465);
  return (transport ||= nodemailer.createTransport({
    host: process.env.SMTP_HOST, port, secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  }));
}

export async function sendMail({ to, subject, text }) {
  const from = process.env.MAIL_FROM || `Apex Wave Capital <${process.env.SMTP_USER}>`;
  if (process.env.MAIL_OUTBOX) return appendFileSync(process.env.MAIL_OUTBOX, `${JSON.stringify({ from, to, subject, text })}\n`);
  await getTransport().sendMail({ from, to, subject, text });
}
