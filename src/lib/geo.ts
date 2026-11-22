// Location helpers: GPS position + free reverse geocoding (no API key).
//  - BigDataCloud client API: district and panchayat / municipality (Malayalam + English)
//  - OpenStreetMap Nominatim: the local place name (village / locality)

export interface Place {
  lat: number;
  lng: number;
  district: string;
  districtEn: string;
  panchayat: string;
  panchayatEn: string;
  village: string;
  villageEn: string;
}

export function getPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('no-geolocation'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: Math.round(p.coords.latitude * 1e5) / 1e5, lng: Math.round(p.coords.longitude * 1e5) / 1e5 }),
      reject,
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  });
}

interface BdcAdmin { name: string; adminLevel: number }
const LOCAL_BODY = /പഞ്ചായത്ത്|പഞ്ചായത്|panchayat|മുനിസിപ്പ|municipal|കോര്‍പ്പറേഷന്‍|കോർപ്പറേഷൻ|corporation/i;
// Block and district panchayats cover many grama panchayats: never use them as the person's panchayat.
const TOO_BIG = /ബ്ലോക്ക്|ബ്ലോക്|block|ജില്ലാ\s*പഞ്ചായത്ത്|district\s*panchayat|taluk|താലൂക്ക്/i;
const GRAMA = /ഗ്രാമ|grama|gram\b|മുനിസിപ്പ|municipal|കോര്‍പ്പറേഷന്‍|കോർപ്പറേഷൻ|corporation/i;

async function bdc(lat: number, lng: number, lang: 'ml' | 'en') {
  const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=${lang}`);
  if (!r.ok) throw new Error('bdc ' + r.status);
  const j = await r.json();
  const admin: BdcAdmin[] = (j.localityInfo?.administrative ?? []).filter((a: BdcAdmin) => a.name);
  const district = admin.find((a) => a.adminLevel === 5)?.name ?? '';
  const local = admin.filter((a) => a.adminLevel >= 6 && !TOO_BIG.test(a.name));
  const panchayat = local.find((a) => GRAMA.test(a.name))?.name
    ?? local.find((a) => a.adminLevel >= 7 && LOCAL_BODY.test(a.name))?.name
    ?? ''; // unknown: the person types it rather than getting a wrong one
  return {
    district: district.replace(/\s*(ജില്ല|district)$/i, '').trim(),
    panchayat: panchayat.trim(),
    locality: (j.locality ?? '') as string,
  };
}

async function osm(lat: number, lng: number, lang: 'ml' | 'en') {
  const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=16&accept-language=${lang}`);
  if (!r.ok) throw new Error('osm ' + r.status);
  const a = (await r.json()).address ?? {};
  return (a.village || a.hamlet || a.suburb || a.neighbourhood || a.town || a.city_district || '') as string;
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Best-effort names for a point. Any part that fails comes back empty for the person to type. */
export async function reverseGeocode(lat: number, lng: number): Promise<Place> {
  const [ml, en] = await Promise.all([bdc(lat, lng, 'ml').catch(() => null), bdc(lat, lng, 'en').catch(() => null)]);
  const vMl = await osm(lat, lng, 'ml').catch(() => '');
  await pause(1100); // Nominatim allows one request per second
  const vEn = await osm(lat, lng, 'en').catch(() => '');
  return {
    lat, lng,
    district: ml?.district ?? '',
    districtEn: en?.district ?? '',
    panchayat: ml?.panchayat ?? '',
    panchayatEn: en?.panchayat ?? '',
    village: vMl || ml?.locality || '',
    villageEn: vEn || en?.locality || '',
  };
}
