import { Link } from "@tanstack/react-router";

export function Terms() {
  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950">
      <div className="mx-auto w-full max-w-3xl px-6 py-12 sm:py-16">
        <div className="space-y-6">
          <div className="space-y-2">
            <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
              Last updated: February 10, 2026
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 dark:text-white sm:text-4xl">
              Terms of Service
            </h1>
            <p className="text-base text-neutral-600 dark:text-neutral-400">
              These terms govern your use of Hously.
            </p>
          </div>

          <div className="prose prose-neutral max-w-none dark:prose-invert">
            <h2>Using Hously</h2>
            <p>
              Hously helps you manage household tasks, shopping lists, recipes,
              meal plans, and reminders. By using the app, you agree to these
              terms and to follow all applicable laws.
            </p>

            <h2>Accounts</h2>
            <ul>
              <li>You are responsible for the activity on your account.</li>
              <li>Provide accurate information and keep your credentials secure.</li>
              <li>Do not share or reuse passwords across services.</li>
            </ul>

            <h2>Your Content</h2>
            <p>
              You own the content you add to Hously. You grant Hously permission
              to store, process, and display that content solely to operate the
              service for you and your household.
            </p>

            <h2>Acceptable Use</h2>
            <ul>
              <li>Do not attempt to access other users' data.</li>
              <li>Do not disrupt or abuse the service.</li>
              <li>Do not upload content that is illegal or violates others' rights.</li>
            </ul>

            <h2>Notifications</h2>
            <p>
              If you enable notifications, Hously will send reminders and updates
              through your browser or mobile device. You can disable notifications
              at any time in your device settings.
            </p>

            <h2>Availability</h2>
            <p>
              We aim to keep Hously available, but the service may be interrupted
              for maintenance or unexpected issues.
            </p>

            <h2>Termination</h2>
            <p>
              You can stop using Hously at any time. The administrator of your
              deployment may suspend or remove access if these terms are violated.
            </p>

            <h2>Changes</h2>
            <p>
              We may update these terms. If we do, we will update the date above
              and post the new version on this page.
            </p>

            <h2>Privacy</h2>
            <p>
              Please review our <Link to="/privacy">Privacy Policy</Link> for
              details on how we collect and use data.
            </p>
          </div>

          <div className="text-sm text-neutral-500 dark:text-neutral-400">
            Questions about these terms? Contact the administrator of your Hously
            deployment.
          </div>
        </div>
      </div>
    </div>
  );
}
