import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { FormInput } from '../../components/ui/form-field';
import { Button } from '../../components/ui/button';
import {
  useCreateUser,
  useAdminUsers,
  useDeleteUser,
  useCurrentUser,
  type CreateUserRequest,
} from '@hously/shared';
import { LoadingState } from '../../components/LoadingState';
import { formatDateTime } from '@hously/shared';

interface FormData {
  email: string;
  first_name: string;
  last_name: string;
  is_admin: boolean;
  locale: string;
}

export function UsersTab() {
  const { t, i18n } = useTranslation('common');
  const createMutation = useCreateUser();
  const deleteMutation = useDeleteUser();
  const { data: currentUser } = useCurrentUser();
  const { data: usersData, isLoading, error } = useAdminUsers();
  const [createdUser, setCreatedUser] = useState<{
    user: CreateUserRequest;
    password: string;
  } | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      email: '',
      first_name: '',
      last_name: '',
      is_admin: false,
      locale: 'en',
    },
  });

  const onSubmit = async (data: FormData) => {
    try {
      const result = await createMutation.mutateAsync({
        email: data.email.trim(),
        first_name: data.first_name.trim() || null,
        last_name: data.last_name.trim() || null,
        is_admin: data.is_admin,
        locale: data.locale,
      });

      if (result.success) {
        setCreatedUser({
          user: {
            email: result.user.email,
            first_name: result.user.first_name,
            last_name: result.user.last_name,
            is_admin: result.user.is_admin,
            locale: result.user.locale,
          },
          password: result.password,
        });
        reset();
        toast.success(t('settings.users.createSuccess'));
      }
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast.error(error?.error || t('settings.users.createError') || 'Failed to create user');
    }
  };

  const handleClosePasswordDisplay = () => {
    setCreatedUser(null);
  };

  const handleDeleteUser = async (userId: number, userEmail: string) => {
    if (!confirm(t('settings.users.deleteConfirm', { email: userEmail }))) {
      return;
    }

    try {
      await deleteMutation.mutateAsync(userId);
      toast.success(t('settings.users.deleteSuccess'));
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast.error(error?.error || t('settings.users.deleteError') || 'Failed to delete user');
    }
  };

  const formatDisplayName = (user: { first_name: string | null; last_name: string | null; email: string }) => {
    if (user.first_name || user.last_name) {
      return [user.first_name, user.last_name].filter(Boolean).join(' ');
    }
    return user.email;
  };

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-300" key="users-tab">
      <div className="space-y-6">
        {/* Users List */}
        <div className="bg-white dark:bg-neutral-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-2 text-neutral-900 dark:text-neutral-100">
            {t('settings.users.listTitle')}
          </h2>
          <p className="text-neutral-600 dark:text-neutral-400 mb-6">{t('settings.users.listDescription')}</p>

          {isLoading ? (
            <LoadingState />
          ) : error ? (
            <div className="text-red-600 dark:text-red-400">
              {t('settings.users.loadError') || 'Failed to load users'}
            </div>
          ) : usersData?.users && usersData.users.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-700">
                    <th className="text-left py-3 px-4 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      {t('settings.users.email')}
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      {t('settings.users.name')}
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      {t('settings.users.role')}
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      {t('settings.users.createdAt')}
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      {t('settings.users.lastLogin')}
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      {t('settings.users.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {usersData.users.map(user => {
                    const isCurrentUser = currentUser?.id === user.id;
                    return (
                      <tr
                        key={user.id}
                        className="border-b border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors"
                      >
                        <td className="py-3 px-4 text-sm text-neutral-900 dark:text-neutral-100">{user.email}</td>
                        <td className="py-3 px-4 text-sm text-neutral-900 dark:text-neutral-100">
                          {formatDisplayName(user)}
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {user.is_admin ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                              {t('settings.users.admin')}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-neutral-100 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-200">
                              {t('settings.users.user')}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm text-neutral-600 dark:text-neutral-400">
                          {user.created_at ? formatDateTime(user.created_at, i18n.language) : '-'}
                        </td>
                        <td className="py-3 px-4 text-sm text-neutral-600 dark:text-neutral-400">
                          {user.last_login ? formatDateTime(user.last_login, i18n.language) : '-'}
                        </td>
                        <td className="py-3 px-4 text-sm text-right">
                          {isCurrentUser ? (
                            <span className="text-neutral-400 dark:text-neutral-500 text-xs">
                              {t('settings.users.currentUser')}
                            </span>
                          ) : (
                            <button
                              onClick={() => handleDeleteUser(user.id, user.email)}
                              disabled={deleteMutation.isPending}
                              className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              {deleteMutation.isPending
                                ? t('settings.users.deleting') || 'Deleting...'
                                : t('settings.users.delete') || 'Delete'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-neutral-500 dark:text-neutral-400">
              {t('settings.users.noUsers') || 'No users found'}
            </div>
          )}
        </div>

        {/* Create User Form */}
        <div className="bg-white dark:bg-neutral-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-2 text-neutral-900 dark:text-neutral-100">
            {t('settings.users.createTitle')}
          </h2>
          <p className="text-neutral-600 dark:text-neutral-400 mb-6">{t('settings.users.description')}</p>

          {/* Password Display Modal */}
          {createdUser && (
            <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-lg font-semibold text-yellow-900 dark:text-yellow-100">
                  {t('settings.users.userCreated')}
                </h3>
                <button
                  onClick={handleClosePasswordDisplay}
                  className="text-yellow-600 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-200"
                >
                  ×
                </button>
              </div>
              <div className="space-y-2 text-sm">
                <p className="text-neutral-700 dark:text-neutral-300">
                  <strong>{t('settings.users.email')}:</strong> {createdUser.user.email}
                </p>
                {createdUser.user.first_name && (
                  <p className="text-neutral-700 dark:text-neutral-300">
                    <strong>{t('settings.users.firstName')}:</strong> {createdUser.user.first_name}
                  </p>
                )}
                {createdUser.user.last_name && (
                  <p className="text-neutral-700 dark:text-neutral-300">
                    <strong>{t('settings.users.lastName')}:</strong> {createdUser.user.last_name}
                  </p>
                )}
                <div className="mt-4 p-3 bg-white dark:bg-neutral-800 border border-yellow-300 dark:border-yellow-700 rounded">
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-1">
                    {t('settings.users.generatedPassword')}
                  </p>
                  <p className="text-lg font-mono font-bold text-neutral-900 dark:text-neutral-100 break-all">
                    {createdUser.password}
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-400 mt-2">{t('settings.users.passwordWarning')}</p>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <FormInput
              {...register('email', {
                required: true,
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: t('settings.users.invalidEmail') || 'Invalid email',
                },
              })}
              type="email"
              placeholder={t('settings.users.emailPlaceholder') || 'Email'}
              error={
                errors.email
                  ? errors.email.type === 'required'
                    ? t('settings.users.emailRequired') || 'Email is required'
                    : errors.email.message
                  : undefined
              }
            />

            <FormInput
              {...register('first_name')}
              placeholder={t('settings.users.firstNamePlaceholder') || 'First name (optional)'}
            />

            <FormInput
              {...register('last_name')}
              placeholder={t('settings.users.lastNamePlaceholder') || 'Last name (optional)'}
            />

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                {t('settings.users.locale')}
              </label>
              <select
                {...register('locale')}
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md text-neutral-900 dark:text-white bg-white dark:bg-neutral-700 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="en">English</option>
                <option value="fr">Français</option>
              </select>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_admin"
                {...register('is_admin')}
                className="w-4 h-4 text-primary-600 bg-neutral-100 border-neutral-300 rounded focus:ring-primary-500 dark:focus:ring-primary-600 dark:ring-offset-neutral-800 focus:ring-2 dark:bg-neutral-700 dark:border-neutral-600"
              />
              <label htmlFor="is_admin" className="ml-2 text-sm text-neutral-700 dark:text-neutral-300">
                {t('settings.users.isAdmin')}
              </label>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending
                  ? t('settings.users.creating') || 'Creating...'
                  : t('settings.users.createButton') || 'Create User'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
