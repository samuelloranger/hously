import { Button, Text } from "@react-email/components";
import { EmailLayout } from "./EmailLayout";

interface InvitationEmailProps {
  acceptUrl: string;
  inviterName: string;
  locale: string;
}

export function InvitationEmail({
  acceptUrl,
  inviterName,
  locale,
}: InvitationEmailProps) {
  const isFr = locale.startsWith("fr");

  const heading = isFr
    ? "Vous avez \u00e9t\u00e9 invit\u00e9 !"
    : "You've been invited!";

  const preview = isFr
    ? `${inviterName} vous invite \u00e0 rejoindre Hously`
    : `${inviterName} has invited you to join Hously`;

  const bodyText = isFr
    ? `${inviterName} vous invite \u00e0 rejoindre Hously. Cliquez sur le bouton ci-dessous pour cr\u00e9er votre compte.`
    : `${inviterName} has invited you to join Hously. Click the button below to set up your account.`;

  const buttonText = isFr ? "Accepter l'invitation" : "Accept Invitation";

  const expiry = isFr
    ? "Ce lien expire dans 7 jours."
    : "This link expires in 7 days.";

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
          href={acceptUrl}
          className="inline-block rounded-lg bg-indigo-600 px-8 py-3.5 text-base font-semibold text-white no-underline"
        >
          {buttonText}
        </Button>
      </div>
      <Text className="m-0 mb-4 text-[13px] text-gray-500">{expiry}</Text>
      <Text className="m-0 break-all text-xs text-gray-400">
        {fallback}
        <br />
        {acceptUrl}
      </Text>
    </EmailLayout>
  );
}
