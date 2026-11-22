import type { Village } from '../types';

// The app is organised by panchayat (grama panchayat / municipality / corporation).
// Several village records can belong to one panchayat (or be accidental duplicates):
// they are grouped by district + panchayat name.

const norm = (s: string) => s.toLowerCase()
  .replace(/ഗ്രാമ\s*പഞ്ചായത്ത്|ഗ്രാമപഞ്ചായത്ത്|പഞ്ചായത്ത്|പഞ്ചായത്|grama\s*panchayath?|panchayath?|gram\s*panchayat|ജില്ല|district/g, '')
  .replace(/[\s.\-_,()]+/g, '');

export const panchayatKey = (v: Pick<Village, 'district' | 'panchayat'>) => norm(v.district) + '|' + norm(v.panchayat);

export interface Panchayat {
  key: string;
  main: Village; // the record used for name, wards, phone and location
  ids: string[]; // every village record in this panchayat
  district: string;
}

export function groupPanchayats(villages: Village[]): Panchayat[] {
  const map = new Map<string, Panchayat>();
  for (const v of villages) {
    const k = panchayatKey(v);
    const g = map.get(k);
    if (!g) map.set(k, { key: k, main: v, ids: [v.id], district: v.district });
    else {
      g.ids.push(v.id);
      // Prefer a record that has wards, then a live one.
      if ((!g.main.wards?.length && v.wards?.length) || (g.main.status !== 'live' && v.status === 'live')) g.main = v;
    }
  }
  return [...map.values()];
}

/** "തകഴി ഗ്രാമപഞ്ചായത്ത്" style label. */
export function panchayatName(v: Village, lang: 'ml' | 'en') {
  if (lang === 'ml') return v.panchayat || v.name;
  const p = v.panchayat && /[a-z]/i.test(v.panchayat) ? v.panchayat : `${v.nameEn} Panchayat`;
  return p;
}

import type { Api } from '../data/api';
import type { News } from '../types';

/** News of every village record in a panchayat, newest first. */
export async function listPanchayatNews(api: Api, ids: string[], opts?: { includePending?: boolean }): Promise<News[]> {
  const all = await Promise.all(ids.map((id) => api.listNews(id, opts)));
  return all.flat().sort((a, b) => b.createdAt - a.createdAt);
}

/** Ward filter: panchayat-wide news is shown in every ward. */
export const inWard = (n: News, ward: string) => !ward || !n.ward || n.ward === ward;

import type { Village as V2, Ward } from '../types';

/** Ward name for a stored ward id (falls back to the raw value for panchayats without a ward list). */
export function wardLabel(v: V2 | null | undefined, ward: string | undefined, lang: 'ml' | 'en'): string {
  if (!ward) return '';
  const w = v?.wards?.find((x) => String(x.no) === ward);
  if (w) return lang === 'ml' ? w.name : w.nameEn;
  return lang === 'ml' ? `വാർഡ് ${ward}` : `Ward ${ward}`;
}

/** Wards sorted by name, for pick lists. */
export const sortedWards = (v: V2 | null | undefined, lang: 'ml' | 'en'): Ward[] =>
  [...(v?.wards ?? [])].sort((a, b) => (lang === 'ml' ? a.name.localeCompare(b.name, 'ml') : a.nameEn.localeCompare(b.nameEn)));

export function roleLabel(role: string, lang: 'ml' | 'en'): string {
  if (lang === 'en' || role === 'Member') return role;
  return ({ President: 'പ്രസിഡന്റ്', 'Vice President': 'വൈസ് പ്രസിഡന്റ്', 'Standing Committee Chairman': 'സ്റ്റാൻഡിംഗ് കമ്മിറ്റി ചെയർപേഴ്സൺ' } as Record<string, string>)[role] ?? role;
}
