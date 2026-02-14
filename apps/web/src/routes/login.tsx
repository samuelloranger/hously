import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LoginForm } from '../features/auth/components/LoginForm';

export function Login() {
  const { t } = useTranslation('common');
  const [isSignup, setIsSignup] = useState(false);

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="mx-auto h-12 w-12 flex items-center justify-center">
            <img src="/icon-192.png" alt="Hously" className="h-12 w-12" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-neutral-900 dark:text-white">
            {t('login.welcome')}
          </h2>
          <p className="mt-2 text-center text-sm text-neutral-600 dark:text-neutral-400">
            {isSignup ? t('login.createAccount') : t('login.signIn')}
          </p>
        </div>
        <LoginForm isSignup={isSignup} onToggleMode={() => setIsSignup(!isSignup)} />
      </div>
    </div>
  );
}
