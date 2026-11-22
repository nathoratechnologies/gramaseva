// Reads the "Gramaseva data" Excel template (see public/gramaseva-data-template.xlsx)
// and turns each sheet into Village / Provider / Contact records for the super admin's bulk import.
import type { Category, Contact, ContactKind, Provider, Village, Ward } from '../types';
import { SHOP_CATS, VEHICLE_CATS } from '../types';
import { ALL_JOBS, CAT_LABEL } from './util';

export type Cell = string | number | boolean | Date | null | undefined;
export interface SheetIn { sheet: string; data: Cell[][] }

export interface PanchayatIn { district: string; name: string; nameEn: string; phone: string; lat: number | null; lng: number | null }
export interface ProviderIn {
  kind: 'worker' | 'driver' | 'shop';
  row: number; name: string; phone: string; category: Category; jobTitle?: string; ward: string;
  rate: number; rateUnit: 'day' | 'job' | 'km'; experienceYears?: number; vehicleNo?: string;
  shopName?: string; address?: string; openHours?: string; about?: string;
}
export interface ContactIn { row: number; kind: ContactKind; name: string; phone: string; phone2?: string; ward: string; address?: string; note?: string }
export interface Issue { sheet: string; row: number; msg: string }
export interface Parsed {
  panchayat: PanchayatIn | null;
  wards: Ward[];
  providers: ProviderIn[];
  contacts: ContactIn[];
  errors: Issue[];
  warnings: Issue[];
}

const str = (c: Cell): string => (c == null ? '' : c instanceof Date ? c.toISOString().slice(0, 10) : String(c)).replace(/\s+/g, ' ').trim();
const low = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
const num = (c: Cell): number | null => { const n = Number(str(c).replace(/[^\d.-]/g, '')); return str(c) && Number.isFinite(n) ? n : null; };

/** "98765 43210", "+91-98765-43210", "0477 227 5204" → "+919876543210" / "0477 227 5204". Empty when unusable. */
export function cleanPhone(c: Cell): string {
  const raw = str(c);
  const d = raw.replace(/\D/g, '');
  if (/^[6-9]\d{9}$/.test(d)) return '+91' + d;
  if (/^91[6-9]\d{9}$/.test(d)) return '+' + d;
  if (/^0[6-9]\d{9}$/.test(d)) return '+91' + d.slice(1);
  if (d.length >= 6 && d.length <= 13) return raw.replace(/[^\d+ -]/g, '').trim(); // landline, keep as typed
  return '';
}

/** Matches "പ്ലംബിംഗ് (Plumbing)", "Plumbing", "പ്ലംബിംഗ്" etc. against [ml, en] labels. */
function matcher<T>(entries: [T, [string, string]][]) {
  const map = new Map<string, T>();
  for (const [k, [ml, en]] of entries) {
    for (const s of [ml, en, `${ml} (${en})`, `${en} (${ml})`, `${ml} / ${en}`]) map.set(low(s), k);
  }
  return (s: string): T | undefined => {
    const t = low(s);
    if (map.has(t)) return map.get(t);
    const m = t.match(/^(.*?)\s*\((.*)\)\s*$/); // "x (y)"
    if (m) return map.get(low(m[1])) ?? map.get(low(m[2]));
    return undefined;
  };
}

const WORK_MAIN: Category[] = ['plumbing', 'electrical', 'welding', 'coconut', 'farming'];
const matchWorkCat = matcher(WORK_MAIN.map((c) => [c, CAT_LABEL[c]] as [Category, [string, string]]));
const matchJob = matcher(ALL_JOBS.map((j) => [j[0], j] as [string, [string, string]]));
const matchVehicle = matcher(VEHICLE_CATS.map((c) => [c, CAT_LABEL[c]] as [Category, [string, string]]));
const matchShop = matcher(SHOP_CATS.map((c) => [c, CAT_LABEL[c]] as [Category, [string, string]]));

// Labels used in the template's drop-downs (kept here so the template generator and the parser agree).
export const WORK_OPTIONS = [...WORK_MAIN.map((c) => CAT_LABEL[c]), ...ALL_JOBS].map(([ml, en]) => `${ml} (${en})`);
export const VEHICLE_OPTIONS = VEHICLE_CATS.map((c) => CAT_LABEL[c]).map(([ml, en]) => `${ml} (${en})`);
export const SHOP_OPTIONS = SHOP_CATS.map((c) => CAT_LABEL[c]).map(([ml, en]) => `${ml} (${en})`);

/** Which template sheet is this? Sheet names start with a number and carry an English word. */
function sheetKind(name: string) {
  const n = low(name);
  if (n.includes('panchayat')) return 'panchayat';
  if (n.includes('ward')) return 'wards';
  if (n.includes('worker')) return 'workers';
  if (n.includes('driver') || n.includes('vehicle')) return 'drivers';
  if (n.includes('shop')) return 'shops';
  if (n.includes('school') || n.includes('college')) return 'schools';
  if (n.includes('hospital')) return 'hospitals';
  if (n.includes('office')) return 'offices';
  if (n.includes('asha')) return 'asha';
  return null;
}

/** Data rows (Excel row number, cells) after the header; skips empty rows and "ഉദാ:" example rows. */
function rows(s: SheetIn): [number, Cell[]][] {
  const out: [number, Cell[]][] = [];
  s.data.forEach((r, i) => {
    if (i === 0) return;
    const cells = r ?? [];
    if (!cells.some((c) => str(c))) return;
    const first = str(cells.find((c) => str(c)));
    if (/^(ഉദാ|e\.?g\.?)/i.test(first)) return;
    out.push([i + 1, cells]);
  });
  return out;
}

export function parseWorkbook(sheets: SheetIn[]): Parsed {
  const res: Parsed = { panchayat: null, wards: [], providers: [], contacts: [], errors: [], warnings: [] };
  const err = (sheet: string, row: number, msg: string) => res.errors.push({ sheet, row, msg });
  const warn = (sheet: string, row: number, msg: string) => res.warnings.push({ sheet, row, msg });
  const by = (k: string) => sheets.find((s) => sheetKind(s.sheet) === k);

  // ---- Panchayat details: label in column A, value in column B ----
  const ps = by('panchayat');
  if (ps) {
    const get = (key: string) => { const r = ps.data.find((x) => low(str(x?.[0])).includes(key)); return r ? r[1] : null; };
    const p: PanchayatIn = {
      district: str(get('district')), name: str(get('malayalam')), nameEn: str(get('english')),
      phone: str(get('phone')), lat: num(get('latitude')), lng: num(get('longitude')),
    };
    if (p.district || p.name || p.nameEn) res.panchayat = p;
  }

  // ---- Wards ----
  const ws = by('wards');
  if (ws) {
    for (const [row, c] of rows(ws)) {
      const name = str(c[1]); const nameEn = str(c[2]);
      if (!name && !nameEn) { err(ws.sheet, row, 'വാർഡിന്റെ പേര് ഇല്ല'); continue; }
      const no = num(c[0]) ?? res.wards.length + 1;
      if (res.wards.some((w) => w.no === no)) { err(ws.sheet, row, `വാർഡ് നമ്പർ ${no} രണ്ടു തവണ`); continue; }
      res.wards.push({ no, name: name || nameEn, nameEn: nameEn || name, member: str(c[3]), role: str(c[4]) || 'Member' });
    }
  }

  const need = (sheet: string, row: number, name: string, phone: string) => {
    if (!name) { err(sheet, row, 'പേര് ഇല്ല'); return false; }
    if (!phone) { err(sheet, row, 'ഫോൺ നമ്പർ ഇല്ല / തെറ്റാണ്'); return false; }
    return true;
  };

  // ---- Workers: Name | Mobile | Work | Ward | Rate | Per | Experience | About ----
  const wk = by('workers');
  if (wk) for (const [row, c] of rows(wk)) {
    const name = str(c[0]); const phone = cleanPhone(c[1]); const work = str(c[2]);
    if (!need(wk.sheet, row, name, phone)) continue;
    if (!work) { err(wk.sheet, row, 'പണി (ജോലി) ഇല്ല'); continue; }
    const cat = matchWorkCat(work);
    const job = cat ? undefined : matchJob(work) ?? work.replace(/\s*\(.*\)\s*$/, '');
    const per = low(str(c[5]));
    res.providers.push({
      kind: 'worker', row, name, phone, category: cat ?? 'other', ...(job ? { jobTitle: job } : {}), ward: str(c[3]),
      rate: num(c[4]) ?? 0, rateUnit: per.includes('പണി') || per.includes('job') || per.includes('tree') || per.includes('തെങ്ങ') ? 'job' : 'day',
      ...(num(c[6]) != null ? { experienceYears: num(c[6])! } : {}), ...(str(c[7]) ? { about: str(c[7]) } : {}),
    });
  }

  // ---- Drivers: Name | Mobile | Vehicle type | Vehicle no | Ward | Rate per km | About ----
  const dr = by('drivers');
  if (dr) for (const [row, c] of rows(dr)) {
    const name = str(c[0]); const phone = cleanPhone(c[1]);
    if (!need(dr.sheet, row, name, phone)) continue;
    const cat = matchVehicle(str(c[2]));
    if (!cat) { err(dr.sheet, row, `വാഹനത്തിന്റെ തരം മനസ്സിലായില്ല: "${str(c[2])}" (drop-down-ൽ നിന്ന് എടുക്കുക)`); continue; }
    res.providers.push({
      kind: 'driver', row, name, phone, category: cat, ward: str(c[4]), rate: num(c[5]) ?? 0, rateUnit: 'km',
      ...(str(c[3]) ? { vehicleNo: str(c[3]).toUpperCase() } : {}), ...(str(c[6]) ? { about: str(c[6]) } : {}),
    });
  }

  // ---- Shops: Shop name | Owner | Phone | Shop type | Ward | Address | Hours | About ----
  const sh = by('shops');
  if (sh) for (const [row, c] of rows(sh)) {
    const shopName = str(c[0]); const owner = str(c[1]); const phone = cleanPhone(c[2]); const type = str(c[3]);
    if (!need(sh.sheet, row, shopName, phone)) continue;
    const cat = matchShop(type);
    res.providers.push({
      kind: 'shop', row, name: owner || shopName, shopName, phone, category: cat ?? 'shopother',
      ...(!cat && type ? { jobTitle: type.replace(/\s*\(.*\)\s*$/, '') } : {}), ward: str(c[4]), rate: 0, rateUnit: 'job',
      ...(str(c[5]) ? { address: str(c[5]) } : {}), ...(str(c[6]) ? { openHours: str(c[6]) } : {}), ...(str(c[7]) ? { about: str(c[7]) } : {}),
    });
  }

  // ---- Directory sheets ----
  const dir = (k: string, kind: ContactKind, cols: { phone2?: number; ward: number; address?: number; note?: number; type?: number }) => {
    const s = by(k);
    if (!s) return;
    for (const [row, c] of rows(s)) {
      const name = str(c[0]); const phone = cleanPhone(c[cols.type != null ? 2 : 1]);
      if (!need(s.sheet, row, name, phone)) continue;
      const type = cols.type != null ? str(c[cols.type]) : '';
      const note = [type, cols.note != null ? str(c[cols.note]) : ''].filter(Boolean).join(' · ');
      const phone2 = cols.phone2 != null ? cleanPhone(c[cols.phone2]) : '';
      res.contacts.push({
        row, kind, name: name.slice(0, 120), phone, ward: str(c[cols.ward]),
        ...(phone2 ? { phone2 } : {}), ...(cols.address != null && str(c[cols.address]) ? { address: str(c[cols.address]) } : {}), ...(note ? { note } : {}),
      });
    }
  };
  dir('schools', 'school', { type: 1, phone2: 3, ward: 4, address: 5, note: 6 }); // Name | Type | Phone | Phone 2 | Ward | Address | Note
  dir('hospitals', 'hospital', { phone2: 2, ward: 3, address: 4, note: 5 }); // Name | Phone | Phone 2 | Ward | Address | Note
  dir('offices', 'office', { phone2: 2, ward: 3, address: 4, note: 5 });
  dir('asha', 'asha', { ward: 2, note: 3 }); // Name | Phone | Ward | Note

  // Same person + same work twice in the file → keep the last one.
  const seen = new Map<string, ProviderIn>();
  for (const p of res.providers) {
    const k = provKey(p);
    if (seen.has(k)) warn('', p.row, `${p.name}: ഒരേ ഫോൺ + ഒരേ പണി രണ്ടു തവണ, അവസാനത്തേത് മാത്രം എടുക്കും`);
    seen.set(k, p);
  }
  res.providers = [...seen.values()];
  return res;
}

const slug = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9ഀ-ൿ]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
const provKey = (p: Pick<ProviderIn, 'phone' | 'category' | 'jobTitle' | 'shopName'>) =>
  [p.phone.replace(/\D/g, ''), p.category, p.jobTitle ?? '', p.shopName ?? ''].map(slug).join('_');
/** Stable ids, so importing the same sheet again updates records instead of duplicating them. */
export const providerId = (villageId: string, p: ProviderIn) => `imp_${villageId}_${provKey(p)}`.slice(0, 140);
export const contactId = (villageId: string, c: ContactIn) => `imp_${villageId}_${c.kind}_${slug(c.name)}`.slice(0, 140);

/** Ward cell ("കരുമാടി", "Karumady", "7", "Ward 7") → stored ward id (the ward's number as text). */
export function wardId(cell: string, wards: Ward[] | undefined): { id: string; ok: boolean } {
  const t = low(cell);
  if (!t) return { id: '', ok: true };
  const list = wards ?? [];
  const byName = list.find((w) => low(w.name) === t || low(w.nameEn) === t || `${low(w.name)} (${low(w.nameEn)})` === t);
  if (byName) return { id: String(byName.no), ok: true };
  const n = t.match(/\d+/)?.[0];
  if (n && (!list.length || list.some((w) => String(w.no) === n))) return { id: n, ok: true };
  return { id: '', ok: !list.length };
}

/** The village record for the file's Panchayat sheet, or the matching existing one. */
export function findVillage(p: PanchayatIn | null, villages: Village[]): Village | null {
  if (!p) return null;
  const en = low(p.nameEn); const ml = low(p.name);
  return villages.find((v) => (en && (low(v.nameEn) === en || low(v.id).endsWith(en.replace(/\s+/g, '-'))))
    || (ml && (low(v.name) === ml || low(v.panchayat).replace(/\s*ഗ്രാമ\s*പഞ്ചായത്ത്$/, '') === ml))) ?? null;
}

export function newVillage(p: PanchayatIn, wards: Ward[]): Village {
  const base = slug(p.nameEn || p.name) || 'panchayat';
  return {
    id: `${base}-${Date.now().toString(36)}`, name: p.name || p.nameEn, nameEn: p.nameEn || p.name,
    panchayat: /പഞ്ചായത്ത്/.test(p.name) ? p.name : `${p.name || p.nameEn} ഗ്രാമപഞ്ചായത്ത്`,
    district: p.district, status: 'live', lat: p.lat ?? 0, lng: p.lng ?? 0,
    ...(p.phone ? { panchayatPhone: p.phone } : {}), ...(wards.length ? { wards } : {}),
  };
}

/** Builds the records to write for one village. Existing imported providers keep their status (a blocked one stays blocked) and ratings. */
export function buildRecords(parsed: Parsed, village: Village, existing: Provider[], adminUid: string) {
  const wards = parsed.wards.length ? parsed.wards : village.wards;
  const warnings: Issue[] = [];
  const now = Date.now();
  const old = new Map(existing.map((p) => [p.uid, p]));
  const providers: Provider[] = parsed.providers.map((p) => {
    const w = wardId(p.ward, wards);
    if (!w.ok) warnings.push({ sheet: p.kind, row: p.row, msg: `${p.name}: വാർഡ് "${p.ward}" കണ്ടില്ല, വാർഡ് ഇല്ലാതെ ചേർക്കും` });
    const uid = providerId(village.id, p);
    const prev = old.get(uid);
    const { kind: _k, row: _r, ward: _w, ...rest } = p; void _k; void _r; void _w;
    return {
      ...rest, uid, villageId: village.id, ...(w.id ? { ward: w.id } : {}), radiusKm: p.kind === 'driver' ? 25 : 10,
      lat: village.lat, lng: village.lng, availableUntil: 0, imported: true,
      status: prev?.status ?? 'approved', verified: prev?.verified ?? true,
      ratingSum: prev?.ratingSum ?? 0, ratingCount: prev?.ratingCount ?? 0, ...(prev?.lastReviewId ? { lastReviewId: prev.lastReviewId } : {}),
      createdAt: prev?.createdAt ?? now,
    };
  });
  const contacts: Contact[] = parsed.contacts.map((c) => {
    const w = wardId(c.ward, wards);
    if (!w.ok) warnings.push({ sheet: c.kind, row: c.row, msg: `${c.name}: വാർഡ് "${c.ward}" കണ്ടില്ല` });
    const { row: _r, ward: _w, ...rest } = c; void _r; void _w;
    return { ...rest, id: contactId(village.id, c), villageId: village.id, ...(w.id ? { ward: w.id } : {}), status: 'approved', createdBy: adminUid, createdAt: now };
  });
  return { providers, contacts, warnings };
}
