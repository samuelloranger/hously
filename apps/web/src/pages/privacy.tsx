import { createFileRoute, Link } from '@tanstack/react-router';

export const Route = createFileRoute('/privacy')({
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950">
      <div className="mx-auto w-full max-w-3xl px-6 py-12 sm:py-16">
        <div className="space-y-6">
          <div className="space-y-2">
            <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
              Last updated: February 10, 2026
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 dark:text-white sm:text-4xl">
              Privacy Policy
            </h1>
            <p className="text-base text-neutral-600 dark:text-neutral-400">
              This Privacy Policy explains what Hously collects, why we collect it, and how we use it.
            </p>
          </div>
          <div className="prose prose-neutral max-w-none dark:prose-invert">
            <h2>Overview</h2>
            <p>
              Hously is a self-hosted homelab command center. It stores the information you enter so you can manage your
              infrastructure, media pipeline, chores, shopping, recipes, meal plans, and reminders across your devices.
            </p>
            <h2>Information We Collect</h2>
            <ul>
              <li>
                <strong>Account data</strong>: email address, password hash, optional name, locale, and avatar URL.
              </li>
              <li>
                <strong>User content</strong>: chores, shopping items, recipes and ingredients, meal plans, calendar
                events, reminders, notifications, and task completion history.
              </li>
              <li>
                <strong>Notification data</strong>: push subscription details, device metadata (device name, OS,
                browser), and mobile push tokens.
              </li>
              <li>
                <strong>Security data</strong>: refresh tokens and password-reset tokens.
              </li>
              <li>
                <strong>Service logs</strong>: webhook events and related payloads for external notification services.
              </li>
              <li>
                <strong>Technical data</strong>: IP address is used for rate limiting and abuse prevention.
              </li>
            </ul>
            <h2>How We Use Information</h2>
            <ul>
              <li>Provide the core app features you use every day.</li>
              <li>Authenticate users and secure accounts.</li>
              <li>Send notifications you request or enable.</li>
              <li>Maintain service reliability, auditing, and debugging.</li>
            </ul>
            <h2>Sharing</h2>
            <p>
              We do not sell your data. We share information only with service providers needed to operate Hously, such
              as push notification providers and object storage used to host avatar images.
            </p>
            <h2>Storage</h2>
            <p>Data is stored in our database, and uploaded images are stored in object storage.</p>
            <h2>Retention</h2>
            <p>
              We retain account and user content while your account is active. Security tokens and notification
              subscriptions are removed when they expire, are revoked, or become invalid. Logs are kept for
              troubleshooting and auditing.
            </p>
            <h2>Your Choices</h2>
            <ul>
              <li>You can update profile details and content within the app.</li>
              <li>You can disable notifications in the app or your device.</li>
              <li>You can request account deletion from the admin for your deployment.</li>
            </ul>
            <h2>Security</h2>
            <p>
              We use industry-standard practices like password hashing, secure tokens, and rate limiting to protect
              accounts and data.
            </p>
            <h2>Changes</h2>
            <p>If we change this policy, we will update the date above and post the new version on this page.</p>
            <h2>Questions</h2>
            <p>For privacy questions, contact the administrator of your Hously deployment.</p>
          </div>
          <div className="text-sm text-neutral-500 dark:text-neutral-400">
            Read our{' '}
            <Link to="/terms" className="font-medium text-primary-600 dark:text-primary-400">
              Terms of Service
            </Link>
            .
          </div>
        </div>
      </div>
    </div>
  );
}
