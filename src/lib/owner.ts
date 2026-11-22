import type { UserProfile } from '../types';
import type { AuthUser } from '../data/api';

/** Business (owner) logins: see payments, ads, sellers and items. Keep in step with isOwner() in firestore.rules. */
export const OWNER_EMAILS = ['upasnath@gramaseva.app'];
/** Short usernames typed on the login screen become <name>@gramaseva.app. */
export const USERNAME_DOMAIN = 'gramaseva.app';
export const loginEmail = (s: string) => { const t = s.trim().toLowerCase(); return t.includes('@') ? t : `${t}@${USERNAME_DOMAIN}`; };

export const isOwner = (profile: UserProfile | null, authUser: AuthUser | null) =>
  profile?.role === 'superadmin' || (!!authUser?.email && OWNER_EMAILS.includes(authUser.email.toLowerCase()));
