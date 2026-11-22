import type { Category, Lang, NewsCat, Provider } from '../types';

export const isFree = (p: Pick<Provider, 'availableUntil'>, now = Date.now()) => p.availableUntil > now;
export const rating = (p: Pick<Provider, 'ratingSum' | 'ratingCount'>) =>
  p.ratingCount ? Math.round((p.ratingSum / p.ratingCount) * 10) / 10 : 0;

/** Distance in km between two points (haversine). */
export function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(s)) * 10) / 10;
}

export function timeAgo(ts: number, lang: Lang, now = Date.now()) {
  const m = Math.max(1, Math.round((now - ts) / 60000));
  if (m < 60) return lang === 'ml' ? `${m} മിനിറ്റ് മുമ്പ്` : `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return lang === 'ml' ? `${h} മണിക്കൂർ മുമ്പ്` : `${h} h ago`;
  const d = Math.round(h / 24);
  if (d === 1) return lang === 'ml' ? 'ഇന്നലെ' : 'Yesterday';
  return lang === 'ml' ? `${d} ദിവസം മുമ്പ്` : `${d} days ago`;
}

export const todayISO = (offsetDays = 0) => {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function prettyDate(iso: string, lang: Lang) {
  if (iso === todayISO()) return lang === 'ml' ? 'ഇന്ന്' : 'Today';
  if (iso === todayISO(1)) return lang === 'ml' ? 'നാളെ' : 'Tomorrow';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(lang === 'ml' ? 'ml-IN' : 'en-IN', { day: 'numeric', month: 'short' });
}

export const SLOTS: Record<string, [string, string]> = {
  now: ['ഇപ്പോൾ', 'Now'],
  morning: ['രാവിലെ', 'Morning'],
  noon: ['ഉച്ചയ്ക്ക്', 'Afternoon'],
  evening: ['വൈകുന്നേരം', 'Evening'],
};

export const CAT_LABEL: Record<Category, [string, string]> = {
  plumbing: ['പ്ലംബിംഗ്', 'Plumbing'],
  electrical: ['വയറിംഗ്', 'Wiring'],
  welding: ['വെൽഡിങ്', 'Welding'],
  coconut: ['തെങ്ങുകയറ്റം', 'Coconut climbing'],
  farming: ['കൃഷിപ്പണി', 'Farm work'],
  other: ['മറ്റുള്ളവ', 'Others'],
  auto: ['ഓട്ടോ', 'Auto'],
  car4: ['കാർ (4 സീറ്റ്)', 'Car (4 seats)'],
  car7: ['കാർ (7 സീറ്റ്)', 'Car (7 seats)'],
  goods: ['ഗുഡ്സ് ഓട്ടോ / ലോറി', 'Goods auto / lorry'],
  traveller: ['ട്രാവലർ', 'Traveller'],
  tourbus: ['ടൂറിസ്റ്റ് ബസ്', 'Tourist bus'],
  houseboat: ['ഹൗസ് ബോട്ട്', 'House boat'],
  bakery: ['ബേക്കറി', 'Bakery'],
  restaurant: ['റസ്റ്റോറന്റ് / ഹോട്ടൽ', 'Restaurant / hotel'],
  furniture: ['ഫർണിച്ചർ', 'Furniture'],
  supermarket: ['സൂപ്പർ മാർക്കറ്റ് / പലചരക്ക്', 'Supermarket / grocery'],
  dress: ['തുണിക്കട (ഡ്രസ്സ്)', 'Dress shop'],
  footwear: ['ചെരുപ്പ് കട', 'Footwear'],
  ladies: ['ലേഡീസ് സ്റ്റോർ', 'Ladies store'],
  medical: ['മെഡിക്കൽ സ്റ്റോർ', 'Medical store'],
  hardware: ['ഹാർഡ്‌വെയർ / പെയിന്റ്', 'Hardware / paint'],
  stationery: ['സ്റ്റേഷനറി / പുസ്തകം', 'Stationery / books'],
  mobile: ['മൊബൈൽ / ഇലക്ട്രോണിക്സ്', 'Mobile / electronics'],
  jewellery: ['ജ്വല്ലറി', 'Jewellery'],
  shopother: ['മറ്റ് കടകൾ', 'Other shops'],
};

export const CAT_WORKER: Record<Category, [string, string]> = {
  plumbing: ['പ്ലംബർമാർ', 'Plumbers'],
  electrical: ['ഇലക്ട്രീഷ്യൻമാർ', 'Electricians'],
  welding: ['വെൽഡർമാർ', 'Welders'],
  coconut: ['തെങ്ങുകയറ്റക്കാർ', 'Coconut climbers'],
  farming: ['കൃഷിപ്പണിക്കാർ', 'Farm workers'],
  other: ['മറ്റ് പണിക്കാർ', 'Other workers'],
  auto: ['ഓട്ടോ ഡ്രൈവർമാർ', 'Auto drivers'],
  car4: ['കാർ ഡ്രൈവർമാർ', 'Car drivers'],
  car7: ['കാർ ഡ്രൈവർമാർ', 'Car drivers'],
  goods: ['ഗുഡ്സ് വാഹനങ്ങൾ', 'Goods vehicles'],
  traveller: ['ട്രാവലർ', 'Travellers'],
  tourbus: ['ടൂറിസ്റ്റ് ബസ്', 'Tourist buses'],
  houseboat: ['ഹൗസ് ബോട്ട്', 'House boats'],
  bakery: ['ബേക്കറികൾ', 'Bakeries'],
  restaurant: ['റസ്റ്റോറന്റുകൾ', 'Restaurants'],
  furniture: ['ഫർണിച്ചർ കടകൾ', 'Furniture shops'],
  supermarket: ['സൂപ്പർ മാർക്കറ്റുകൾ', 'Supermarkets'],
  dress: ['തുണിക്കടകൾ', 'Dress shops'],
  footwear: ['ചെരുപ്പ് കടകൾ', 'Footwear shops'],
  ladies: ['ലേഡീസ് സ്റ്റോറുകൾ', 'Ladies stores'],
  medical: ['മെഡിക്കൽ സ്റ്റോറുകൾ', 'Medical stores'],
  hardware: ['ഹാർഡ്‌വെയർ കടകൾ', 'Hardware shops'],
  stationery: ['സ്റ്റേഷനറി കടകൾ', 'Stationery shops'],
  mobile: ['മൊബൈൽ കടകൾ', 'Mobile shops'],
  jewellery: ['ജ്വല്ലറികൾ', 'Jewellers'],
  shopother: ['മറ്റ് കടകൾ', 'Other shops'],
};

export const NEWS_LABEL: Record<NewsCat, [string, string]> = {
  panchayat: ['പഞ്ചായത്ത്', 'Panchayat'],
  outage: ['മുടക്കം', 'Outage'],
  festival: ['ഉത്സവം / പരിപാടി', 'Festival / event'],
  obituary: ['മരണവാർത്ത', 'Obituary'],
  jobs: ['ജോലി', 'Jobs'],
  farming: ['കൃഷി', 'Farming'],
};

export function rateText(p: Pick<Provider, 'rate' | 'rateUnit' | 'category'>, lang: Lang) {
  if (!p.rate) return lang === 'ml' ? 'കൂലി ചോദിക്കുക' : 'Ask the rate';
  const unit =
    p.rateUnit === 'km' ? (lang === 'ml' ? '/km' : '/km')
    : p.rateUnit === 'job' ? (p.category === 'coconut' ? (lang === 'ml' ? '/തെങ്ങ്' : '/tree') : (lang === 'ml' ? '/പണി' : '/job'))
    : (lang === 'ml' ? '/ദിവസം' : '/day');
  return `₹${p.rate}${unit}`;
}

/** "+919876543210" → "98765 43210" */
export const prettyPhone = (e164: string) => {
  const d = e164.replace(/\D/g, '').slice(-10);
  return d.length === 10 ? `${d.slice(0, 5)} ${d.slice(5)}` : e164;
};
export const telHref = (num: string) => `tel:${num.replace(/[^\d+]/g, '')}`;
export const waHref = (e164: string, text = '') =>
  `https://wa.me/${e164.replace(/\D/g, '')}${text ? `?text=${encodeURIComponent(text)}` : ''}`;

/** Work name to show for a provider: their own job name for "Others", else the category name. */
export function jobName(p: { category: Category; jobTitle?: string }, pair: (x: [string, string]) => string): string {
  return (p.category === 'other' || p.category === 'shopother') && p.jobTitle ? jobLabel(p.jobTitle, pair) : pair(CAT_LABEL[p.category]);
}

/** Suggested job names for "Others" (people can type any other). */
export const JOB_SUGGESTIONS: [string, string][] = [
  ['സ്റ്റേജ് ഡെക്കറേഷൻ', 'Stage decoration'], ['ലൈറ്റ് & സൗണ്ട്', 'Light & sound'], ['ചിത്രകാരൻ / ഡ്രോയിംഗ്', 'Drawing artist'],
  ['ഫോട്ടോഗ്രാഫർ', 'Photographer'], ['കാറ്ററിംഗ്', 'Catering'], ['പെയിന്റർ', 'Painter'], ['മേസൺ / കൽപ്പണി', 'Mason'],
  ['ആശാരി', 'Carpenter'], ['തയ്യൽ', 'Tailoring'], ['ബ്യൂട്ടീഷ്യൻ', 'Beautician'], ['ട്യൂഷൻ', 'Tuition'], ['വീട്ടുജോലി', 'House help'],
  ['ഹോം നഴ്സ്', 'Home nurse'], ['മൊബൈൽ റിപ്പയർ', 'Mobile repair'], ['AC / ഫ്രിഡ്ജ് റിപ്പയർ', 'AC / fridge repair'], ['കിണർ പണി', 'Well work'],
];

/** More ready-made works, always shown under "Call a worker" even before anyone has registered. */
export const EXTRA_JOBS: [string, string][] = [
  ['RO വാട്ടർ പ്യൂരിഫയർ ടെക്നീഷ്യൻ', 'RO water purifier technician'], ['ടൈൽസ് പണി', 'Tile worker'], ['മേൽക്കൂര പണി', 'Roofing worker'], ['ഗ്ലാസ് പണി', 'Glass worker'],
  ['ഫർണിച്ചർ റിപ്പയർ', 'Furniture repair'], ['കീടനിയന്ത്രണം', 'Pest control'], ['വാട്ടർ ടാങ്ക് ക്ലീനിംഗ്', 'Water tank cleaning'], ['ബോർവെൽ ടെക്നീഷ്യൻ', 'Borewell technician'],
  ['മോട്ടോർ / പമ്പ് റിപ്പയർ', 'Motor / pump repair'], ['സോളാർ പാനൽ ടെക്നീഷ്യൻ', 'Solar panel technician'], ['ഇൻവെർട്ടർ / UPS ടെക്നീഷ്യൻ', 'Inverter / UPS technician'],
  ['പൂട്ടുപണി', 'Locksmith'], ['പൂന്തോട്ടം / ലാൻഡ്സ്കേപ്പിംഗ്', 'Gardening / landscaping'], ['പാചകക്കാരൻ', 'Cook'], ['കുട്ടികളെ നോക്കാൻ', 'Babysitter'],
  ['ഡ്രൈവർ', 'Driver'], ['അലക്ക് / ഇസ്തിരി', 'Laundry / ironing'], ['പാക്കേഴ്സ് & മൂവേഴ്സ്', 'Packers & movers'], ['ദിവസവേതന തൊഴിലാളി', 'Daily wage worker'],
];
export const ALL_JOBS: [string, string][] = [...JOB_SUGGESTIONS, ...EXTRA_JOBS];
/** Same work saved in Malayalam or English counts as one: always store/compare the Malayalam name. */
export const canonJob = (s?: string): string => { const t = (s ?? '').trim(); return ALL_JOBS.find((j) => j[0] === t || j[1].toLowerCase() === t.toLowerCase())?.[0] ?? t; };
export const jobLabel = (s: string, pair: (x: [string, string]) => string): string => { const j = ALL_JOBS.find((x) => x[0] === canonJob(s)); return j ? pair(j) : s; };

/** Text of a built-in entry in the chosen language (user-typed entries have no English version and stay as typed). */
export const tr = (o: object, k: string, lang: string): string => { const r = o as { en?: Record<string, string | undefined> } & Record<string, unknown>; return (lang === 'en' && r.en?.[k]) || (r[k] as string | undefined) || ''; };

/** Shrinks a photo to a small JPEG data URL (≈60–150 KB) so it can live in the database without paid file storage. */
export async function compressImage(file: File, maxSide = 960, quality = 0.62): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const k = Math.min(1, maxSide / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    let out = c.toDataURL('image/jpeg', quality);
    if (out.length > 230000) out = c.toDataURL('image/jpeg', 0.4);
    return out;
  } finally { URL.revokeObjectURL(url); }
}

/** Google Maps links (no API key needed). */
export const mapsLink = (q: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
export const mapsEmbed = (q: string) => `https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=15&output=embed`;
