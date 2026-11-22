// Is this page running inside the Google Play (Trusted Web Activity) app?
// The Play app opens https://…/?src=play ; Android also sets an android-app:// referrer on launch.
// Inside the Play app no payment is taken in the app (Play billing rules); the owner records payments by hand.
const KEY = 'gs-store';
export function isPlayApp(): boolean {
  try {
    const q = new URLSearchParams(location.search).get('src');
    if (q === 'play' || document.referrer.startsWith('android-app://')) localStorage.setItem(KEY, 'play');
    return localStorage.getItem(KEY) === 'play';
  } catch { return false; }
}

export const DISCLAIMER: [string, string] = [
  'ഗ്രാമസേവ ഒരു സ്വകാര്യ community app ആണ്. ഇത് സർക്കാരിന്റെയോ ഗ്രാമപഞ്ചായത്തിന്റെയോ ഔദ്യോഗിക app അല്ല, അവരുമായി ഔദ്യോഗിക ബന്ധവുമില്ല. ഔദ്യോഗിക വിവരങ്ങൾ പഞ്ചായത്ത് ഓഫീസിൽ നിന്ന് ഉറപ്പാക്കുക.',
  'Gramaseva is a private community app. It is not an official app of the Government or any Grama Panchayat and is not affiliated with them. Please confirm official information with the panchayat office.',
];
