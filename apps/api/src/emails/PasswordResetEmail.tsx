import { Button, Text } from "@react-email/components";
import { EmailLayout } from "./EmailLayout";

interface PasswordResetEmailProps {
  resetUrl: string;
  locale: string;
}

export function PasswordResetEmail({
  resetUrl,
  locale,
}: PasswordResetEmailProps) {
  const isFr = locale.startsWith("fr");

  const heading = isFr
    ? "R\u00e9initialisation du mot de passe"
    : "Password Reset";

  const preview = isFr
    ? "R\u00e9initialisez votre mot de passe Hously"
    : "Reset your Hously password";

  const bodyText = isFr
    ? "Vous avez demand\u00e9 la r\u00e9initialisation de votre mot de passe. Cliquez sur le bouton ci-dessous pour en choisir un nouveau."
    : "You requested a password reset. Click the button below to choose a new password.";

  const buttonText = isFr
    ? "R\u00e9initialiser le mot de passe"
    : "Reset Password";

  const expiry = isFr
    ? "Ce lien expire dans 1 heure."
    : "This link expires in 1 hour.";

  const ignore = isFr
    ? "Si vous n'avez pas demand\u00e9 cette r\u00e9initialisation, ignorez simplement cet e-mail."
    : "If you didn't request this, you can safely ignore this email.";

  const fallback = isFr
    ? "Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :"
    : "If the button doesn't work, copy this link into your browser:";

  return (
    <EmailLayout heading={heading} preview={preview}>
      <Text className="m-0 mb-6 text-base leading-relaxed text-gray-700">
        {bodyText}
      </Text>
      <div className="my-8 text-center">
        <Button
          href={resetUrl}
          className="inline-block rounded-lg bg-indigo-600 px-8 py-3.5 text-base font-semibold text-white no-underline"
        >
          {buttonText}
        </Button>
      </div>
      <Text className="m-0 mb-2 text-[13px] text-gray-500">{expiry}</Text>
      <Text className="m-0 mb-4 text-[13px] text-gray-500">{ignore}</Text>
      <Text className="m-0 break-all text-xs text-gray-400">
        {fallback}
        <br />
        {resetUrl}
      </Text>
    </EmailLayout>
  );
}
