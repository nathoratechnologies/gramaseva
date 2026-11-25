import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { BadgeCheck, Clock, LocateFixed, MapPin } from 'lucide-react';
import { useApp, useLoad } from '../lib/app';
import { getPosition, placeName, searchPlaces, type PlaceHit } from '../lib/geo';
import { myPoint } from '../lib/pincode';
import { LiveMap, RoutePickMap, type MapPoint } from '../components/LazyMap';
import { Avatar, CatIcon, Empty, LoadError, Loading, Screen, StarRow } from '../components/ui';
import { CAT_LABEL, isFree, km, rateText, rating, telHref, timeAgo, todayISO } from '../lib/util';
import { VEHICLE_CATS, type Booking, type VehicleCategory } from '../types';
import { withReach } from './Workers';

type LL = { lat: number; lng: number };
const ROAD = 1.3; // roads are ~30% longer than a straight line
const SPEED_KMH = 25; // village roads
const STALE_MS = 3 * 60000;
export const VEH_EMOJI: Record<VehicleCategory, string> = { auto: '🛺', car4: '🚗', car7: '🚙', goods: '🚚', traveller: '🚐', tourbus: '🚌', houseboat: '🛥️' };
const roadKm = (a: LL, b: LL) => Math.round(km(a, b) * ROAD * 10) / 10;
const num = (v: string | null) => (v != null && v !== '' && Number.isFinite(+v) ? +v : null);
export const latLng = (lat: number | null | undefined, lng: number | null | undefined): LL | null => (lat != null && lng != null ? { lat, lng } : null);
/** Google Maps directions to a point (for the driver). */
export const directions = (p: LL) => `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;

export function Ride() {
  const { profile, homeVillage, L, lang, pair, toast } = useApp();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const [v, setV] = useState<VehicleCategory>((sp.get('v') as VehicleCategory) || 'auto');
  const [from, setFrom] = useState(L('വീട്', 'Home'));
  const [to, setTo] = useState('');
  const [fromPt, setFromPt] = useState<LL | null>(null);
  const [toPt, setToPt] = useState<LL | null>(null);
  const [active, setActive] = useState<'from' | 'to'>('from');
  const [locating, setLocating] = useState(false);
  const [when, setWhen] = useState<'now' | 'later'>('now');
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState('09:00');
  const only = sp.get('p') ?? '';
  // Text still filled by the app (not typed by the person): a new pin may replace it with the place's name.
  const autoText = useRef({ from: true, to: true });
  const seq = useRef({ from: 0, to: 0 });
  const hasTo = useRef(false);

  const place = (which: 'from' | 'to', p: LL, fallback?: string) => {
    (which === 'from' ? setFromPt : setToPt)(p);
    if (which === 'to') hasTo.current = true;
    else if (!hasTo.current) setActive('to'); // pick-up set: next tap sets the drop
    if (!autoText.current[which]) return;
    const setText = which === 'from' ? setFrom : setTo;
    if (fallback) setText(fallback);
    const n = ++seq.current[which];
    void placeName(p.lat, p.lng, lang).then((name) => {
      if (name && n === seq.current[which] && autoText.current[which]) setText(name);
    });
  };
  // A suggestion was chosen: its name stays as typed text, and its pin goes on the map.
  const chose = (which: 'from' | 'to', h: PlaceHit) => {
    autoText.current[which] = false;
    seq.current[which]++; // ignore a name lookup still on its way
    (which === 'from' ? setFrom : setTo)(h.name);
    place(which, { lat: h.lat, lng: h.lng });
  };
  const near = fromPt ?? myPoint(profile, homeVillage);
  const typed = (which: 'from' | 'to', text: string) => {
    autoText.current[which] = !text.trim();
    (which === 'from' ? setFrom : setTo)(text);
  };
  async function myLocation(quiet = false) {
    setLocating(true);
    try { place('from', await getPosition(), L('എന്റെ ഇപ്പോഴത്തെ സ്ഥലം', 'My current location')); }
    catch { if (!quiet) toast(L('Location കിട്ടിയില്ല. Phone-ലെ location ഓൺ ആക്കുക, അല്ലെങ്കിൽ map-ൽ തൊടുക.', "Couldn't get your location. Turn it on, or tap the map.")); }
    finally { setLocating(false); }
  }
  // Like taxi apps: start from where the phone is.
  useEffect(() => { void myLocation(true); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const dist = fromPt && toPt ? roadKm(fromPt, toPt) : null;
  const toText = to.trim() || (toPt ? L('Map-ൽ കാണിച്ച സ്ഥലം', 'Place on the map') : '');
  const go = () => {
    const q = new URLSearchParams({ v, from: from.trim(), to: toText, when, date: when === 'now' ? todayISO() : date, time: when === 'now' ? 'now' : time });
    if (fromPt) { q.set('flat', String(fromPt.lat)); q.set('flng', String(fromPt.lng)); }
    if (toPt) { q.set('tlat', String(toPt.lat)); q.set('tlng', String(toPt.lng)); }
    if (only) q.set('p', only);
    nav(`/ride/drivers?${q}`);
  };

  return (
    <Screen title={L('വാഹനം ബുക്ക് ചെയ്യുക', 'Book a vehicle')}>
      <div className="seg" role="tablist" aria-label={L('Map-ൽ ഏത് സ്ഥലം', 'Which place on the map')}>
        <button role="tab" aria-selected={active === 'from'} className={active === 'from' ? 'on' : ''} onClick={() => setActive('from')}>
          <span className="dot" style={{ flex: 'none' }} /><span>{fromPt && from ? from : L('കയറുന്ന സ്ഥലം', 'Pick-up')}</span>
        </button>
        <button role="tab" aria-selected={active === 'to'} className={active === 'to' ? 'on' : ''} onClick={() => setActive('to')}>
          <span className="dot red" style={{ flex: 'none' }} /><span>{toPt && to ? to : L('ഇറങ്ങുന്ന സ്ഥലം', 'Drop')}</span>
        </button>
      </div>
      <div style={{ position: 'relative' }}>
        <RoutePickMap from={fromPt} to={toPt} active={active} center={myPoint(profile, homeVillage)} onChange={(w, p) => place(w, p)} height={300} />
        <button type="button" className="btn sm" disabled={locating} onClick={() => myLocation()}
          style={{ position: 'absolute', right: 10, bottom: 10, zIndex: 500, boxShadow: '0 2px 8px rgba(0,0,0,.25)' }}>
          <LocateFixed size={16} aria-hidden /> {locating ? '…' : L('എന്റെ സ്ഥലം', 'My location')}
        </button>
      </div>
      <p className="muted small" style={{ margin: 0 }}>
        {active === 'from'
          ? L('🟢 കയറുന്ന സ്ഥലത്ത് map-ൽ തൊടുക (അല്ലെങ്കിൽ pin വലിച്ച് നീക്കുക)', '🟢 Tap the map where you will get in (or drag the pin)')
          : L('🏁 എങ്ങോട്ട് പോകണം — ആ സ്ഥലത്ത് map-ൽ തൊടുക', '🏁 Tap the map where you want to go')}
        {dist != null && <b style={{ color: 'var(--green-dark)' }}> · {L(`ഏകദേശം ${dist} km`, `About ${dist} km`)}</b>}
      </p>
      <div className="field">
        <label htmlFor="from"><span className="dot" /> {L('എവിടെ നിന്ന്', 'From')}</label>
        <PlaceInput id="from" value={from} near={near} onFocus={() => setActive('from')} onType={(t) => typed('from', t)} onPick={(h) => chose('from', h)} />
      </div>
      <div className="field">
        <label htmlFor="to"><span className="dot red" /> {L('എങ്ങോട്ട്', 'To')}</label>
        <PlaceInput id="to" value={to} near={near} onFocus={() => setActive('to')} onType={(t) => typed('to', t)} onPick={(h) => chose('to', h)} placeholder={L('ഉദാ: ബസ് സ്റ്റാൻഡ്, ആശുപത്രി', 'e.g. Bus stand, hospital')} />
      </div>
      <div className="grid3">
        {VEHICLE_CATS.map((c) => (
          <button key={c} className={'tile' + (v === c ? ' on' : '')} style={{ minHeight: 100, fontSize: 14 }} onClick={() => setV(c)} aria-pressed={v === c}>
            <CatIcon cat={c} size={20} />
            {pair(CAT_LABEL[c])}
          </button>
        ))}
      </div>
      <div className="chips">
        <button className={'chip' + (when === 'now' ? ' on' : '')} onClick={() => setWhen('now')}>{L('ഇപ്പോൾ', 'Now')}</button>
        <button className={'chip' + (when === 'later' ? ' on' : '')} onClick={() => setWhen('later')}>{L('പിന്നീട്', 'Later')}</button>
      </div>
      {when === 'later' && (
        <div className="row nowrap">
          <input aria-label={L('തീയതി', 'Date')} type="date" className="input" min={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} />
          <input aria-label={L('സമയം', 'Time')} type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
      )}
      <div className="spacer" />
      <button className="btn block yellow" disabled={!toText || !from.trim()} onClick={go}>{L('ഡ്രൈവർമാരെ കാണുക', 'See drivers')}</button>
    </Screen>
  );
}

export function Drivers() {
  const [sp] = useSearchParams();
  const { api, profile, village, viewIds, reachIds, L, lang, pair, toast } = useApp();
  const nav = useNavigate();
  const v = (sp.get('v') as VehicleCategory) || 'auto';
  const only = sp.get('p');
  const [list, reload, err] = useLoad(() => api.listApprovedProviders(v, reachIds), [v, reachIds.join(',')]);
  const [busy, setBusy] = useState('');
  const rows = withReach(list ?? [], village, viewIds).filter(({ p }) => !only || p.uid === only);
  const fromPt = latLng(num(sp.get('flat')), num(sp.get('flng')));
  const toPt = latLng(num(sp.get('tlat')), num(sp.get('tlng')));
  const trip = fromPt && toPt ? roadKm(fromPt, toPt) : null;

  async function request(pid: string) {
    const p = rows.find((r) => r.p.uid === pid)?.p;
    if (!p || !profile) return;
    if (p.uid === profile.uid) { toast(L('സ്വന്തം profile ബുക്ക് ചെയ്യാൻ പറ്റില്ല', "You can't book yourself")); return; }
    setBusy(pid);
    try {
      const id = await api.createBooking({
        type: 'ride', customerId: profile.uid, customerName: profile.name, customerPhone: profile.phone,
        providerId: p.uid, providerName: p.name, providerPhone: p.phone, villageId: p.villageId,
        category: v, date: sp.get('date') ?? todayISO(), slot: sp.get('time') ?? 'now', details: '',
        from: sp.get('from') ?? '', to: sp.get('to') ?? '', status: 'requested', rated: false, createdAt: Date.now(),
        ...(fromPt ? { fromLat: fromPt.lat, fromLng: fromPt.lng } : {}), ...(toPt ? { toLat: toPt.lat, toLng: toPt.lng } : {}),
      });
      nav(`/booking/${id}`, { replace: true });
    } catch {
      toast(L('Request അയയ്ക്കാൻ പറ്റിയില്ല', "Couldn't send the request"));
    } finally { setBusy(''); }
  }

  return (
    <Screen title={L(`ലഭ്യമായ ${pair(CAT_LABEL[v])}`, `Available: ${pair(CAT_LABEL[v])}`)} sub={`${sp.get('from')} → ${sp.get('to')}${trip != null ? ` · ${trip} km` : ''}`}>
      {err && <LoadError retry={reload} />}
      {!list && !err && <Loading />}
      {rows.map(({ p, dist }) => {
        const free = isFree(p);
        return (
          <div key={p.uid} className="card" style={{ opacity: free || p.imported ? 1 : 0.65 }}>
            <Link to={`/provider/${p.uid}`}><Avatar name={p.name} className="auto" /></Link>
            <span className="stack grow">
              <span className="row" style={{ gap: 6 }}><b>{p.name}</b>{p.verified && <BadgeCheck size={16} color="var(--green)" aria-label="Verified" />}</span>
              <span className="muted small">{p.vehicleNo} <StarRow value={rating(p)} count={p.ratingCount} /></span>
              <span className="small" style={{ color: free ? 'var(--green-dark)' : 'var(--muted)' }}>
                <span className={'dot' + (free ? '' : ' off')} /> <span className="num">{dist} km</span> {L('അകലെ', 'away')} · {rateText(p, lang)}
              </span>
              {trip != null && p.rateUnit === 'km' && p.rate > 0 && (
                <span className="small"><b>≈ ₹{Math.round(p.rate * trip)}</b> <span className="muted">{L(`(${trip} km യാത്ര)`, `(${trip} km trip)`)}</span></span>
              )}
            </span>
            {p.imported
              ? <a className="btn sm yellow" href={telHref(p.phone)}>{L('വിളിക്കുക', 'Call')}</a>
              : <button className="btn sm yellow" disabled={!free || busy === p.uid} onClick={() => request(p.uid)}>{L('Request', 'Request')}</button>}
          </div>
        );
      })}
      {list && rows.length === 0 && <Empty text={L('ഇപ്പോൾ ഈ വാഹനം ലഭ്യമല്ല. മറ്റൊരു വാഹനം നോക്കുക.', 'No vehicles of this type right now. Try another type.')} />}
      <p className="muted center small">{L('കൂലി ഡ്രൈവറുമായി ഉറപ്പിക്കുക. പണം നേരിട്ട് (cash / UPI).', 'Confirm the fare with the driver. Pay directly (cash / UPI).')}</p>
    </Screen>
  );
}

/** Rough minutes and road km from the driver to where they are heading now (pick-up, or the drop once the trip started). */
export function rideEta(b: Booking, now = Date.now()) {
  const car = latLng(b.liveLat, b.liveLng);
  if (!car || !b.liveAt) return null;
  const goal = b.startedAt ? latLng(b.toLat, b.toLng) : latLng(b.fromLat, b.fromLng);
  const stale = now - b.liveAt > STALE_MS;
  if (!goal) return { min: null, roadKm: null, stale };
  const rk = roadKm(car, goal);
  return { min: Math.max(1, Math.ceil((rk / SPEED_KMH) * 60)), roadKm: rk, stale };
}

/** Customer's view of a ride: pick-up, drop and the moving vehicle on a map (like taxi apps). */
export function RideLive({ b }: { b: Booking }) {
  const { L, lang } = useApp();
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 15000); return () => clearInterval(t); }, []); // refresh "x sec ago"
  const live = b.status === 'accepted';
  const car = VEH_EMOJI[b.category as VehicleCategory] ?? '🚗';
  const points = useMemo<MapPoint[]>(() => {
    const p: MapPoint[] = [];
    if (b.fromLat != null && b.fromLng != null) p.push({ lat: b.fromLat, lng: b.fromLng, kind: 'from', label: b.from, goal: !b.startedAt });
    if (b.toLat != null && b.toLng != null) p.push({ lat: b.toLat, lng: b.toLng, kind: 'to', label: b.to, goal: !!b.startedAt });
    if (live && b.liveLat != null && b.liveLng != null) p.push({ lat: b.liveLat, lng: b.liveLng, kind: 'bike', emoji: car, label: b.providerName });
    return p;
  }, [b, live, car]);
  if (!points.length) return null;
  const eta = live ? rideEta(b) : null;
  let line = '';
  if (live) {
    if (!eta) line = L(`${b.providerName}-ന്റെ location ഇതുവരെ കിട്ടിയില്ല. വാഹനം പുറപ്പെടുമ്പോൾ ഇവിടെ കാണാം.`, `No location from ${b.providerName} yet. You will see the vehicle here once they set off.`);
    else if (b.startedAt) line = eta.min != null ? L(`യാത്രയിൽ · ഏകദേശം ${eta.min} മിനിറ്റിൽ എത്തും (${eta.roadKm} km)`, `On the trip · reaching in about ${eta.min} min (${eta.roadKm} km)`) : L('യാത്രയിൽ', 'On the trip');
    else line = eta.min != null ? L(`വാഹനം ഏകദേശം ${eta.min} മിനിറ്റിൽ എത്തും (${eta.roadKm} km അകലെ)`, `Vehicle arriving in about ${eta.min} min (${eta.roadKm} km away)`) : L('വാഹനം വരുന്നു', 'The vehicle is on the way');
  }
  return (
    <div className="stack" style={{ gap: 8 }}>
      {line && (
        <div className={'notice' + (eta?.stale ? ' warn' : '')} style={{ display: 'block' }}>
          <b>{car} {line}</b>
          {eta?.stale && b.liveAt && <div className="small">{L(`അവസാന location ${timeAgo(b.liveAt, lang)} കിട്ടിയതാണ്. ഡ്രൈവറെ വിളിച്ച് ചോദിക്കുക.`, `Last location was ${timeAgo(b.liveAt, lang)}. Give the driver a call.`)}</div>}
        </div>
      )}
      <LiveMap points={points} height={320} />
      {live && b.liveAt && !eta?.stale && <p className="muted small center" style={{ margin: 0 }}>📍 {L(`Live · ${timeAgo(b.liveAt, lang)} update ചെയ്തു`, `Live · updated ${timeAgo(b.liveAt, lang)}`)}</p>}
    </div>
  );
}

const RECENT_KEY = 'gs-recent-places';
const recentPlaces = (): PlaceHit[] => { try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]'); } catch { return []; } };
const rememberPlace = (h: PlaceHit) => {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify([h, ...recentPlaces().filter((x) => x.name !== h.name || x.sub !== h.sub)].slice(0, 5))); } catch { /* storage full / off */ }
};
/** The typed letters in bold, the rest plain (like map apps). */
function Marked({ text, q }: { text: string; q: string }) {
  const i = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (i < 0) return <>{text}</>;
  return <>{text.slice(0, i)}<b>{text.slice(i, i + q.length)}</b>{text.slice(i + q.length)}</>;
}

/** Text box that suggests places while typing (only after the person types, not for text the app filled in). */
function PlaceInput({ id, value, near, placeholder, onFocus, onType, onPick }: {
  id: string; value: string; near: LL | null; placeholder?: string;
  onFocus: () => void; onType: (t: string) => void; onPick: (h: PlaceHit) => void;
}) {
  const { L } = useApp();
  const [hits, setHits] = useState<PlaceHit[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hi, setHi] = useState(-1);
  const [q, setQ] = useState(''); // what to search: set only by typing
  const nearRef = useRef(near);
  nearRef.current = near;

  useEffect(() => {
    const t = q.trim();
    if (t.length < 3) { setHits([]); setBusy(false); return; }
    const ac = new AbortController();
    setBusy(true);
    const timer = window.setTimeout(() => {
      searchPlaces(t, nearRef.current, ac.signal)
        .then((h) => { setHits(h); setHi(-1); })
        .catch(() => { if (!ac.signal.aborted) setHits([]); })
        .finally(() => { if (!ac.signal.aborted) setBusy(false); });
    }, 350);
    return () => { ac.abort(); window.clearTimeout(timer); };
  }, [q]);

  const pick = (h: PlaceHit) => { rememberPlace(h); onPick(h); setOpen(false); setHits([]); setQ(''); };
  const typing = q.trim().length >= 3;
  // Before typing (or with 1–2 letters): places picked earlier, like "recent" in map apps.
  const recent = typing ? [] : recentPlaces().filter((h) => !q.trim() || h.name.toLowerCase().includes(q.trim().toLowerCase()));
  const list = typing ? hits : recent;
  const show = open && (typing || recent.length > 0);
  return (
    <div className="ac">
      <input id={id} className="input" value={value} placeholder={placeholder} autoComplete="off"
        role="combobox" aria-expanded={show} aria-controls={`${id}-list`} aria-autocomplete="list"
        onFocus={() => { onFocus(); setOpen(true); }}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onChange={(e) => { onType(e.target.value); setQ(e.target.value); setOpen(true); }}
        onKeyDown={(e) => {
          if (!show || !list.length) return;
          if (e.key === 'ArrowDown') { e.preventDefault(); setHi((i) => (i + 1) % list.length); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((i) => (i <= 0 ? list.length - 1 : i - 1)); }
          else if (e.key === 'Enter' && list[hi]) { e.preventDefault(); pick(list[hi]); }
          else if (e.key === 'Escape') setOpen(false);
        }} />
      {show && (
        <ul id={`${id}-list`} className="ac-list" role="listbox">
          {list.map((h, i) => (
            <li key={`${h.lat},${h.lng},${i}`} role="option" aria-selected={i === hi} className={i === hi ? 'on' : ''}
              onMouseDown={(e) => { e.preventDefault(); pick(h); }}>
              {typing ? <MapPin size={18} aria-hidden className="ac-ic" /> : <Clock size={18} aria-hidden className="ac-ic" />}
              <span className="ac-txt">
                <span className="ac-name"><Marked text={h.name} q={q.trim()} /></span>
                {h.sub && <span className="ac-sub"> {h.sub}</span>}
              </span>
            </li>
          ))}
          {typing && !hits.length && <li className="muted small" aria-disabled>{busy ? L('തിരയുന്നു…', 'Searching…') : L('ഒന്നും കിട്ടിയില്ല. Map-ൽ തൊട്ട് സ്ഥലം കാണിക്കാം.', 'Nothing found. You can tap the place on the map.')}</li>}
        </ul>
      )}
    </div>
  );
}
