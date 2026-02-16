import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from '@tanstack/react-router';
import { toast } from 'sonner';
import { setUser } from '../../../lib/auth';
import { useLogin, useSignup } from '@hously/shared';

interface FormData {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

interface LoginFormProps {
  isSignup: boolean;
  onToggleMode: () => void;
}

/**
 * Validates password complexity requirements for signup
 * Requires: 12+ chars, uppercase, lowercase, number, and special character
 */
function validatePasswordComplexity(value: string, t: (key: string) => string): string | true {
  const hasUpperCase = /[A-Z]/.test(value);
  const hasLowerCase = /[a-z]/.test(value);
  const hasNumber = /[0-9]/.test(value);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(value);

  if (!hasUpperCase) {
    return t('login.passwordNeedsUppercase') || 'Password must contain at least one uppercase letter';
  }
  if (!hasLowerCase) {
    return t('login.passwordNeedsLowercase') || 'Password must contain at least one lowercase letter';
  }
  if (!hasNumber) {
    return t('login.passwordNeedsNumber') || 'Password must contain at least one number';
  }
  if (!hasSpecialChar) {
    return t('login.passwordNeedsSpecialChar') || 'Password must contain at least one special character';
  }
  return true;
}

export function LoginForm({ isSignup, onToggleMode }: LoginFormProps) {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const loginMutation = useLogin();
  const signupMutation = useSignup();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      email: '',
      password: '',
      firstName: '',
      lastName: '',
    },
  });

  const loading = loginMutation.isPending || signupMutation.isPending;

  const onSubmit = async (data: FormData) => {
    try {
      let response;
      if (isSignup) {
        response = await signupMutation.mutateAsync({
          email: data.email,
          password: data.password,
          first_name: data.firstName || undefined,
          last_name: data.lastName || undefined,
        });
      } else {
        response = await loginMutation.mutateAsync({
          email: data.email,
          password: data.password,
        });
      }

      // Update user in auth cache
      if (response.user) {
        setUser(response.user);
      }

      // Navigate to dashboard
      navigate({ to: '/' });
    } catch (err: any) {
      console.error('Auth error:', err);
      toast.error(
        err?.message || loginMutation.error?.message || signupMutation.error?.message || t('login.authFailed')
      );
    }
  };

  const handleToggle = () => {
    reset();
    onToggleMode();
  };

  return (
    <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
      <div className="rounded-md shadow-sm -space-y-px">
        <div>
          <label htmlFor="email" className="sr-only">
            {t('login.emailAddress')}
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            {...register('email', {
              required: true,
              pattern: {
                value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                message: t('login.invalidEmail') || 'Invalid email address',
              },
            })}
            className="appearance-none rounded-none relative block w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 placeholder-neutral-500 dark:placeholder-neutral-400 text-neutral-900 dark:text-white bg-white dark:bg-neutral-800 rounded-t-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm"
            placeholder={t('login.emailAddress')}
          />
          {errors.email && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
              {errors.email.message || t('login.emailRequired')}
            </p>
          )}
        </div>

        {isSignup && (
          <>
            <div>
              <label htmlFor="firstName" className="sr-only">
                {t('login.firstName')}
              </label>
              <input
                id="firstName"
                type="text"
                autoComplete="given-name"
                {...register('firstName')}
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 placeholder-neutral-500 dark:placeholder-neutral-400 text-neutral-900 dark:text-white bg-white dark:bg-neutral-800 focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm"
                placeholder={t('login.firstName')}
              />
            </div>
            <div>
              <label htmlFor="lastName" className="sr-only">
                {t('login.lastName')}
              </label>
              <input
                id="lastName"
                type="text"
                autoComplete="family-name"
                {...register('lastName')}
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 placeholder-neutral-500 dark:placeholder-neutral-400 text-neutral-900 dark:text-white bg-white dark:bg-neutral-800 focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm"
                placeholder={t('login.lastName')}
              />
            </div>
          </>
        )}

        <div>
          <label htmlFor="password" className="sr-only">
            {t('login.password')}
          </label>
          <input
            id="password"
            type="password"
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            {...register('password', {
              required: true,
              minLength: isSignup
                ? {
                    value: 8,
                    message: t('login.passwordMinLength') || 'Password must be at least 12 characters',
                  }
                : undefined,
              validate: isSignup ? value => validatePasswordComplexity(value, t) : undefined,
            })}
            className="appearance-none rounded-none relative block w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 placeholder-neutral-500 dark:placeholder-neutral-400 text-neutral-900 dark:text-white bg-white dark:bg-neutral-800 rounded-b-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm"
            placeholder={t('login.password')}
          />
          {errors.password && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
              {errors.password.message || t('login.passwordRequired')}
            </p>
          )}
        </div>
      </div>

      {!isSignup && (
        <div className="flex justify-end">
          <Link
            to="/forgot-password"
            className="text-sm text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300"
          >
            {t('login.forgotPassword')}
          </Link>
        </div>
      )}

      <div>
        <button
          type="submit"
          disabled={loading}
          className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:focus:ring-offset-neutral-900 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span>{t('login.loading')}</span>
          ) : (
            <>
              <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                <span className="text-primary-500 group-hover:text-primary-400">🚪</span>
              </span>
              {isSignup ? t('login.signUpButton') : t('login.signInButton')}
            </>
          )}
        </button>
      </div>

      <div className="text-center">
        <button
          type="button"
          onClick={handleToggle}
          className="text-sm text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300"
        >
          {isSignup ? t('login.alreadyHaveAccount') : t('login.dontHaveAccount')}
        </button>
      </div>
    </form>
  );
}
