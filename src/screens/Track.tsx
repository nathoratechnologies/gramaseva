// Live delivery tracking (like food-delivery apps): the customer and the shop see where the delivery person is.
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Bike, House, Navigation, Phone, Store } from 'lucide-react';
import { useApp } from '../lib/app';
import { Empty, Loading, Screen } from '../components/ui';
import { LiveMap, type MapPoint } from '../components/LazyMap';
import { km, prettyPhone, telHref, timeAgo } from '../lib/util';
import type { Delivery } from '../types';
import { DSTATUS } from './Delivery';

const ROAD = 1.3; // roads are ~30% longer than a straight line
const SPEED_KMH = 20; // village roads on a bike / scooter
const STALE_MS = 3 * 60000;

/** Rough time left and road distance. null = no live position yet. */
export function etaOf(d: Delivery, now = Date.now()) {
  if (d.liveLat == null || d.liveLng == null || !d.liveAt) return null;
  const bike = { lat: d.liveLat, lng: d.liveLng };
  const home = d.lat != null && d.lng != null ? { lat: d.lat, lng: d.lng } : null;
  const shop = d.pickupLat != null && d.pickupLng != null ? { lat: d.pickupLat, lng: d.pickupLng } : null;
  let straight: number | null = null;
  let extraMin = 1;
  if (d.status === 'picked' && home) straight = km(bike, home);
  else if (d.status === 'accepted' && shop && home) { straight = km(bike, shop) + km(shop, home); extraMin = 5; } // time at the shop
  else if (d.status === 'accepted' && shop) straight = km(bike, shop);
  if (straight == null) return { min: null, roadKm: null, stale: now - d.liveAt > STALE_MS };
  const roadKm = Math.round(straight * ROAD * 10) / 10;
  return { min: Math.max(1, Math.ceil((roadKm / SPEED_KMH) * 60 + extraMin)), roadKm, stale: now - d.liveAt > STALE_MS };
}

const STEPS: Delivery['status'][] = ['assigned', 'accepted', 'picked', 'delivered'];

/** Home card while one of my orders is on its way: a small animated road from the shop to my house. */
export function LiveOrderCard() {
  const { api, profile, L } = useApp();
  const [d, setD] = useState<Delivery | null>(null);
  useEffect(() => {
    if (!profile) return;
    let alive = true;
    api.listDeliveries('customerUid', profile.uid)
      .then((list) => { if (alive) setD(list.find((x) => x.status === 'accepted' || x.status === 'picked') ?? null); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [api, profile]);
  if (!d) return null;
  const eta = etaOf(d);
  const sub = eta?.min != null
    ? L(`ഏകദേശം ${eta.min} മിനിറ്റിൽ എത്തും${eta.roadKm != null ? ` · ${eta.roadKm} km` : ''}`, `Arriving in about ${eta.min} min${eta.roadKm != null ? ` · ${eta.roadKm} km` : ''}`)
    : d.status === 'picked' ? L(`${d.deliveryName} സാധനവുമായി വഴിയിൽ`, `${d.deliveryName} is on the way`) : L(`${d.deliveryName} കടയിലേക്ക് പോകുന്നു`, `${d.deliveryName} is going to the shop`);
  return (
    <Link to={`/track/${d.id}`} className="livecard">
      <span className="row nowrap" style={{ gap: 8 }}>
        <span className="pulse" aria-hidden />
        <b className="grow" style={{ fontSize: 15 }}>{L('നിങ്ങളുടെ ഓർഡർ വരുന്നു', 'Your order is on the way')}</b>
        <b className="small" style={{ color: 'var(--green)' }}>Live ›</b>
      </span>
      <span className="muted small">{sub}</span>
      <span className="liveroad" aria-hidden style={{ display: 'block' }}>
        <span className="line" />
        <span className="end" style={{ left: 0, background: '#f3e5f5', color: '#6a1b9a' }}><Store size={16} /></span>
        <span className="bikeic"><Bike size={18} /></span>
        <span className="end" style={{ right: 0, background: 'var(--green-soft)', color: 'var(--green)' }}><House size={16} /></span>
      </span>
    </Link>
  );
}

export function TrackDelivery() {
  const { id = '' } = useParams();
  const { api, profile, lang, L } = useApp();
  const [d, setD] = useState<Delivery | null | undefined>(undefined);
  const [, tick] = useState(0);
  useEffect(() => api.watchDelivery(id, setD), [api, id]);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 15000); return () => clearInterval(t); }, []); // refresh "x sec ago"

  const points = useMemo<MapPoint[]>(() => {
    if (!d) return [];
    const p: MapPoint[] = [];
    if (d.pickupLat != null && d.pickupLng != null) p.push({ lat: d.pickupLat, lng: d.pickupLng, kind: 'shop', label: d.shopName });
    if (d.lat != null && d.lng != null) p.push({ lat: d.lat, lng: d.lng, kind: 'home', label: d.customerName });
    const live = d.status === 'accepted' || d.status === 'picked';
    if (live && d.liveLat != null && d.liveLng != null) p.push({ lat: d.liveLat, lng: d.liveLng, kind: 'bike', label: d.deliveryName });
    return p;
  }, [d]);

  if (d === undefined) return <Screen title={L('ഡെലിവറി ട്രാക്ക്', 'Track delivery')}><Loading /></Screen>;
  if (d === null) return <Screen title={L('ഡെലിവറി ട്രാക്ക്', 'Track delivery')}><Empty text={L('ഈ ഡെലിവറി കാണാൻ പറ്റിയില്ല.', "Couldn't open this delivery.")} /></Screen>;

  const st = DSTATUS[d.status];
  const step = STEPS.indexOf(d.status);
  const eta = etaOf(d);
  const live = d.status === 'accepted' || d.status === 'picked';
  const iAmShop = profile?.uid === d.shopUid;

  let headline: string;
  if (d.status === 'delivered') headline = L('സാധനം എത്തിച്ചു ✓', 'Delivered ✓');
  else if (d.status === 'cancelled' || d.status === 'rejected') headline = L('ഈ ഡെലിവറി ഇപ്പോൾ നടക്കുന്നില്ല', 'This delivery is not running now');
  else if (d.status === 'assigned') headline = L(`${d.deliveryName} സമ്മതിക്കാൻ കാത്തിരിക്കുന്നു`, `Waiting for ${d.deliveryName} to accept`);
  else if (!eta) headline = L(`${d.deliveryName}-ന്റെ location ഇതുവരെ കിട്ടിയില്ല`, `No location from ${d.deliveryName} yet`);
  else if (eta.min != null) headline = d.status === 'picked'
    ? L(`ഏകദേശം ${eta.min} മിനിറ്റിൽ എത്തും`, `Arriving in about ${eta.min} min`)
    : L(`കടയിലേക്ക് പോകുന്നു · ഏകദേശം ${eta.min} മിനിറ്റിൽ എത്തും`, `Going to the shop · about ${eta.min} min`);
  else headline = d.status === 'picked' ? L('സാധനവുമായി വഴിയിൽ', 'On the way with your order') : L('കടയിലേക്ക് പോകുന്നു', 'Going to the shop');

  return (
    <Screen title={L('ഡെലിവറി ട്രാക്ക്', 'Track delivery')}>
      <div className="card col" style={{ gap: 6 }}>
        <span className={st[2]} style={{ alignSelf: 'flex-start' }}>{lang === 'ml' ? st[0] : st[1]}</span>
        <b style={{ fontSize: 19 }}>{headline}</b>
        {live && eta?.roadKm != null && <span className="muted small">{L(`ഏകദേശം ${eta.roadKm} km ദൂരം`, `About ${eta.roadKm} km away`)} · {L('ട്രാഫിക് അനുസരിച്ച് മാറാം', 'may change with traffic')}</span>}
        <div className="track-steps" aria-hidden>{STEPS.map((s, i) => <span key={s} className={i <= step ? 'on' : ''} />)}</div>
        <span className="row small muted" style={{ justifyContent: 'space-between' }}>
          <span>{L('ഏൽപ്പിച്ചു', 'Assigned')}</span><span>{L('സമ്മതിച്ചു', 'Accepted')}</span><span>{L('എടുത്തു', 'Picked up')}</span><span>{L('എത്തിച്ചു', 'Delivered')}</span>
        </span>
      </div>

      {live && eta?.stale && (
        <div className="notice warn">{L(`അവസാന location ${timeAgo(d.liveAt!, lang)} കിട്ടിയതാണ്. ഡെലിവറി ബോയിയുടെ ഫോണിൽ app അടച്ചിരിക്കാം — വിളിച്ച് ചോദിക്കുക.`, `Last location was ${timeAgo(d.liveAt!, lang)}. The delivery person's app may be closed — give them a call.`)}</div>
      )}

      {points.length > 0
        ? <LiveMap points={points} height={360} />
        : <div className="notice">{L('Map കാണിക്കാൻ location ഇല്ല. ഓർഡർ ചെയ്യുമ്പോൾ "വീടിന്റെ location" ചേർത്താൽ ഇവിടെ map വരും.', 'No locations to show on a map. Add your home location when ordering to see the map here.')}</div>}
      {live && d.liveAt && !eta?.stale && <p className="muted small center">🛵 {L(`Live · ${timeAgo(d.liveAt, lang)} update ചെയ്തു`, `Live · updated ${timeAgo(d.liveAt, lang)}`)}</p>}

      <div className="card">
        <span className="stack grow">
          <span className="muted small">{L('ഡെലിവറി', 'Delivery person')}</span>
          <b>🛵 {d.deliveryName}</b>
          <span className="small num">{prettyPhone(d.deliveryPhone)}</span>
        </span>
        <a className="btn sm" href={telHref(d.deliveryPhone)} aria-label={L('വിളിക്കുക', 'Call')}><Phone size={18} /></a>
      </div>
      <div className="card">
        <span className="stack grow">
          <span className="muted small">{iAmShop ? L('ആവശ്യക്കാരൻ', 'Customer') : L('കട', 'Shop')}</span>
          <b>{iAmShop ? d.customerName : d.shopName}</b>
          <span className="small">{d.items}{d.qty ? ` — ${d.qty}` : ''}</span>
        </span>
        <a className="btn sm outline" href={telHref(iAmShop ? d.customerPhone : d.shopPhone)} aria-label={L('വിളിക്കുക', 'Call')}><Phone size={18} /></a>
      </div>
      {live && d.liveLat != null && (
        <a className="btn block outline" href={`https://www.google.com/maps/search/?api=1&query=${d.liveLat},${d.liveLng}`} target="_blank" rel="noreferrer">
          <Navigation size={18} aria-hidden /> {L('Google Maps-ൽ തുറക്കുക', 'Open in Google Maps')}
        </a>
      )}
      <Link className="link center" to={iAmShop ? '/orders' : '/orders?tab=sent'}>{L('ഓർഡറുകളിലേക്ക്', 'Back to orders')}</Link>
    </Screen>
  );
}
