// India PIN codes: check a PIN and find roughly where it is (both free, no API key).
//  - India Post API (api.postalpincode.in): is the PIN real, its post offices, district and state
//  - OpenStreetMap Nominatim: the centre of the PIN area, for "near me" distances
import type { UserProfile, Village } from '../types';
import { km } from './util';

export const PIN_RE = /^[1-9][0-9]{5}$/;
export const cleanPin = (s: string) => s.replace(/\D/g, '').slice(0, 6);

export interface PinInfo {
  pincode: string;
  places: string[]; // post office names
  district: string;
  state: string;
  lat?: number;
  lng?: number;
}

const cache = new Map<string, Promise<PinInfo | null>>();

async function indiaPost(pin: string) {
  const r = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
  if (!r.ok) throw new Error('postalpincode ' + r.status);
  const j = (await r.json()) as { Status: string; PostOffice: { Name: string; District: string; State: string }[] | null }[];
  const offices = j?.[0]?.Status === 'Success' ? j[0].PostOffice ?? [] : [];
  return offices;
}

async function nominatim(q: string) {
  const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=in&${q}`);
  if (!r.ok) return null;
  const j = (await r.json()) as { lat: string; lon: string }[];
  return j[0] ? { lat: Math.round(+j[0].lat * 1e5) / 1e5, lng: Math.round(+j[0].lon * 1e5) / 1e5 } : null;
}

/**
 * Details of a PIN code. null = not a real PIN code. Throws when India Post can't be reached
 * (the caller may then accept the PIN as typed).
 */
export function lookupPincode(pin: string): Promise<PinInfo | null> {
  if (!PIN_RE.test(pin)) return Promise.resolve(null);
  const hit = cache.get(pin);
  if (hit) return hit;
  const p = (async () => {
    const offices = await indiaPost(pin);
    if (!offices.length) return null;
    const { District: district, State: state } = offices[0];
    const pt = (await nominatim(`postalcode=${pin}`).catch(() => null))
      ?? (await nominatim(`q=${encodeURIComponent(`${offices[0].Name}, ${district}, ${state}`)}`).catch(() => null));
    return { pincode: pin, places: offices.map((o) => o.Name), district, state, ...(pt ?? {}) };
  })();
  cache.set(pin, p);
  p.catch(() => cache.delete(pin));
  return p;
}

/** Profile fields to save for a PIN code. */
export function pinFields(pin: string, info: PinInfo | null): Pick<UserProfile, 'pincode' | 'pinLat' | 'pinLng' | 'pinPlace'> {
  return {
    pincode: pin,
    ...(info?.lat != null && info.lng != null ? { pinLat: info.lat, pinLng: info.lng } : {}),
    ...(info?.places.length ? { pinPlace: `${info.places[0]}, ${info.district}` } : {}),
  };
}

/** Where "near me" is measured from: the person's PIN area, else their panchayat. */
export function myPoint(profile: UserProfile | null, home: Village | null): { lat: number; lng: number } | null {
  if (profile?.pinLat != null && profile.pinLng != null) return { lat: profile.pinLat, lng: profile.pinLng };
  return home && (home.lat || home.lng) ? { lat: home.lat, lng: home.lng } : null;
}

type Placed = { pincode?: string; lat?: number; lng?: number };
/**
 * Sort nearest first: same PIN code first, then by distance from me (items without a location go last).
 * Returns each item with its distance in km (null = unknown).
 */
export function nearFirst<T extends Placed>(items: T[], myPin: string | undefined, me: { lat: number; lng: number } | null) {
  return items
    .map((x) => ({
      x,
      same: !!myPin && x.pincode === myPin,
      d: me && x.lat != null && x.lng != null && (x.lat || x.lng) ? Math.round(km(me, { lat: x.lat, lng: x.lng }) * 10) / 10 : null,
    }))
    .sort((a, b) => Number(b.same) - Number(a.same) || (a.d ?? 1e9) - (b.d ?? 1e9));
}
