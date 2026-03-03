import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { render } from '@react-email/render';
import { getBaseUrl } from '../utils/config';
import { InvitationEmail } from '../emails/InvitationEmail';
import { PasswordResetEmail } from '../emails/PasswordResetEmail';

let transporter: Transporter | null = null;

function getSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || 'noreply@localhost';
  const fromName = process.env.SMTP_FROM_NAME || 'Hously';

  if (!host || !user || !pass) {
    return null;
  }

  return { host, port, user, pass, from, fromName };
}

function getTransporter(): Transporter | null {
  if (transporter) return transporter;

  const config = getSmtpConfig();
  if (!config) return null;

  transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });

  return transporter;
}

export function isEmailConfigured(): boolean {
  return getSmtpConfig() !== null;
}

export async function sendEmail(to: string, subject: string, html: string, text?: string): Promise<boolean> {
  const transport = getTransporter();
  const config = getSmtpConfig();

  if (!transport || !config) {
    console.warn('[email] SMTP not configured, cannot send email');
    return false;
  }

  try {
    await transport.sendMail({
      from: `"${config.fromName}" <${config.from}>`,
      to,
      subject,
      html,
      text: text || subject,
    });
    console.log(`[email] Sent email to ${to}: ${subject}`);
    return true;
  } catch (error) {
    console.error(`[email] Failed to send email to ${to}:`, error);
    return false;
  }
}

export async function sendInvitationEmail(
  email: string,
  token: string,
  inviterName: string,
  locale: string = 'en'
): Promise<boolean> {
  const baseUrl = getBaseUrl();
  const acceptUrl = `${baseUrl}/accept-invitation?token=${token}`;

  if (!isEmailConfigured()) {
    console.log(`[email] SMTP not configured. Invitation URL for ${email}: ${acceptUrl}`);
    return true;
  }

  const isFr = locale.startsWith('fr');
  const subject = isFr
    ? 'Vous avez \u00e9t\u00e9 invit\u00e9 sur Hously'
    : "You've been invited to Hously";

  const html = await render(InvitationEmail({ acceptUrl, inviterName, locale }));
  const text = await render(InvitationEmail({ acceptUrl, inviterName, locale }), { plainText: true });

  return sendEmail(email, subject, html, text);
}

export async function sendPasswordResetEmail(
  email: string,
  token: string,
  locale: string = 'en'
): Promise<boolean> {
  const baseUrl = getBaseUrl();
  const resetUrl = `${baseUrl}/reset-password?token=${token}`;

  if (!isEmailConfigured()) {
    console.log(`[email] SMTP not configured. Password reset URL for ${email}: ${resetUrl}`);
    return true;
  }

  const isFr = locale.startsWith('fr');
  const subject = isFr
    ? 'R\u00e9initialiser votre mot de passe Hously'
    : 'Reset your Hously password';

  const html = await render(PasswordResetEmail({ resetUrl, locale }));
  const text = await render(PasswordResetEmail({ resetUrl, locale }), { plainText: true });

  return sendEmail(email, subject, html, text);
}
