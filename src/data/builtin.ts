import type { Village, Ward } from '../types';

// Panchayats that ship with the app, so they exist even before anyone adds them.
// If the super admin edits one in the Admin panel, the saved copy in the database is used instead.

const W = (no: number, name: string, nameEn: string, member: string, role = 'Member'): Ward => ({ no, name, nameEn, member, role });

export const THAKAZHY: Village = {
  id: 'alappuzha-thakazhy',
  name: 'തകഴി',
  nameEn: 'Thakazhi',
  panchayat: 'തകഴി ഗ്രാമപഞ്ചായത്ത്',
  district: 'ആലപ്പുഴ',
  status: 'live',
  lat: 9.3672,
  lng: 76.4163,
  // Elected members 2025–2030 (LGD: Thakazhi 220986, Champakulam block).
  // The source list has no ward numbers, so 'no' is only an internal id (kept stable by ward name) and is never shown.
  wards: [
    W(1, 'കരുമാടി', 'Karumady', 'Ganesh Kumar M'),
    W(2, 'പടഹാരം', 'Padaharam', 'K V Vipin Kumar', 'Vice President'),
    W(3, 'ചിറയകം', 'Chirayakom', 'Maniyamma V C'),
    W(4, 'തെന്നടി', 'Thennady', 'K Gopalakrishnan'),
    W(5, 'വേഴപ്ര', 'Vezhapram', 'S Sreejith', 'Standing Committee Chairman'),
    W(6, 'തകഴി', 'Thakazhy', 'Sangeetha Manoj', 'Standing Committee Chairman'),
    W(7, 'കേളമംഗലം', 'Kelamangalam', 'Supin P'),
    W(8, 'ചെക്കിടിക്കാട്', 'Chekkidikkadu', 'Smitha S S'),
    W(9, 'ചെക്കിടിക്കാട് ഈസ്റ്റ്', 'Chekkidikkadu East', 'Merlin Jogy'),
    W(10, 'കുന്നുമ്മ സൗത്ത്', 'Kunnumma South', 'Asha K S'),
    W(11, 'കുന്നുമ്മ', 'Kunnumma', 'Geethanjali S G'),
    W(12, 'കുന്നുമ്മ നോർത്ത്', 'Kunnumma North', 'Nihas M N'),
    W(13, 'തകഴി നോർത്ത്', 'Thakazhy North', 'Sethudas M'),
    W(14, 'കളത്തിപ്പാലം', 'Kalathipalam', 'Asha Omanakuttan', 'Standing Committee Chairman'),
    W(15, 'റെയിൽവേ സ്റ്റേഷൻ', 'Railway Station', 'Meera Girish'),
  ],
};

export const BUILTIN: Village[] = [THAKAZHY];

/** Built-in panchayats first, then the database ones; a database copy of a built-in wins (but keeps the ward list if it has none). */
export function withBuiltin(db: Village[]): Village[] {
  const byId = new Map(db.map((v) => [v.id, v]));
  const builtin = BUILTIN.map((b) => {
    const d = byId.get(b.id);
    return d ? { ...b, ...d, wards: d.wards?.length ? d.wards : b.wards } : b;
  });
  return [...builtin, ...db.filter((v) => !BUILTIN.some((b) => b.id === v.id))];
}

// ---- Built-in bus times (from public web listings; approximate – confirm with depot) ----
import type { EnText, Timing } from '../types';
const tm = (id: string, time: string, from: string, to: string, stop: string, name: string, note?: string, mode: Timing['mode'] = 'bus', number?: string): Timing => ({
  id: 'b-' + id, villageId: 'alappuzha-thakazhy', mode, number, name, stop, from, to, time, note,
  days: 'ദിവസവും', addedBy: 'builtin', addedByName: 'Gramaseva (web)', createdAt: 0,
});
const RAW_TIMINGS: Timing[] = [
  ...['05:00', '05:20', '05:40', '06:00', '06:15', '06:25', '06:40', '07:00'].map((t) => {
    const [h, m] = t.split(':').map(Number); const a = h * 60 + m + 45; const at = String(Math.floor(a / 60)).padStart(2, '0') + ':' + String(a % 60).padStart(2, '0');
    return tm('alp-' + t, at, 'ആലപ്പുഴ', 'തിരുവല്ല', 'തകഴി ബസ് സ്റ്റോപ്പ്', 'KSRTC (ആലപ്പുഴ → തിരുവല്ല)',
      `ആലപ്പുഴയിൽ നിന്ന് ${t}-ന് പുറപ്പെടും · തകഴിയിൽ ഏകദേശ സമയം` + (t === '07:00' ? ' (വണ്ടാനം 07:25, അമ്പലപ്പുഴ 07:35, തകഴി 07:45)' : ' (ഏകദേശം 45 മിനിറ്റ് കഴിഞ്ഞ്)'));
  }),
  tm('ers-1005', '12:50', 'എറണാകുളം', 'ചെങ്ങന്നൂർ / എടത്വ', 'തകഴി ബസ് സ്റ്റോപ്പ്', 'KSRTC Fast Passenger', 'എറണാകുളത്ത് നിന്ന് 10:05-ന് പുറപ്പെടും · തകഴിയിൽ 12:50 · യാത്ര 2 മ. 45 മി.'),
  tm('tzy-0500', '05:00', 'തകഴി', 'എറണാകുളം', 'തകഴി ബസ് സ്റ്റോപ്പ്', 'KSRTC Fast Passenger', 'എറണാകുളത്ത് 08:35 · യാത്ര 3 മ. 35 മി.'),
  tm('tzy-1410', '14:10', 'തകഴി', 'എറണാകുളം', 'തകഴി ബസ് സ്റ്റോപ്പ്', 'KSRTC Limited Stop', 'എറണാകുളത്ത് ~18:55 (വെബ് ലിസ്റ്റിംഗ്; സമയം ഉറപ്പുവരുത്തുക)'),
  ...[['04:00', 'KSRTC Super Fast'], ['04:55', 'KSRTC'], ['06:50', 'KSRTC'], ['07:15', 'KSRTC Swift (ആലപ്പുഴ 08:25)'], ['08:00', 'KSRTC'], ['08:30', 'KSRTC'],
    ['11:00', 'KSRTC (ആലപ്പുഴ 12:05)'], ['14:45', 'KSRTC (ആലപ്പുഴ 15:50)'], ['18:40', 'KSRTC (ആലപ്പുഴ 19:50)']].map(([t, n]) =>
    tm('tvl-' + t, t, 'തിരുവല്ല', 'ആലപ്പുഴ', 'തിരുവല്ല ബസ് സ്റ്റാൻഡ് → ആലപ്പുഴ', n, 'തിരുവല്ലയിൽ നിന്നുള്ള സമയം; തകഴി വഴി; യാത്ര ~1 മണിക്കൂർ 15 മിനിറ്റ്')),
  tm('trn-56319', '20:14', 'എറണാകുളം ജം.', 'കായംകുളം', 'തകഴി സ്റ്റേഷൻ', 'Ernakulam – Kayamkulam Passenger',
    'എറണാകുളത്തുനിന്ന് 18:25-ന് പുറപ്പെടും · തകഴിയിൽ 20:14 · യാത്ര 1 മ. 49 മി. · ടിക്കറ്റ് ₹45 (കുട്ടി ₹30)', 'train', '56319'),
  tm('trn-56320', '09:20', 'തകഴി', 'എറണാകുളം ജം.', 'തകഴി സ്റ്റേഷൻ', 'Kayamkulam – Ernakulam Passenger',
    'തകഴിയിൽ നിന്ന് 09:20 · എറണാകുളത്ത് 11:30', 'train', '56320'),
];

// ---- Built-in directory (public web listings; confirm details with the ward member) ----
import type { Contact } from '../types';
const ct = (id: string, kind: Contact['kind'], name: string, address: string, note?: string, phone = ''): Contact => ({
  id: 'b-' + id, villageId: 'alappuzha-thakazhy', kind, name, phone, address, note, status: 'approved', createdBy: 'builtin', createdAt: 0,
});
const RAW_CONTACTS: Contact[] = [
  // Government schools
  ct('s-kkk', 'school', 'കെ.കെ. കുമാരപിള്ള സ്മാരക ഗവ. ഹൈസ്കൂൾ (GHS) കരുമാടി', 'കരുമാടി', 'സർക്കാർ · 1–10 ക്ലാസ്'),
  ct('s-tss', 'school', 'ടി.എസ്.എസ്. ഗവ. യു.പി. സ്കൂൾ (GUPS) തകഴി', 'തകഴി', 'സർക്കാർ · LP/UP · പ്രദേശത്തെ ക്ലസ്റ്റർ റിസോഴ്സ് സെന്റർ'),
  ct('s-chir', 'school', 'ഗവ. യു.പി. സ്കൂൾ (GUPS) ചിറയകം', 'ചിറയകം', 'സർക്കാർ · LP/UP'),
  ct('s-then', 'school', 'ഗവ. എൽ.പി. സ്കൂൾ (GLPS) തെന്നടി', 'തെന്നടി', 'സർക്കാർ · LP'),
  ct('s-kela', 'school', 'എൽ.പി. സ്കൂൾ (LPS) കേളമംഗലം', 'കേളമംഗലം', 'LP'),
  // Aided
  ct('s-dbhss', 'school', 'ദേവസ്വം ബോർഡ് ഹയർ സെക്കൻഡറി സ്കൂൾ (DBHSS) തകഴി', 'തകഴി', 'എയ്ഡഡ് · 8–12 · മലയാളം/ഇംഗ്ലീഷ് · സയൻസ്, കൊമേഴ്സ്, ഹ്യുമാനിറ്റീസ്', '+914772275993'),
  ct('s-holy', 'school', 'ഹോളി ഫാമിലി എൽ.പി. സ്കൂൾ കുന്നുമ്മ', 'കുന്നുമ്മ', 'എയ്ഡഡ് · LP'),
  // Private / unaided
  ct('s-carmel', 'school', 'കാർമൽ ഇംഗ്ലീഷ് മീഡിയം സ്കൂൾ തകഴി', 'തകഴി', 'CBSE · 1–10 · ആൺ/പെൺ'),
  ct('s-salafi', 'school', 'സലഫി ഇംഗ്ലീഷ് മീഡിയം സ്കൂൾ കുന്നുമ്മ', 'കുന്നുമ്മ', 'ഇംഗ്ലീഷ് മീഡിയം'),
  ct('s-lf', 'school', 'ലിറ്റിൽ ഫ്ലവർ ഇംഗ്ലീഷ് മീഡിയം സ്കൂൾ', 'തകഴി', 'ഇംഗ്ലീഷ് മീഡിയം · പ്രൈമറി'),
  // Health
  ct('h-rbm', 'hospital', 'ആർ.ബി.എം. ഹോസ്പിറ്റൽ', 'തകഴി P.O., 688562', '24 മണിക്കൂർ ക്വാഷ്വാലിറ്റി', '+914772275204'),
  ct('h-phc', 'hospital', 'കുടുംബാരോഗ്യ കേന്ദ്രം (FHC/PHC) തകഴി', 'തകഴി P.O., 688562', 'സർക്കാർ · ഇമെയിൽ: phcthakazhy@gmail.com', '+914772275900'),
  ct('h-gay', 'hospital', 'ഗായത്രി ക്ലിനിക്', 'തകഴി', undefined, '+914772274671'),
  ct('h-tdm', 'hospital', 'ഗവ. ടി.ഡി. മെഡിക്കൽ കോളേജ് ആശുപത്രി', 'വണ്ടാനം, ആലപ്പുഴ – 688005', 'അടുത്തുള്ള വലിയ സർക്കാർ മെഡിക്കൽ കോളേജ് ആശുപത്രി (ബസ് തകഴി വഴി)'),
  ct('h-dent', 'hospital', 'ഡോ. പ്രണവ് ഡെന്റൽ ക്ലിനിക്', 'തകഴി', 'ദന്തരോഗം', '+9188910 50610'.replace(/\s/g, '')),
];

const tx = (s: string) => s.replace(/ആലപ്പുഴ/g, 'Alappuzha');
function enTiming(t: Timing): Timing {
  const id = t.id;
  const en: EnText = { days: 'Daily' };
  if (id.startsWith('b-alp-')) {
    const dep = t.note?.match(/(\d\d:\d\d)-ന്/)?.[1] ?? '';
    Object.assign(en, { from: 'Alappuzha', to: 'Thiruvalla', stop: 'Thakazhy bus stop', name: 'KSRTC (Alappuzha → Thiruvalla)',
      note: `Leaves Alappuzha at ${dep} · approx. time at Thakazhy` + (dep === '07:00' ? ' (Vandanam 07:25, Ambalappuzha 07:35, Thakazhy 07:45)' : ' (about 45 min later)') });
  } else if (id.startsWith('b-tvl-')) {
    Object.assign(en, { from: 'Thiruvalla', to: 'Alappuzha', stop: 'Thiruvalla bus stand → Alappuzha', name: tx(t.name), note: 'Departure time from Thiruvalla; via Thakazhy; about 1 h 15 min' });
  } else if (id === 'b-ers-1005') {
    Object.assign(en, { from: 'Ernakulam', to: 'Chengannur / Edathua', stop: 'Thakazhy bus stop', note: 'Leaves Ernakulam at 10:05 · Thakazhy 12:50 · 2 h 45 min' });
  } else if (id === 'b-tzy-0500') {
    Object.assign(en, { from: 'Thakazhy', to: 'Ernakulam', stop: 'Thakazhy bus stop', note: 'Ernakulam 08:35 · 3 h 35 min' });
  } else if (id === 'b-tzy-1410') {
    Object.assign(en, { from: 'Thakazhy', to: 'Ernakulam', stop: 'Thakazhy bus stop', note: 'Ernakulam ~18:55 (web listing; please confirm the time)' });
  } else if (id === 'b-trn-56319') {
    Object.assign(en, { from: 'Ernakulam Jn.', to: 'Kayamkulam', stop: 'Thakazhy station', note: 'Leaves Ernakulam at 18:25 · Thakazhy 20:14 · 1 h 49 min · Fare ₹45 (child ₹30)' });
  } else if (id === 'b-trn-56320') {
    Object.assign(en, { from: 'Thakazhy', to: 'Ernakulam Jn.', stop: 'Thakazhy station', note: 'From Thakazhy 09:20 · Ernakulam 11:30' });
  }
  return { ...t, en };
}
export const BUILTIN_TIMINGS: Timing[] = RAW_TIMINGS.map(enTiming);

const EN_CONTACTS: Record<string, EnText & { name: string }> = {
  'b-s-kkk': { name: 'K.K. Kumarapillai Smaraka Govt. High School (GHS), Karumady', address: 'Karumady', note: 'Government · Classes 1–10' },
  'b-s-tss': { name: 'TSS Govt. UP School (GUPS), Thakazhy', address: 'Thakazhy', note: 'Government · LP/UP · Cluster resource centre for the area' },
  'b-s-chir': { name: 'Govt. UP School (GUPS), Chirayakom', address: 'Chirayakom', note: 'Government · LP/UP' },
  'b-s-then': { name: 'Govt. LP School (GLPS), Thennady', address: 'Thennady', note: 'Government · LP' },
  'b-s-kela': { name: 'LP School (LPS), Kelamangalam', address: 'Kelamangalam', note: 'LP' },
  'b-s-dbhss': { name: 'Devaswom Board Higher Secondary School (DBHSS), Thakazhy', address: 'Thakazhy', note: 'Aided · Classes 8–12 · Malayalam/English medium · Science, Commerce, Humanities' },
  'b-s-holy': { name: 'Holy Family LP School, Kunnumma', address: 'Kunnumma', note: 'Aided · LP' },
  'b-s-carmel': { name: 'Carmel English Medium School, Thakazhy', address: 'Thakazhy', note: 'CBSE · Classes 1–10 · Co-ed' },
  'b-s-salafi': { name: 'Salafi English Medium School, Kunnumma', address: 'Kunnumma', note: 'English medium' },
  'b-s-lf': { name: 'Little Flower English Medium School', address: 'Thakazhy', note: 'English medium · Primary' },
  'b-h-rbm': { name: 'RBM Hospital', address: 'Thakazhy P.O., 688562', note: '24-hour casualty' },
  'b-h-phc': { name: 'Family Health Centre (FHC/PHC) Thakazhy', address: 'Thakazhy P.O., 688562', note: 'Government · Email: phcthakazhy@gmail.com' },
  'b-h-gay': { name: 'Gayatri Clinic', address: 'Thakazhy' },
  'b-h-tdm': { name: 'Govt. T.D. Medical College Hospital', address: 'Vandanam, Alappuzha – 688005', note: 'Large government medical college hospital nearby (buses pass via Thakazhy)' },
  'b-h-dent': { name: "Dr. Pranav's Dental Clinic", address: 'Thakazhy', note: 'Dental care' },
};
export const BUILTIN_CONTACTS: Contact[] = RAW_CONTACTS.map((c) => ({ ...c, en: EN_CONTACTS[c.id] }));
