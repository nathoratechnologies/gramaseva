// Sample data for Demo mode only. All names, numbers and places are made up.
import type { Booking, News, Provider, Report, Review, UserProfile, Village } from '../types';

const H = 3600_000;
const D = 24 * H;

export function makeSeed(now = Date.now()) {
  const villages: Village[] = [
    { id: 'kizhakkemuri', name: 'കിഴക്കേമുറി', nameEn: 'Kizhakkemuri', panchayat: 'മാതൃക പഞ്ചായത്ത്', district: 'തൃശ്ശൂർ', status: 'live', lat: 10.530, lng: 76.215, panchayatPhone: '0487 200 0000' },
    { id: 'padinjaremuri', name: 'പടിഞ്ഞാറേമുറി', nameEn: 'Padinjaremuri', panchayat: 'മാതൃക പഞ്ചായത്ത്', district: 'തൃശ്ശൂർ', status: 'live', lat: 10.528, lng: 76.175 },
    { id: 'thekkekkara', name: 'തെക്കേക്കര', nameEn: 'Thekkekkara', panchayat: 'മാതൃക പഞ്ചായത്ത്', district: 'തൃശ്ശൂർ', status: 'soon', lat: 10.495, lng: 76.205 },
  ];

  const base = { villageId: 'kizhakkemuri', lat: 10.530, lng: 76.215, status: 'approved' as const, createdAt: now - 30 * D };
  const P = (p: Partial<Provider> & Pick<Provider, 'uid' | 'name' | 'category' | 'rate'>): Provider => ({
    phone: '+910000000000', rateUnit: 'day', radiusKm: 5, availableUntil: now + 8 * H, verified: true,
    ratingSum: 0, ratingCount: 0, ...base, ...p,
  });

  const providers: Provider[] = [
    P({ uid: 'p-suresh', name: 'സുരേഷ് പി.', phone: '+919000000101', category: 'plumbing', rate: 500, experienceYears: 12, ratingSum: 154, ratingCount: 32, lat: 10.533, lng: 76.222, about: 'പൈപ്പ് ചോർച്ച, ടാങ്ക്, മോട്ടോർ ഫിറ്റിംഗ്.' }),
    P({ uid: 'p-anil', name: 'അനിൽ കുമാർ', phone: '+919000000102', category: 'plumbing', rate: 450, experienceYears: 6, ratingSum: 83, ratingCount: 18, lat: 10.540, lng: 76.220 }),
    P({ uid: 'p-joseph', name: 'ജോസഫ് ടി.', phone: '+919000000103', category: 'plumbing', rate: 600, experienceYears: 20, ratingSum: 250, ratingCount: 51, availableUntil: now - H, lat: 10.552, lng: 76.231 }),
    P({ uid: 'p-shibu', name: 'ഷിബു വി.', phone: '+919000000104', category: 'plumbing', rate: 550, radiusKm: 8, ratingSum: 54, ratingCount: 12, villageId: 'padinjaremuri', lat: 10.528, lng: 76.175 }),
    P({ uid: 'p-manoj', name: 'മനോജ് കെ.', phone: '+919000000105', category: 'electrical', rate: 600, experienceYears: 9, ratingSum: 112, ratingCount: 24 }),
    P({ uid: 'p-vinod', name: 'വിനോദ് എസ്.', phone: '+919000000106', category: 'electrical', rate: 550, availableUntil: now - 2 * H, ratingSum: 40, ratingCount: 9 }),
    P({ uid: 'p-rafeeq', name: 'റഫീഖ്', phone: '+919000000107', category: 'welding', rate: 700, experienceYears: 15, ratingSum: 70, ratingCount: 15 }),
    P({ uid: 'p-mani', name: 'മണി', phone: '+919000000108', category: 'coconut', rate: 40, rateUnit: 'job', about: 'ഒരു തെങ്ങിന് ₹40. യന്ത്രം ഉപയോഗിക്കും.', ratingSum: 141, ratingCount: 29 }),
    P({ uid: 'p-babu', name: 'ബാബു', phone: '+919000000109', category: 'coconut', rate: 45, rateUnit: 'job', availableUntil: now - H, ratingSum: 36, ratingCount: 8 }),
    P({ uid: 'p-shantha', name: 'ശാന്ത', phone: '+919000000110', category: 'farming', rate: 600, about: 'നടീൽ, കള പറിക്കൽ, കൊയ്ത്ത്.', ratingSum: 46, ratingCount: 10 }),
    P({ uid: 'p-biju', name: 'ബിജു', phone: '+919000000111', category: 'auto', rate: 20, rateUnit: 'km', vehicleNo: 'KL 08 AB 1234', ratingSum: 207, ratingCount: 44, lat: 10.531, lng: 76.212 }),
    P({ uid: 'p-shaji', name: 'ഷാജി', phone: '+919000000112', category: 'auto', rate: 20, rateUnit: 'km', vehicleNo: 'KL 08 CD 5678', ratingSum: 117, ratingCount: 26, lat: 10.525, lng: 76.219 }),
    P({ uid: 'p-rasheed', name: 'റഷീദ്', phone: '+919000000113', category: 'auto', rate: 22, rateUnit: 'km', vehicleNo: 'KL 08 EF 9012', verified: false, ratingSum: 49, ratingCount: 10, villageId: 'padinjaremuri', lat: 10.528, lng: 76.180 }),
    P({ uid: 'p-thomas', name: 'തോമസ്', phone: '+919000000114', category: 'car4', rate: 16, rateUnit: 'km', vehicleNo: 'KL 08 GH 3344', ratingSum: 93, ratingCount: 20 }),
    P({ uid: 'p-sunil', name: 'സുനിൽ', phone: '+919000000115', category: 'car7', rate: 20, rateUnit: 'km', vehicleNo: 'KL 08 JK 7788', ratingSum: 45, ratingCount: 10 }),
    // Waiting for coordinator approval
    P({ uid: 'p-pending-1', name: 'സലീം', phone: '+919000000120', category: 'auto', rate: 20, rateUnit: 'km', vehicleNo: 'KL 08 GH 4455', status: 'pending', verified: false, createdAt: now - 5 * H }),
    P({ uid: 'p-pending-2', name: 'ഗീത', phone: '+919000000121', category: 'farming', rate: 550, status: 'pending', verified: false, createdAt: now - 26 * H }),
  ];

  const N = (n: Partial<News> & Pick<News, 'id' | 'title' | 'body' | 'category'>): News => ({
    villageId: 'kizhakkemuri', important: false, status: 'published', postedBy: 'demo-admin', postedByName: 'വാർഡ് മെമ്പർ', createdAt: now - D, ...n,
  });
  const news: News[] = [
    N({ id: 'n1', category: 'outage', important: true, title: 'നാളെ രാവിലെ 9 മുതൽ 2 വരെ വൈദ്യുതി മുടക്കം', body: 'ലൈൻ അറ്റകുറ്റപ്പണി കാരണം കിഴക്കേമുറി, പള്ളിപ്പടി ഭാഗങ്ങളിൽ നാളെ രാവിലെ 9 മുതൽ ഉച്ചയ്ക്ക് 2 വരെ വൈദ്യുതി ഉണ്ടാകില്ല.', postedByName: 'KSEB സെക്ഷൻ', createdAt: now - H }),
    N({ id: 'n2', category: 'festival', title: 'ക്ഷേത്ര ഉത്സവം ഡിസംബർ 12 മുതൽ', body: 'ഈ വർഷത്തെ ഉത്സവം ഡിസംബർ 12 മുതൽ 18 വരെ. ആറാട്ട് 18-ന് വൈകുന്നേരം. ഉത്സവ ദിവസങ്ങളിൽ ക്ഷേത്ര റോഡിൽ വാഹന നിയന്ത്രണം ഉണ്ടാകും.', postedByName: 'ക്ഷേത്ര കമ്മിറ്റി', createdAt: now - 3 * H }),
    N({ id: 'n3', category: 'panchayat', title: 'ഗ്രാമസഭ ശനിയാഴ്ച രാവിലെ 10 മണിക്ക്', body: 'വാർഡ് 7 ഗ്രാമസഭ ശനിയാഴ്ച രാവിലെ 10 മണിക്ക് അംഗൻവാടി ഹാളിൽ. ക്ഷേമ പെൻഷൻ, റോഡ് പണി എന്നിവ ചർച്ച ചെയ്യും.', createdAt: now - D }),
    N({ id: 'n4', category: 'farming', title: 'കൃഷിഭവനിൽ പച്ചക്കറി വിത്ത് വിതരണം', body: 'തിങ്കളാഴ്ച മുതൽ കൃഷിഭവനിൽ സൗജന്യ പച്ചക്കറി വിത്ത് കിറ്റ് ലഭിക്കും. ആധാർ കാർഡിന്റെ കോപ്പി കൊണ്ടുവരുക.', postedByName: 'കൃഷി ഓഫീസ്', createdAt: now - 2 * D }),
    N({ id: 'n5', category: 'jobs', title: 'തൊഴിലുറപ്പ്: പുതിയ പണി അടുത്ത ആഴ്ച', body: 'വാർഡ് 5–8 തൊഴിലുറപ്പ് തൊഴിലാളികൾക്ക് അടുത്ത ആഴ്ച തോട് വൃത്തിയാക്കൽ പണി. പേര് മേറ്റിനെ അറിയിക്കുക.', createdAt: now - 4 * D }),
    N({ id: 'n6', category: 'outage', title: 'വാർഡ് 5–8 കുടിവെള്ളം മുടങ്ങും', body: 'പൈപ്പ് മാറ്റുന്നതിനാൽ വ്യാഴാഴ്ച കുടിവെള്ള വിതരണം ഉണ്ടാകില്ല.', status: 'pending', postedByName: 'ജല അതോറിറ്റി', createdAt: now - 2 * H }),
    N({ id: 'n7', category: 'panchayat', title: 'പടിഞ്ഞാറേമുറി റോഡ് ടാറിംഗ് തുടങ്ങി', body: 'പടിഞ്ഞാറേമുറി – ബസ് സ്റ്റാൻഡ് റോഡ് ടാറിംഗ് ഈ ആഴ്ച പൂർത്തിയാകും.', villageId: 'padinjaremuri', createdAt: now - D }),
  ];

  const reviews: Review[] = [
    { id: 'r1', providerId: 'p-suresh', customerId: 'u-leela', customerName: 'ലീല എം.', stars: 5, comment: 'സമയത്ത് വന്നു, നല്ല പണി. കൂലി ന്യായം.', createdAt: now - 3 * D },
    { id: 'r2', providerId: 'p-suresh', customerId: 'u-kumaran', customerName: 'കുമാരൻ', stars: 4, comment: 'പണി നന്നായി, കുറച്ച് വൈകി.', createdAt: now - 9 * D },
    { id: 'r3', providerId: 'p-biju', customerId: 'u-leela', customerName: 'ലീല എം.', stars: 5, comment: 'സൂക്ഷിച്ച് ഓടിക്കും.', createdAt: now - 5 * D },
    { id: 'r4', providerId: 'p-mani', customerId: 'u-kumaran', customerName: 'കുമാരൻ', stars: 5, comment: '20 തെങ്ങ് ഒരു ദിവസം കൊണ്ട് തീർത്തു.', createdAt: now - 6 * D },
  ];

  const users: UserProfile[] = [
    { uid: 'u-leela', name: 'ലീല എം.', phone: '+919000000201', villageId: 'kizhakkemuri', lang: 'ml', role: 'user', createdAt: now - 40 * D },
    { uid: 'u-kumaran', name: 'കുമാരൻ', phone: '+919000000202', villageId: 'kizhakkemuri', lang: 'ml', role: 'user', createdAt: now - 35 * D },
    { uid: 'u-coord', name: 'രമ്യ (കോഓർഡിനേറ്റർ)', phone: '+919000000203', villageId: 'kizhakkemuri', lang: 'ml', role: 'coordinator', coordinatorOf: 'kizhakkemuri', createdAt: now - 50 * D },
  ];

  const bookings: Booking[] = [];

  const reports: Report[] = [
    { id: 'rep1', reportedBy: 'u-kumaran', reporterName: 'കുമാരൻ', againstId: 'p-vinod', againstName: 'വിനോദ് എസ്.', villageId: 'kizhakkemuri', reason: 'പറഞ്ഞ സമയത്ത് വന്നില്ല, ഫോൺ എടുത്തില്ല.', status: 'open', createdAt: now - 6 * H },
  ];

  return { villages, providers, news, reviews, users, bookings, reports };
}

export type SeedData = ReturnType<typeof makeSeed>;
