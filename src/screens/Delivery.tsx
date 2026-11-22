import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bike, MapPin, Navigation, Package, Phone, Store, Truck, UserCheck } from 'lucide-react';
import { useApp, useLoad } from '../lib/app';
import { CallWhatsApp, Empty, LoadError, Loading, Screen } from '../components/ui';
import { getPosition } from '../lib/geo';
import { isPlayApp } from '../lib/store';
import { sortedWards, wardLabel } from '../lib/panchayat';
import { mapsEmbed, mapsLink, prettyDate, prettyPhone, telHref, timeAgo } from '../lib/util';
import { boyActive, inMonth, type Delivery, type DeliveryBoy, type DeliveryStatus, type DeliveryVehicle, type Enquiry } from '../types';
import { FREQ_LABEL } from './Orders';
import { usePay } from './Market';

export const VEHICLE: Record<DeliveryVehicle, [string, string, string]> = {
  walk: ['നടന്ന്', 'On foot', '🚶'], cycle: ['സൈക്കിൾ', 'Cycle', '🚲'], bike: ['ബൈക്ക് / സ്കൂട്ടർ', 'Bike / scooter', '🛵'], auto: ['ഓട്ടോ', 'Auto', '🛺'], other: ['മറ്റുള്ളവ', 'Other', '🚚'],
};
export const DSTATUS: Record<DeliveryStatus, [string, string, string]> = {
  assigned: ['ഏൽപ്പിച്ചു', 'Assigned', 'badge warn'], accepted: ['സമ്മതിച്ചു', 'Accepted', 'badge'], picked: ['എടുത്തു — വഴിയിൽ', 'Picked up — on the way', 'badge'],
  delivered: ['എത്തിച്ചു', 'Delivered', 'badge grey'], rejected: ['പറ്റില്ലെന്ന് പറഞ്ഞു', 'Refused', 'badge bad'], cancelled: ['റദ്ദാക്കി', 'Cancelled', 'badge grey'],
};
const rs = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const showPhone = (p: string) => (/^\+91\d{10}$/.test(p) ? prettyPhone(p) : p);
const day = (ms: number, lang: 'ml' | 'en') => prettyDate(new Date(ms).toISOString().slice(0, 10), lang);
const sameDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString();
const dirLink = (lat?: number, lng?: number, addr?: string) =>
  lat != null && lng != null ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}` : mapsLink(`${addr ?? ''}, Kerala`);

/** Join as a delivery boy: waits for the owner's approval. */
export function DeliveryJoin() {
  const nav = useNavigate();
  const { api, profile, homeVillage, lang, L, pair, toast } = useApp();
  const [f, setF] = useState({ name: profile?.name ?? '', phone: profile?.phone ?? '', vehicle: 'bike' as DeliveryVehicle, area: '', ward: profile?.ward ?? '' });
  const [busy, setBusy] = useState(false);
  if (!profile) return null;
  const ok = f.name.trim().length >= 2 && f.phone.replace(/\D/g, '').length >= 10;
  async function save() {
    if (!profile || busy) return;
    setBusy(true);
    try {
      await api.joinDelivery({
        uid: profile.uid, name: f.name.trim(), phone: f.phone.trim(), villageId: profile.villageId, ...(f.ward ? { ward: f.ward } : {}),
        vehicle: f.vehicle, ...(f.area.trim() ? { area: f.area.trim().slice(0, 120) } : {}), available: true, status: 'pending', freeUntil: 0, paidUntil: 0, createdAt: Date.now(),
      });
      toast(L('അപേക്ഷ അയച്ചു. Admin approve ചെയ്താൽ തുടങ്ങാം.', 'Request sent. You can start once the admin approves.'));
      nav('/delivery', { replace: true });
    } catch (e) { console.error(e); toast(L('അയയ്ക്കാൻ പറ്റിയില്ല', "Couldn't send")); } finally { setBusy(false); }
  }
  return (
    <Screen title={L('ഡെലിവറി ബോയ് ആയി ചേരുക', 'Join as a delivery person')}>
      <div className="notice">{L('കടകളിൽ നിന്നും പാൽ / മുട്ട വിൽക്കുന്നവരിൽ നിന്നും സാധനം എടുത്ത് വീടുകളിൽ എത്തിക്കാം. Admin approve ചെയ്യണം. തുടക്കത്തിൽ free.', 'Pick up from shops and milk / egg sellers and deliver to homes. Needs admin approval. Starts free.')}</div>
      <label htmlFor="dn">{L('പേര്', 'Name')}</label>
      <input id="dn" className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <label htmlFor="dp">{L('ഫോൺ നമ്പർ', 'Phone number')}</label>
      <input id="dp" className="input" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
      <label>{L('വാഹനം', 'Vehicle')}</label>
      <div className="chips">{(Object.keys(VEHICLE) as DeliveryVehicle[]).map((v) => <button key={v} className={'chip' + (f.vehicle === v ? ' on' : '')} onClick={() => setF({ ...f, vehicle: v })}>{VEHICLE[v][2]} {pair([VEHICLE[v][0], VEHICLE[v][1]])}</button>)}</div>
      {(homeVillage?.wards?.length ?? 0) > 0 && (<>
        <label htmlFor="dw">{L('എന്റെ വാർഡ്', 'My ward')}</label>
        <select id="dw" className="input" value={f.ward} onChange={(e) => setF({ ...f, ward: e.target.value })}>
          <option value="">—</option>
          {sortedWards(homeVillage, lang).map((w) => <option key={w.no} value={String(w.no)}>{lang === 'ml' ? w.name : w.nameEn}</option>)}
        </select>
      </>)}
      <label htmlFor="da">{L('ഏതൊക്കെ സ്ഥലങ്ങളിൽ delivery ചെയ്യും?', 'Which areas do you cover?')}</label>
      <input id="da" className="input" maxLength={120} value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })} placeholder={L('ഉദാ: തകഴി, ചിറയകം, കരുമാടി', 'e.g. Thakazhy, Chirayakom, Karumady')} />
      <button className="btn block" disabled={busy || !ok} onClick={save}>{L('അപേക്ഷ അയയ്ക്കുക', 'Send request')}</button>
      <p className="muted small">{L('നിങ്ങളുടെ പേരും ഫോണും കടക്കാർക്ക് കാണാം. നിങ്ങൾക്ക് ഏൽപ്പിക്കുന്ന ഓർഡറിലെ വിലാസം മാത്രമേ നിങ്ങൾക്ക് കാണൂ.', 'Shops can see your name and phone. You only see the address of orders handed to you.')}</p>
    </Screen>
  );
}

/** The delivery boy's own screen: status, fee and delivery jobs. */
export function DeliveryHome() {
  const { api, profile, lang, L, pair, toast } = useApp();
  const pay = usePay();
  const play = isPlayApp();
  const [data, reload, err] = useLoad(async () => {
    if (!profile) return null;
    const [boy, jobs] = await Promise.all([api.getDeliveryBoy(profile.uid), api.listDeliveries('deliveryUid', profile.uid)]);
    // Clear a stale "busy" mark (job delivered, cancelled or moved to someone else).
    if (boy?.busyWith && !jobs.some((j) => j.id === boy.busyWith && isBusyJob(j))) {
      try { await api.saveDeliveryBoy(boy.uid, { busyWith: '' }); boy.busyWith = ''; } catch { /* ignore */ }
    }
    return { boy, jobs };
  }, [profile?.uid ?? '']);
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  if (!profile) return null;
  if (err) return <Screen title={L('ഡെലിവറി', 'Delivery')}><LoadError retry={reload} /></Screen>;
  if (!data) return <Screen title={L('ഡെലിവറി', 'Delivery')}><Loading /></Screen>;
  const b = data.boy;
  if (!b) return (
    <Screen title={L('ഡെലിവറി', 'Delivery')}>
      <Empty icon={<Truck size={28} />} text={L('നിങ്ങൾ ഇതുവരെ ഡെലിവറി ബോയ് ആയി ചേർന്നിട്ടില്ല.', "You haven't joined as a delivery person yet.")}>
        <Link className="btn" to="/delivery/join">{L('ചേരുക', 'Join')}</Link>
      </Empty>
    </Screen>
  );
  const active = boyActive(b);
  const until = Math.max(b.freeUntil, b.paidUntil);
  const jobs = data.jobs.filter((j) => filter === 'all' || !['delivered', 'rejected', 'cancelled'].includes(j.status));
  const total = data.jobs.reduce((t, j) => t + (j.deliveredCount || 0), 0);
  const monthEarn = data.jobs.reduce((t, j) => t + inMonth(j.log) * (j.deliveryFee ?? 0), 0);

  return (
    <Screen title={L('എന്റെ ഡെലിവറികൾ', 'My deliveries')}>
      {b.status === 'pending' && <div className="notice warn">{L('നിങ്ങളുടെ അപേക്ഷ Admin പരിശോധിക്കുകയാണ്. Approve ചെയ്താൽ ഇവിടെ ജോലികൾ വരും.', 'The admin is checking your request. Jobs appear here once approved.')}</div>}
      {b.status === 'suspended' && <div className="notice bad" style={{ display: 'block' }}><b>{L('നിങ്ങളുടെ account താൽക്കാലികമായി നിർത്തി വെച്ചിരിക്കുന്നു.', 'Your account is suspended.')}</b>{b.warning ? <div>{L('കാരണം', 'Reason')}: {b.warning}</div> : null}<div className="small">{L('Admin-നെ ബന്ധപ്പെടുക.', 'Please contact the admin.')}</div></div>}
      {b.status === 'removed' && <div className="notice bad">{L('നിങ്ങളെ ഡെലിവറി list-ൽ നിന്ന് മാറ്റി.', 'You have been removed from the delivery list.')}</div>}
      {b.status === 'active' && (
        <div className="card" style={{ display: 'block' }}>
          <div className="row between"><b>{VEHICLE[b.vehicle][2]} {b.name}{Date.now() - b.createdAt < 7 * 86400000 && <span className="badge warn" style={{ marginLeft: 6 }}>{L('പുതിയത്', 'New')}</span>}</b><span className={active ? 'badge' : 'badge bad'}>{active ? 'Active' : L('സമയം കഴിഞ്ഞു', 'Expired')}</span></div>
          <div className="small" style={{ margin: '4px 0' }}>
            {b.paidUntil > b.freeUntil ? L(`പണമടച്ചു — ${day(until, lang)} വരെ`, `Paid until ${day(until, lang)}`) : L(`Free — ${day(until, lang)} വരെ`, `Free until ${day(until, lang)}`)}
            {!play && ` · ${L(`ആഴ്ച ₹${pay.deliveryFee}`, `₹${pay.deliveryFee}/week`)}`}
          </div>
          <div className="small muted">{L(`ആകെ ${total} ഡെലിവറി ചെയ്തു`, `${total} deliveries done`)}</div>
          <div className="small"><b>{L(`ഈ മാസം ഡെലിവറി ചാർജ്: ${rs(monthEarn)}`, `Delivery charges this month: ${rs(monthEarn)}`)}</b></div>
          <div className="row" style={{ gap: 8, marginTop: 8 }}>
            <button className={'btn sm ' + (b.available ? '' : 'outline')} onClick={async () => { await api.saveDeliveryBoy(b.uid, { available: !b.available }); toast(L('സേവ് ചെയ്തു', 'Saved')); reload(); }}>
              {b.available ? L('ഞാൻ ഇപ്പോൾ ലഭ്യമാണ് ✓', 'Available now ✓') : L('ലഭ്യമല്ല (ഓഫ്)', 'Not available (off)')}
            </button>
            {!play && <Link className="btn sm outline" to="/pay?for=delivery">{L('ആഴ്ച fee അടയ്ക്കുക', 'Pay weekly fee')}</Link>}
          </div>
          {!active && play && <p className="small muted">{L('പുതുക്കാൻ Gramaseva admin-നെ നേരിട്ട് കാണുക.', 'Meet the Gramaseva admin to renew.')}</p>}
        </div>
      )}
      <div className="chips">
        <button className={'chip' + (filter === 'open' ? ' on' : '')} onClick={() => setFilter('open')}>{L('ചെയ്യാനുള്ളവ', 'To do')}</button>
        <button className={'chip' + (filter === 'all' ? ' on' : '')} onClick={() => setFilter('all')}>{L('എല്ലാം', 'All')}</button>
      </div>
      {jobs.map((j) => <JobCard key={j.id} j={j} boy={b} canAct={active} onChange={reload} />)}
      {jobs.length === 0 && <p className="muted">{L('ഇപ്പോൾ ജോലികളൊന്നുമില്ല. കടക്കാർ ഏൽപ്പിക്കുമ്പോൾ ഇവിടെ വരും.', 'No jobs right now. They appear here when a shop hands you an order.')}</p>}
      <p className="muted small">{pair(['കൂലി കടക്കാരനുമായോ ആവശ്യക്കാരനുമായോ നേരിട്ട് ഉറപ്പിക്കുക.', 'Agree the delivery charge directly with the shop or the customer.'])}</p>
    </Screen>
  );
}

/** A one-time job the boy has accepted and not yet delivered: he can't take another until it's done. */
const isBusyJob = (j: Delivery) => j.freq === 'once' && (j.status === 'accepted' || j.status === 'picked');

function JobCard({ j, boy, canAct, onChange }: { j: Delivery; boy: DeliveryBoy; canAct: boolean; onChange: () => void }) {
  const { api, lang, L, pair, toast } = useApp();
  const [busy, setBusy] = useState(false);
  const st = DSTATUS[j.status];
  const recurring = j.freq !== 'once';
  const doneToday = !!j.lastDeliveredAt && sameDay(j.lastDeliveredAt, Date.now());
  const closed = ['delivered', 'rejected', 'cancelled'].includes(j.status);
  const otherBusy = j.freq === 'once' && !!boy.busyWith && boy.busyWith !== j.id;
  // An accepted job can always be finished (Delivered), even if the weekly fee ran out meanwhile.
  const canFinish = boy.status === 'active' && (j.status === 'accepted' || j.status === 'picked');
  async function set(patch: Partial<Delivery>, msg: string) {
    if (busy) return;
    setBusy(true);
    try {
      await api.updateDelivery(j.id, patch);
      const next = { ...j, ...patch };
      if (isBusyJob(next)) await api.saveDeliveryBoy(boy.uid, { busyWith: j.id });
      else if (boy.busyWith === j.id) await api.saveDeliveryBoy(boy.uid, { busyWith: '' });
      toast(msg); onChange();
    }
    catch (e) { console.error(e); toast(L('പറ്റിയില്ല', "Couldn't do that")); } finally { setBusy(false); }
  }
  return (
    <div className="card" style={{ display: 'block' }}>
      <div className="row between" style={{ gap: 6 }}>
        <b><Package size={16} aria-hidden /> {j.items}{j.qty ? ` — ${j.qty}` : ''}</b>
        <span className={st[2]}>{lang === 'ml' ? st[0] : st[1]}</span>
      </div>
      <div className="row small" style={{ gap: 6, margin: '4px 0' }}>
        <span className={recurring ? 'badge' : 'badge grey'}>{pair(FREQ_LABEL[j.freq])}</span>
        {recurring && <span className="muted">{L(`${j.deliveredCount} തവണ എത്തിച്ചു`, `Delivered ${j.deliveredCount} times`)}{doneToday ? L(' · ഇന്ന് കഴിഞ്ഞു ✓', ' · done today ✓') : ''}</span>}
        <span className="muted">{timeAgo(j.updatedAt, lang)}</span>
      </div>
      <div style={{ borderLeft: '3px solid var(--green)', paddingLeft: 10, margin: '8px 0' }}>
        <div className="small muted">{L('1. എടുക്കേണ്ടത് (Pickup)', '1. Pick up from')}</div>
        <b><Store size={14} aria-hidden /> {j.shopName}</b> · <a className="link" href={telHref(j.shopPhone)}>{showPhone(j.shopPhone)}</a>
        {j.pickupAddress && <div className="small"><MapPin size={12} aria-hidden /> {j.pickupAddress}</div>}
        {(j.pickupAddress || j.pickupLat != null) && <a className="link small" href={dirLink(j.pickupLat, j.pickupLng, j.pickupAddress)} target="_blank" rel="noreferrer"><Navigation size={12} aria-hidden /> {L('വഴി കാണിക്കുക', 'Directions')}</a>}
      </div>
      <div style={{ borderLeft: '3px solid var(--orange-ink)', paddingLeft: 10, margin: '8px 0' }}>
        <div className="small muted">{L('2. എത്തിക്കേണ്ടത് (Delivery)', '2. Deliver to')}</div>
        <b>{j.customerName}</b> · <a className="link" href={telHref(j.customerPhone)}>{showPhone(j.customerPhone)}</a>
        {j.address && <div className="small"><MapPin size={12} aria-hidden /> {j.address}</div>}
        {!closed && (j.lat != null || j.address) && (
          <iframe title="map" loading="lazy" src={mapsEmbed(j.lat != null ? `${j.lat},${j.lng}` : `${j.address}, Kerala`)} style={{ width: '100%', height: 170, border: 0, borderRadius: 10, marginTop: 6 }} />
        )}
        <a className="btn sm outline block" style={{ marginTop: 6 }} href={dirLink(j.lat, j.lng, j.address)} target="_blank" rel="noreferrer"><Navigation size={16} aria-hidden /> {L('Google Maps-ൽ വഴി', 'Directions in Google Maps')}</a>
      </div>
      {j.itemsTotal != null && (
        <div className="small" style={{ background: '#fff8e1', borderRadius: 10, padding: 8, margin: '6px 0' }}>
          {recurring ? (<>
            💵 {L(`ഓരോ തവണ: സാധനം ${rs(j.itemsTotal)} + ഡെലിവറി ${rs(j.deliveryFee ?? 0)}. വാങ്ങുന്നയാൾ മാസാവസാനം കടക്കാരന് bill അടയ്ക്കും; നിങ്ങളുടെ ഡെലിവറി ചാർജ് കടക്കാരൻ തരും.`,
              `Each time: goods ${rs(j.itemsTotal)} + delivery ${rs(j.deliveryFee ?? 0)}. The customer pays the shop monthly; the shop pays you your delivery charge.`)}
            <div><b>{L(`ഈ മാസം ${inMonth(j.log)} തവണ → നിങ്ങൾക്ക് ${rs(inMonth(j.log) * (j.deliveryFee ?? 0))}`, `This month ${inMonth(j.log)} deliveries → yours ${rs(inMonth(j.log) * (j.deliveryFee ?? 0))}`)}</b></div>
          </>) : (<>
            <div>1️⃣ {L(`വാങ്ങുന്നയാളിൽ നിന്ന് വാങ്ങേണ്ടത്: `, 'Collect from the customer: ')}<b>{rs(j.itemsTotal + (j.deliveryFee ?? 0))}</b></div>
            <div>2️⃣ {L('കടക്കാരന് കൊടുക്കേണ്ടത്: ', 'Give the shop: ')}<b>{rs(j.itemsTotal)}</b></div>
            <div>3️⃣ {L('നിങ്ങൾക്ക് (ഡെലിവറി ചാർജ്): ', 'Yours (delivery charge): ')}<b>{rs(j.deliveryFee ?? 0)}</b></div>
            <div className="muted">{L('കടക്കാരൻ നേരത്തെ പണം വാങ്ങിയെങ്കിൽ ഡെലിവറി ചാർജ് മാത്രം വാങ്ങുക.', 'If the shop already took the money, collect only the delivery charge.')}</div>
          </>)}
        </div>
      )}
      {(canAct || canFinish) && !closed && (
        <div className="row" style={{ gap: 6 }}>
          {j.status === 'assigned' && (<>
            {otherBusy && <div className="notice warn small" style={{ width: '100%' }}>{L('ഇപ്പോഴുള്ള ഓർഡർ ഡെലിവർ ചെയ്ത ശേഷമേ ഇത് സമ്മതിക്കാൻ പറ്റൂ.', 'Deliver your current order first, then accept this one.')}</div>}
            <button className="btn sm" disabled={busy || otherBusy} onClick={() => set({ status: 'accepted' }, L('സമ്മതിച്ചു', 'Accepted'))}>{L('സമ്മതിക്കുക', 'Accept')}</button>
            <button className="btn sm danger" disabled={busy} onClick={() => set({ status: 'rejected' }, L('കടക്കാരനെ അറിയിച്ചു', 'The shop has been told'))}>{L('പറ്റില്ല', 'Refuse')}</button>
          </>)}
          {!recurring && j.status === 'accepted' && <button className="btn sm" disabled={busy} onClick={() => set({ status: 'picked' }, L('എടുത്തു', 'Picked up'))}>{L('സാധനം എടുത്തു', 'Picked up')}</button>}
          {!recurring && (j.status === 'accepted' || j.status === 'picked') && (
            <button className="btn sm" disabled={busy} onClick={() => set({ status: 'delivered', deliveredCount: j.deliveredCount + 1, lastDeliveredAt: Date.now(), log: [...(j.log ?? []), Date.now()] }, L('എത്തിച്ചു ✓', 'Delivered ✓'))}>{L('എത്തിച്ചു', 'Delivered')}</button>
          )}
          {recurring && (j.status === 'accepted' || j.status === 'picked') && (
            <button className="btn sm" disabled={busy || doneToday} onClick={() => set({ status: 'accepted', deliveredCount: j.deliveredCount + 1, lastDeliveredAt: Date.now(), log: [...(j.log ?? []), Date.now()] }, L('ഇന്നത്തെ ഡെലിവറി രേഖപ്പെടുത്തി', "Today's delivery recorded"))}>
              {doneToday ? L('ഇന്ന് കഴിഞ്ഞു ✓', 'Done today ✓') : L('ഇന്നത്തെ ഡെലിവറി കഴിഞ്ഞു', "Today's delivery done")}
            </button>
          )}
          {recurring && (j.status === 'accepted' || j.status === 'picked') && (
            <button className="btn sm outline" disabled={busy} onClick={() => { if (confirm(L('ഈ സ്ഥിരം ഡെലിവറി ഇനി ചെയ്യുന്നില്ലേ?', 'Stop this regular delivery?'))) void set({ status: 'rejected' }, L('നിർത്തി', 'Stopped')); }}>{L('നിർത്തുക', 'Stop')}</button>
          )}
        </div>
      )}
    </div>
  );
}

/** Shop / seller side: hand an order to a delivery boy, see who has it, change or cancel. */
export function AssignDelivery({ e, d, onChange }: { e: Enquiry; d: Delivery | undefined; onChange: () => void }) {
  const { api, profile, provider, reachIds, villages, lang, L, toast } = useApp();
  const [open, setOpen] = useState(false);
  const [pickup, setPickup] = useState<{ address: string; lat?: number; lng?: number }>(() => {
    let saved = ''; try { saved = localStorage.getItem('gs-pickup') ?? ''; } catch { /* ignore */ }
    return { address: saved || provider?.address || '', ...(provider ? { lat: provider.lat, lng: provider.lng } : {}) };
  });
  const [boys] = useLoad(() => (open ? api.listDeliveryBoys(reachIds) : Promise.resolve(null)), [open, reachIds.join(',')]);
  const [busy, setBusy] = useState('');
  if (!profile || !e.delivery) return null;
  const live = d && !['rejected', 'cancelled'].includes(d.status);
  const isBusy = (b: DeliveryBoy) => !!b.busyWith && b.busyWith !== e.id;

  async function assign(b: DeliveryBoy) {
    if (!profile || busy) return;
    setBusy(b.uid);
    try {
      const now = Date.now();
      await api.assignDelivery({
        id: e.id, enquiryId: e.id, villageId: e.villageId, shopUid: profile.uid, shopName: provider?.shopName || e.toName || profile.name, shopPhone: e.toPhone || profile.phone,
        ...(pickup.address.trim() ? { pickupAddress: pickup.address.trim().slice(0, 200) } : {}), ...(pickup.lat != null ? { pickupLat: pickup.lat, pickupLng: pickup.lng } : {}),
        customerUid: e.fromUid, customerName: e.fromName, customerPhone: e.fromPhone, ...(e.address ? { address: e.address } : {}), ...(e.lat != null ? { lat: e.lat, lng: e.lng } : {}),
        items: e.items, ...(e.qty ? { qty: e.qty } : {}), freq: e.freq, deliveryUid: b.uid, deliveryName: b.name, deliveryPhone: b.phone,
        ...(e.itemsTotal != null ? { itemsTotal: e.itemsTotal } : {}), ...(e.deliveryFee != null ? { deliveryFee: e.deliveryFee } : {}),
        status: 'assigned', deliveredCount: 0, createdAt: now, updatedAt: now,
      });
      try { if (pickup.address.trim()) localStorage.setItem('gs-pickup', pickup.address.trim()); } catch { /* ignore */ }
      if (e.status === 'new' || e.status === 'replied') await api.updateEnquiry(e.id, 'accepted');
      toast(L(`${b.name}-നെ ഏൽപ്പിച്ചു. അവരെ വിളിച്ച് ഉറപ്പാക്കുക.`, `Handed to ${b.name}. Call them to confirm.`));
      setOpen(false); onChange();
    } catch (err) { console.error(err); toast(L('ഏൽപ്പിക്കാൻ പറ്റിയില്ല — ആൾ വേറെ ഡെലിവറിയിലായിരിക്കാം', "Couldn't assign — they may be on another delivery")); } finally { setBusy(''); }
  }

  return (
    <div style={{ marginTop: 10, padding: 10, borderRadius: 12, background: '#f6f8f2' }}>
      {live && d ? (
        <div className="row between" style={{ gap: 6 }}>
          <span className="stack">
            <span className="small muted">{L('ഡെലിവറി ബോയ്', 'Delivery person')}</span>
            <b><Bike size={14} aria-hidden /> {d.deliveryName}</b>
            <span className="small"><span className={DSTATUS[d.status][2]}>{lang === 'ml' ? DSTATUS[d.status][0] : DSTATUS[d.status][1]}</span>{d.freq !== 'once' ? ` · ${L(`${d.deliveredCount} തവണ എത്തിച്ചു`, `${d.deliveredCount} deliveries`)}` : ''}</span>
          </span>
          <span className="row" style={{ gap: 6 }}>
            <a className="btn sm" href={telHref(d.deliveryPhone)} aria-label={L('വിളിക്കുക', 'Call')}><Phone size={16} /></a>
            {d.status !== 'delivered' && <button className="btn sm outline" onClick={() => setOpen(!open)}>{L('മാറ്റുക', 'Change')}</button>}
            {d.status !== 'delivered' && <button className="btn sm danger" onClick={async () => { if (confirm(L('ഡെലിവറി റദ്ദാക്കണോ?', 'Cancel this delivery?'))) { await api.updateDelivery(d.id, { status: 'cancelled' }); onChange(); } }}>{L('റദ്ദാക്കുക', 'Cancel')}</button>}
          </span>
        </div>
      ) : (<>
        {d?.status === 'rejected' && <div className="notice warn small">{L(`${d.deliveryName} പറ്റില്ലെന്ന് പറഞ്ഞു. മറ്റൊരാളെ ഏൽപ്പിക്കുക.`, `${d.deliveryName} refused. Hand it to someone else.`)}</div>}
        <button className="btn sm outline block" onClick={() => setOpen(!open)}><Truck size={16} aria-hidden /> {L('ഡെലിവറി ബോയിനെ ഏൽപ്പിക്കുക (വേണമെങ്കിൽ)', 'Hand to a delivery person (optional)')}</button>
      </>)}
      {open && (
        <div className="stack" style={{ gap: 8, marginTop: 8 }}>
          <label className="small" htmlFor={`pu-${e.id}`}>{L('സാധനം എടുക്കേണ്ട സ്ഥലം (നിങ്ങളുടെ കട / വീട്)', 'Pick-up place (your shop / home)')}</label>
          <input id={`pu-${e.id}`} className="input" value={pickup.address} onChange={(ev) => setPickup({ ...pickup, address: ev.target.value })} placeholder={L('ഉദാ: ശ്രീ സ്റ്റോഴ്സ്, തകഴി ജംഗ്ഷൻ', 'e.g. Sree Stores, Thakazhy Jn')} />
          <button className="btn sm outline" onClick={async () => { try { const p = await getPosition(); setPickup({ ...pickup, lat: p.lat, lng: p.lng }); toast(L('Location ചേർത്തു', 'Location added')); } catch { toast(L('Location കിട്ടിയില്ല', "Couldn't get location")); } }}>
            <MapPin size={14} aria-hidden /> {pickup.lat != null ? L('Location ചേർത്തിട്ടുണ്ട് ✓ (വീണ്ടും എടുക്കുക)', 'Location added ✓ (take again)') : L('📍 ഇപ്പോഴത്തെ location ചേർക്കുക', '📍 Add my current location')}
          </button>
          {!boys && <Loading />}
          {boys && boys.filter((b) => boyActive(b) && b.uid !== profile.uid).length === 0 && <p className="muted small">{L('ഇപ്പോൾ ലഭ്യമായ ഡെലിവറി ബോയ്സ് ഇല്ല.', 'No delivery people available right now.')}</p>}
          {boys?.filter((b) => boyActive(b) && b.uid !== profile.uid).sort((a, b) => Number(isBusy(a)) - Number(isBusy(b)) || Number(b.available) - Number(a.available)).map((b) => (
            <div key={b.uid} className="row nowrap" style={{ gap: 8, background: '#fff', borderRadius: 10, padding: 8, opacity: b.available && !isBusy(b) ? 1 : 0.6 }}>
              <span style={{ fontSize: 22 }}>{VEHICLE[b.vehicle][2]}</span>
              <span className="stack grow" style={{ minWidth: 0 }}>
                <b>{b.name}</b>
                <span className="small muted">{isBusy(b) ? <span className="badge warn">{L('തിരക്കിൽ — വേറെ ഡെലിവറിയിൽ', 'Busy — on another delivery')}</span> : b.available ? L('ലഭ്യം', 'Available') : L('ഇപ്പോൾ ഓഫ്', 'Off now')}{b.ward ? ` · ${wardLabel(villages.find((v) => v.id === b.villageId), b.ward, lang)}` : ''}{b.area ? ` · ${b.area}` : ''}</span>
              </span>
              <a className="btn sm outline" href={telHref(b.phone)} aria-label={L('വിളിക്കുക', 'Call')}><Phone size={16} /></a>
              <button className="btn sm" disabled={!!busy || isBusy(b)} onClick={() => assign(b)}>{L('ഏൽപ്പിക്കുക', 'Assign')}</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Customer side: who is bringing the order. */
export function DeliveryInfo({ d }: { d: Delivery | undefined }) {
  const { lang, L } = useApp();
  if (!d || ['cancelled', 'rejected'].includes(d.status)) return null;
  return (
    <div className="small" style={{ marginTop: 8, padding: 8, borderRadius: 10, background: '#fff8e1' }}>
      <Truck size={14} aria-hidden /> {L('ഡെലിവറി', 'Delivery')}: <b>{d.deliveryName}</b> · <a className="link" href={telHref(d.deliveryPhone)}>{showPhone(d.deliveryPhone)}</a> · <span className={DSTATUS[d.status][2]}>{lang === 'ml' ? DSTATUS[d.status][0] : DSTATUS[d.status][1]}</span>
    </div>
  );
}

/** All active delivery people in the panchayat (for shops and sellers to call). */
export function DeliveryBoys() {
  const { api, reachIds, villages, lang, L, pair } = useApp();
  const [list, reload, err] = useLoad(() => api.listDeliveryBoys(reachIds), [reachIds.join(',')]);
  const rows = (list ?? []).filter((b) => boyActive(b)).sort((a, b) => Number(b.available) - Number(a.available));
  return (
    <Screen title={L('ഡെലിവറി ബോയ്സ്', 'Delivery people')} right={<Link to="/delivery/join" className="iconbtn" aria-label={L('ചേരുക', 'Join')}><UserCheck size={22} /></Link>}>
      <p className="muted small">{L('ഓർഡർ വീട്ടിൽ എത്തിക്കാൻ ഇവരെ വിളിക്കാം. "ഓർഡറുകൾ" പേജിൽ നിന്ന് നേരിട്ട് ഏൽപ്പിക്കാനും പറ്റും.', 'Call them to deliver orders. You can also hand orders to them from the Orders page.')}</p>
      {err && <LoadError retry={reload} />}
      {!list && !err && <Loading />}
      {rows.map((b) => (
        <div key={b.uid} className="card" style={{ display: 'block', opacity: b.available ? 1 : 0.7 }}>
          <div className="row between"><b>{VEHICLE[b.vehicle][2]} {b.name}{Date.now() - b.createdAt < 7 * 86400000 && <span className="badge warn" style={{ marginLeft: 6 }}>{L('പുതിയത്', 'New')}</span>}</b><span className={b.available ? 'badge' : 'badge grey'}>{b.available ? L('ലഭ്യം', 'Available') : L('ഓഫ്', 'Off')}</span></div>
          <div className="small muted">{pair([VEHICLE[b.vehicle][0], VEHICLE[b.vehicle][1]])}{b.ward ? ` · ${wardLabel(villages.find((v) => v.id === b.villageId), b.ward, lang)}` : ''}{b.area ? ` · ${b.area}` : ''}</div>
          <div className="spacer" />
          <CallWhatsApp phone={b.phone} text={L('നമസ്കാരം, ഗ്രാമസേവയിൽ നിന്നാണ്. ഒരു delivery ഉണ്ട്.', 'Hello, from Gramaseva. I have a delivery.')} />
        </div>
      ))}
      {list && rows.length === 0 && <Empty icon={<Truck size={28} />} text={L('ഇതുവരെ ഡെലിവറി ബോയ്സ് ഇല്ല.', 'No delivery people yet.')}><Link className="btn" to="/delivery/join">{L('ഞാൻ ചേരാം', "I'll join")}</Link></Empty>}
    </Screen>
  );
}

/** Home card for delivery people: open jobs. */
export function DeliveryCard() {
  const { api, profile, L } = useApp();
  const [d] = useLoad(async () => {
    if (!profile) return null;
    const boy = await api.getDeliveryBoy(profile.uid);
    if (!boy) return null;
    const jobs = await api.listDeliveries('deliveryUid', profile.uid);
    return { boy, open: jobs.filter((j) => !['delivered', 'rejected', 'cancelled'].includes(j.status)).length, fresh: jobs.filter((j) => j.status === 'assigned').length };
  }, [profile?.uid ?? '']);
  if (!d) return null;
  return (
    <Link to="/delivery" className="card" style={d.fresh ? { borderColor: 'var(--orange-ink)', background: '#fff8e1' } : undefined}>
      <Truck size={26} color="var(--green)" aria-hidden />
      <span className="grow stack">
        <b>{L('എന്റെ ഡെലിവറികൾ', 'My deliveries')}</b>
        <span className="muted small">{d.boy.status === 'pending' ? L('Approval കാത്തിരിക്കുന്നു', 'Waiting for approval') : d.boy.status === 'suspended' ? L('Account നിർത്തി വെച്ചിരിക്കുന്നു', 'Account suspended')
          : d.fresh ? L(`${d.fresh} പുതിയ ജോലി — സമ്മതിക്കുക`, `${d.fresh} new — please accept`) : L(`${d.open} ജോലികൾ ചെയ്യാനുണ്ട്`, `${d.open} jobs to do`)}</span>
      </span>
      {d.fresh > 0 && <span className="badge warn">{d.fresh}</span>}
    </Link>
  );
}
