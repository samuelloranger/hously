import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from '@tanstack/react-router';
import { toast } from 'sonner';
import { setUser } from '@/lib/auth';
import { useLogin } from '@/hooks/useAuth';

interface FormData {
  email: string;
  password: string;
}

export function LoginForm() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const loginMutation = useLogin();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: FormData) => {
    try {
      const response = await loginMutation.mutateAsync({
        email: data.email,
        password: data.password,
      });

      if (response.user) {
        setUser(response.user);
      }

      navigate({ to: '/' });
    } catch (err: any) {
      toast.error(err?.message || loginMutation.error?.message || t('login.authFailed'));
    }
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

        <div>
          <label htmlFor="password" className="sr-only">
            {t('login.password')}
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            {...register('password', { required: true })}
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

      <div className="flex justify-end">
        <Link
          to="/forgot-password"
          className="text-sm text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300"
        >
          {t('login.forgotPassword')}
        </Link>
      </div>

      <div>
        <button
          type="submit"
          disabled={loginMutation.isPending}
          className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:focus:ring-offset-neutral-900 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loginMutation.isPending ? t('login.loading') : t('login.signInButton')}
        </button>
      </div>
    </form>
  );
}
