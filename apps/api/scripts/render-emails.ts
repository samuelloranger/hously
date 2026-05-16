import { render } from "@react-email/render";
import { InvitationEmail } from "@hously/api/emails/InvitationEmail";
import { PasswordResetEmail } from "@hously/api/emails/PasswordResetEmail";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const OUTPUT_DIR = join(import.meta.dir, "../src/emails/rendered");
mkdirSync(OUTPUT_DIR, { recursive: true });

const LOCALES = ["en", "fr"] as const;

for (const locale of LOCALES) {
  const invHtml = await render(
    InvitationEmail({
      acceptUrl: "__ACCEPT_URL__",
      inviterName: "__INVITER_NAME__",
      locale,
    }),
  );
  const invText = await render(
    InvitationEmail({
      acceptUrl: "__ACCEPT_URL__",
      inviterName: "__INVITER_NAME__",
      locale,
    }),
    { plainText: true },
  );
  writeFileSync(join(OUTPUT_DIR, `invitation.${locale}.html`), invHtml);
  writeFileSync(join(OUTPUT_DIR, `invitation.${locale}.txt`), invText);

  const resetHtml = await render(
    PasswordResetEmail({ resetUrl: "__RESET_URL__", locale }),
  );
  const resetText = await render(
    PasswordResetEmail({ resetUrl: "__RESET_URL__", locale }),
    { plainText: true },
  );
  writeFileSync(join(OUTPUT_DIR, `password-reset.${locale}.html`), resetHtml);
  writeFileSync(join(OUTPUT_DIR, `password-reset.${locale}.txt`), resetText);
}

console.log(`Rendered email templates → ${OUTPUT_DIR}`);
