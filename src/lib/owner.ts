import type { UserProfile } from '../types';
import type { AuthUser } from '../data/api';

/** Business (owner) logins: see payments, ads, sellers and items. Keep in step with isOwner() in firestore.rules. */
export const OWNER_EMAILS = ['upasnath@gramaseva.app'];
/** Short usernames typed on the login screen become <name>@gramaseva.app. */
export const USERNAME_DOMAIN = 'gramaseva.app';
/**
 * Mobile number + PIN login: the number becomes a hidden login email, the PIN is its password.
 * Keep the domain in step with tokenPhone() in firestore.rules.
 */
export const MOBILE_DOMAIN = 'mobile.gramaseva.app';
export const mobileEmail = (tenDigits: string) => `91${tenDigits}@${MOBILE_DOMAIN}`;
/** '+91…' for a mobile + PIN login email, else ''. */
export const phoneFromMobileEmail = (email: string) => {
  const m = /^91([6-9]\d{9})@mobile\.gramaseva\.app$/.exec(email.trim().toLowerCase());
  return m ? '+91' + m[1] : '';
};
export const loginEmail = (s: string) => { const t = s.trim().toLowerCase(); return t.includes('@') ? t : `${t}@${USERNAME_DOMAIN}`; };

export const isOwner = (profile: UserProfile | null, authUser: AuthUser | null) =>
  profile?.role === 'superadmin' || (!!authUser?.email && OWNER_EMAILS.includes(authUser.email.toLowerCase()));
