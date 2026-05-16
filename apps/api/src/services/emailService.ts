import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getBaseUrl, getSmtpConfig } from "@hously/api/config";

let transporter: Transporter | null = null;

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

export function _resetTransporter(): void {
  transporter = null;
}

export function isEmailConfigured(): boolean {
  return getSmtpConfig() !== null;
}

// Load pre-rendered templates once at startup
const RENDERED_DIR = join(import.meta.dir, "../emails/rendered");

function load(name: string): string {
  return readFileSync(join(RENDERED_DIR, name), "utf-8");
}

const templates = {
  invitation: {
    en: { html: load("invitation.en.html"), txt: load("invitation.en.txt") },
    fr: { html: load("invitation.fr.html"), txt: load("invitation.fr.txt") },
  },
  passwordReset: {
    en: {
      html: load("password-reset.en.html"),
      txt: load("password-reset.en.txt"),
    },
    fr: {
      html: load("password-reset.fr.html"),
      txt: load("password-reset.fr.txt"),
    },
  },
} as const;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text?: string,
): Promise<boolean> {
  const transport = getTransporter();
  const config = getSmtpConfig();

  if (!transport || !config) {
    console.warn("[email] SMTP not configured, cannot send email");
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
  locale: string = "en",
): Promise<boolean> {
  const baseUrl = getBaseUrl();
  const acceptUrl = `${baseUrl}/accept-invitation?token=${token}`;

  if (!isEmailConfigured()) {
    console.log(
      `[email] SMTP not configured. Invitation URL for ${email}: ${acceptUrl}`,
    );
    return true;
  }

  const isFr = locale.startsWith("fr");
  const subject = isFr
    ? "Vous avez été invité sur Hously"
    : "You've been invited to Hously";

  const t = isFr ? templates.invitation.fr : templates.invitation.en;
  const html = t.html
    .replaceAll("__ACCEPT_URL__", acceptUrl)
    .replaceAll("__INVITER_NAME__", escapeHtml(inviterName));
  const text = t.txt
    .replaceAll("__ACCEPT_URL__", acceptUrl)
    .replaceAll("__INVITER_NAME__", inviterName);

  return sendEmail(email, subject, html, text);
}

export async function sendPasswordResetEmail(
  email: string,
  token: string,
  locale: string = "en",
): Promise<boolean> {
  const baseUrl = getBaseUrl();
  const resetUrl = /^https?:\/\//.test(token)
    ? token
    : `${baseUrl}/reset-password?token=${token}`;

  if (!isEmailConfigured()) {
    console.log(
      `[email] SMTP not configured. Password reset URL for ${email}: ${resetUrl}`,
    );
    return true;
  }

  const isFr = locale.startsWith("fr");
  const subject = isFr
    ? "Réinitialiser votre mot de passe Hously"
    : "Reset your Hously password";

  const t = isFr ? templates.passwordReset.fr : templates.passwordReset.en;
  const html = t.html.replaceAll("__RESET_URL__", resetUrl);
  const text = t.txt.replaceAll("__RESET_URL__", resetUrl);

  return sendEmail(email, subject, html, text);
}
