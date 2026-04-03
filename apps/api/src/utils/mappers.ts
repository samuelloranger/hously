export type UserLookup = { firstName: string | null; email: string };

export function buildUserMap(
  users: Array<{ id: number; firstName: string | null; email: string }>,
): Map<number, UserLookup> {
  const map = new Map<number, UserLookup>();
  for (const u of users) {
    map.set(u.id, { firstName: u.firstName, email: u.email });
  }
  return map;
}

export function getUserDisplayName(
  userId: number | null | undefined,
  map: Map<number, UserLookup>,
): string | null {
  if (!userId) return null;
  const user = map.get(userId);
  return user?.firstName || user?.email || null;
}

export const mapUser = (user: {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isAdmin: boolean | null;
  locale: string | null;
  lastLogin: Date | null;
  createdAt: Date | null;
  lastActivity: Date | null;
  avatarUrl: string | null;
}) => ({
  id: user.id,
  email: user.email,
  first_name: user.firstName,
  last_name: user.lastName,
  is_admin: user.isAdmin || false,
  locale: user.locale ?? null,
  last_login: user.lastLogin?.toISOString() ?? null,
  created_at: user.createdAt?.toISOString() ?? new Date().toISOString(),
  last_activity: user.lastActivity?.toISOString() ?? null,
  avatar_url: user.avatarUrl || null,
});
