import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarClock, MapPin, MessageCircle, Phone, ShoppingCart, Truck } from 'lucide-react';
import { useApp, useLoad } from '../lib/app';
import { Empty, LoadError, Loading, Screen } from '../components/ui';
import { prettyPhone, telHref, timeAgo, waHref } from '../lib/util';
import { ORDER_FREQS, inMonth, type Delivery, type Enquiry, type EnquiryStatus, type OrderFreq } from '../types';
import { AssignDelivery, DeliveryInfo } from './Delivery';
import { getPosition } from '../lib/geo';

export const FREQ_LABEL: Record<OrderFreq, [string, string]> = {
  once: ['ഒരു തവണ', 'One time'], daily: ['ദിവസവും', 'Daily'], weekly: ['ആഴ്ചതോറും', 'Weekly'], monthly: ['മാസത്തിൽ', 'Monthly'],
};
const STATUS_LABEL: Record<EnquiryStatus, [string, string, string]> = {
  new: ['പുതിയത്', 'New', 'badge warn'], replied: ['മറുപടി നൽകി', 'Replied', 'badge'], accepted: ['ഉറപ്പിച്ചു', 'Accepted', 'badge'],
  declined: ['പറ്റില്ല', 'Declined', 'badge bad'], done: ['കഴിഞ്ഞു', 'Done', 'badge grey'], cancelled: ['റദ്ദാക്കി', 'Cancelled', 'badge grey'],
};
const showPhone = (p: string) => (/^\+91\d{10}$/.test(p) ? prettyPhone(p) : p);
const ADDR_KEY = 'gs-last-address';

/** "Order / enquire" button for a shop or a market item. Hidden for entries added from Excel (no app account to receive it). */
export function OrderButton({ to, kind, listingId, label }: { to: string; kind: 'shop' | 'listing'; listingId?: string; label?: string }) {
  const { profile, L } = useApp();
  if (!profile || profile.uid === to || to.startsWith('imp_')) return null;
  return (
    <Link className="btn block outline" to={`/order/new?to=${encodeURIComponent(to)}&kind=${kind}${listingId ? `&id=${encodeURIComponent(listingId)}` : ''}`}>
      <ShoppingCart size={18} aria-hidden /> {label ?? L('ഓർഡർ / അന്വേഷണം അയയ്ക്കുക', 'Send order / enquiry')}
    </Link>
  );
}

export function OrderForm() {
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const { api, profile, L, pair, toast } = useApp();
  const to = sp.get('to') ?? '';
  const kind = sp.get('kind') === 'listing' ? 'listing' : 'shop';
  const listingId = sp.get('id') ?? '';
  const [target] = useLoad(async () => {
    if (kind === 'listing') {
      const l = (await api.listMyListings(to)).find((x) => x.id === listingId);
      return l ? { name: l.sellerName, phone: l.phone, villageId: l.villageId, title: l.title, daily: l.category === 'milk' || l.category === 'egg' } : null;
    }
    const p = await api.getProvider(to);
    return p ? { name: p.shopName || p.name, phone: p.phone, villageId: p.villageId, title: '', daily: false } : null;
  }, [to, listingId]);
  const [f, setF] = useState<{ items: string; qty: string; freq: OrderFreq | ''; delivery: boolean; address: string; phone: string; note: string }>(() => ({
    items: '', qty: '', freq: '', delivery: true, address: (() => { try { return localStorage.getItem(ADDR_KEY) ?? ''; } catch { return ''; } })(), phone: profile?.phone ?? '', note: '',
  }));
  const [busy, setBusy] = useState(false);
  const [loc, setLoc] = useState<{ lat: number; lng: number } | null>(null);
  if (!profile) return null;
  if (target === undefined) return <Screen title={L('ഓർഡർ', 'Order')}><Loading /></Screen>;
  if (target === null) return <Screen title={L('ഓർഡർ', 'Order')}><Empty text={L('ഈ കട / സാധനം ഇപ്പോൾ ലഭ്യമല്ല.', 'This shop / item is not available now.')} /></Screen>;
  const items = f.items || target.title;
  const freq: OrderFreq = f.freq || (target.daily ? 'daily' : 'once');
  const ok = items.trim().length >= 2 && (!f.delivery || f.address.trim().length >= 5) && f.phone.replace(/\D/g, '').length >= 10;

  async function send() {
    if (!profile || !target || busy) return;
    setBusy(true);
    try {
      const now = Date.now();
      await api.createEnquiry({
        villageId: target.villageId, toUid: to, toName: target.name, toPhone: target.phone, kind,
        ...(kind === 'listing' ? { listingId, listingTitle: target.title } : {}),
        fromUid: profile.uid, fromName: profile.name, fromPhone: f.phone.trim(),
        items: items.trim().slice(0, 300), ...(f.qty.trim() ? { qty: f.qty.trim().slice(0, 60) } : {}), freq, delivery: f.delivery,
        ...(f.delivery && f.address.trim() ? { address: f.address.trim().slice(0, 300) } : {}), ...(f.delivery && loc ? { lat: loc.lat, lng: loc.lng } : {}), ...(f.note.trim() ? { note: f.note.trim().slice(0, 300) } : {}),
        status: 'new', replies: [], createdAt: now, updatedAt: now,
      });
      try { if (f.address.trim()) localStorage.setItem(ADDR_KEY, f.address.trim()); } catch { /* ignore */ }
      toast(L('അയച്ചു! മറുപടി "എന്റെ ഓർഡറുകൾ"-ൽ കാണാം.', 'Sent! See the reply in "My orders".'));
      nav('/orders?tab=sent', { replace: true });
    } catch (e) { console.error(e); toast(L('അയയ്ക്കാൻ പറ്റിയില്ല', "Couldn't send")); } finally { setBusy(false); }
  }

  return (
    <Screen title={L('ഓർഡർ / അന്വേഷണം', 'Order / enquiry')} sub={target.name}>
      <label htmlFor="oi">{L('എന്താണ് വേണ്ടത്?', 'What do you need?')}</label>
      <textarea id="oi" className="input" rows={2} maxLength={300} value={items} onChange={(e) => setF({ ...f, items: e.target.value })} placeholder={L('ഉദാ: പശുവിൻ പാൽ / 1 കിലോ പഞ്ചസാര, 2 സോപ്പ്', 'e.g. Cow milk / 1 kg sugar, 2 soaps')} />
      <label htmlFor="oq">{L('എത്ര?', 'How much?')}</label>
      <input id="oq" className="input" maxLength={60} value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} placeholder={L('ഉദാ: 1 ലിറ്റർ / 2 ഡസൻ', 'e.g. 1 litre / 2 dozen')} />
      <label>{L('എപ്പോഴൊക്കെ വേണം?', 'How often?')}</label>
      <div className="chips">{ORDER_FREQS.map((x) => <button key={x} className={'chip' + (freq === x ? ' on' : '')} onClick={() => setF({ ...f, freq: x })}>{pair(FREQ_LABEL[x])}</button>)}</div>
      <label>{L('വീട്ടിൽ എത്തിച്ചു തരണോ?', 'Home delivery?')}</label>
      <div className="chips">
        <button className={'chip' + (f.delivery ? ' on' : '')} onClick={() => setF({ ...f, delivery: true })}><Truck size={14} aria-hidden /> {L('വേണം', 'Yes, deliver')}</button>
        <button className={'chip' + (!f.delivery ? ' on' : '')} onClick={() => setF({ ...f, delivery: false })}>{L('ഞാൻ വന്ന് വാങ്ങാം', "I'll pick it up")}</button>
      </div>
      {f.delivery && (<>
        <label htmlFor="oa">{L('വിലാസം (വീട്ടുപേര്, സ്ഥലം, അടയാളം)', 'Address (house name, place, landmark)')}</label>
        <textarea id="oa" className="input" rows={2} maxLength={300} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
        <button className="btn outline" onClick={async () => { try { setLoc(await getPosition()); toast(L('Location ചേർത്തു', 'Location added')); } catch { toast(L('Location കിട്ടിയില്ല. Phone-ലെ location ഓൺ ആക്കുക.', "Couldn't get location. Turn on location on your phone.")); } }}>
          <MapPin size={16} aria-hidden /> {loc ? L('വീടിന്റെ location ചേർത്തു ✓', 'Home location added ✓') : L('📍 എന്റെ വീടിന്റെ location ചേർക്കുക (map-ൽ കാണിക്കാൻ)', '📍 Add my home location (for the map)')}
        </button>
      </>)}
      <label htmlFor="op">{L('ഫോൺ നമ്പർ', 'Phone number')}</label>
      <input id="op" className="input" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
      <label htmlFor="on">{L('കുറിപ്പ് (വേണമെങ്കിൽ)', 'Note (optional)')}</label>
      <input id="on" className="input" maxLength={300} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder={L('ഉദാ: രാവിലെ 7-ന് മുൻപ്', 'e.g. before 7 am')} />
      <button className="btn block" disabled={busy || !ok} onClick={send}>{L('അയയ്ക്കുക', 'Send')}</button>
      <p className="muted small">{L('നിങ്ങളുടെ പേരും ഫോണും വിലാസവും ഈ കടക്കാരന് / വിൽപ്പനക്കാരന് മാത്രം കാണാം. പണം നേരിട്ട് (cash / UPI) കൊടുക്കുക.', 'Only this shop / seller sees your name, phone and address. Pay them directly (cash / UPI).')}</p>
    </Screen>
  );
}

/** Orders received (shop owners / sellers) and orders sent (customers). */
export function Orders() {
  const [sp, setSp] = useSearchParams();
  const { api, profile, L, pair } = useApp();
  const tab = sp.get('tab') === 'sent' ? 'sent' : 'got';
  const [freq, setFreq] = useState<OrderFreq | ''>('');
  const [open, setOpen] = useState(true);
  const [data, reload, err] = useLoad(async () => {
    if (!profile) return null;
    const [got, sent, asShop, asCustomer] = await Promise.all([api.listEnquiriesTo(profile.uid), api.listEnquiriesFrom(profile.uid),
      api.listDeliveries('shopUid', profile.uid), api.listDeliveries('customerUid', profile.uid)]);
    return { got, sent, deliveries: new Map([...asShop, ...asCustomer].map((d) => [d.id, d])) };
  }, [profile?.uid ?? '']);
  if (!profile) return null;
  const list = (data?.[tab] ?? []).filter((e) => (!freq || e.freq === freq) && (!open || !['done', 'declined', 'cancelled'].includes(e.status)));
  const newCount = data?.got.filter((e) => e.status === 'new').length ?? 0;
  const regular = (data?.got ?? []).filter((e) => e.status === 'accepted' && e.freq !== 'once');

  return (
    <Screen title={L('ഓർഡറുകൾ / അന്വേഷണങ്ങൾ', 'Orders & enquiries')}>
      <div className="chips">
        <button className={'chip' + (tab === 'got' ? ' on' : '')} onClick={() => setSp({ tab: 'got' }, { replace: true })}>{L('എനിക്ക് വന്നത്', 'Received')}{newCount ? ` (${newCount})` : ''}</button>
        <button className={'chip' + (tab === 'sent' ? ' on' : '')} onClick={() => setSp({ tab: 'sent' }, { replace: true })}>{L('ഞാൻ അയച്ചത്', 'Sent')}</button>
      </div>
      {tab === 'got' && regular.length > 0 && (
        <div className="notice" style={{ display: 'block' }}>
          <CalendarClock size={16} aria-hidden /> <b>{L('സ്ഥിരം ഓർഡറുകൾ', 'Regular orders')}:</b>{' '}
          {ORDER_FREQS.filter((x) => x !== 'once').map((x) => { const n = regular.filter((e) => e.freq === x).length; return n ? `${pair(FREQ_LABEL[x])} ${n}` : ''; }).filter(Boolean).join(' · ')}
        </div>
      )}
      <div className="chips">
        <button className={'chip' + (!freq ? ' on' : '')} onClick={() => setFreq('')}>{L('എല്ലാം', 'All')}</button>
        {ORDER_FREQS.map((x) => <button key={x} className={'chip' + (freq === x ? ' on' : '')} onClick={() => setFreq(x)}>{pair(FREQ_LABEL[x])}</button>)}
      </div>
      <label className="row small" style={{ gap: 6 }}><input type="checkbox" checked={open} onChange={(e) => setOpen(e.target.checked)} /> {L('കഴിഞ്ഞവ മറയ്ക്കുക', 'Hide finished')}</label>
      {err && <LoadError retry={reload} />}
      {!data && !err && <Loading />}
      {tab === 'got' && <Link to="/delivery/boys" className="link small">🛵 {L('ഡെലിവറി ബോയ്സിനെ കാണുക / വിളിക്കുക', 'See / call delivery people')}</Link>}
      {list.map((e) => <EnquiryCard key={e.id} e={e} mine={tab === 'got'} d={data?.deliveries.get(e.id)} onChange={reload} />)}
      {data && list.length === 0 && (
        <Empty icon={<ShoppingCart size={28} />} text={tab === 'got'
          ? L('ഇതുവരെ ഓർഡറുകൾ ഒന്നും വന്നിട്ടില്ല.', 'No orders yet.')
          : L('നിങ്ങൾ ഇതുവരെ ഓർഡർ അയച്ചിട്ടില്ല. കടകളിലോ "വാങ്ങാം · വിൽക്കാം" ഭാഗത്തോ ഓർഡർ ചെയ്യാം.', "You haven't sent any orders. Order from Shops or Buy · Sell.")}>
          {tab === 'sent' && <Link to="/market" className="btn">{L('വാങ്ങാം · വിൽക്കാം', 'Buy · Sell')}</Link>}
        </Empty>
      )}
    </Screen>
  );
}

function EnquiryCard({ e, mine, d, onChange }: { e: Enquiry; mine: boolean; d?: Delivery; onChange: () => void }) {
  const { api, profile, lang, L, pair, toast } = useApp();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const other = mine ? { name: e.fromName, phone: e.fromPhone } : { name: e.toName, phone: e.toPhone };
  const st = STATUS_LABEL[e.status];
  const closed = ['done', 'declined', 'cancelled'].includes(e.status);

  async function act(status: EnquiryStatus, withText = false) {
    if (!profile || busy) return;
    setBusy(true);
    try {
      const reply = withText && text.trim() ? { byUid: profile.uid, byName: profile.name, text: text.trim().slice(0, 300), at: Date.now() } : undefined;
      await api.updateEnquiry(e.id, status, reply);
      setText(''); toast(L('സേവ് ചെയ്തു', 'Saved')); onChange();
    } catch (err) { console.error(err); toast(L('പറ്റിയില്ല', "Couldn't do that")); } finally { setBusy(false); }
  }

  return (
    <div className="card" style={{ display: 'block' }}>
      <div className="row between" style={{ gap: 6 }}>
        <b>{mine ? e.fromName : e.toName}</b>
        <span className={st[2]}>{lang === 'ml' ? st[0] : st[1]}</span>
      </div>
      {e.listingTitle && !e.lines && <div className="muted small">{e.listingTitle}</div>}
      {e.lines ? <Bill e={e} d={d} /> : <div style={{ margin: '6px 0' }}><b>{e.items}</b>{e.qty ? ` — ${e.qty}` : ''}</div>}
      <div className="row small" style={{ gap: 8 }}>
        <span className={e.freq === 'once' ? 'badge grey' : 'badge'}><CalendarClock size={12} aria-hidden /> {pair(FREQ_LABEL[e.freq])}</span>
        <span className="badge grey">{e.delivery ? <><Truck size={12} aria-hidden /> {L('Delivery', 'Delivery')}</> : L('വന്ന് വാങ്ങും', 'Pick-up')}</span>
        <span className="muted">{timeAgo(e.createdAt, lang)}</span>
      </div>
      {mine && e.address && <div className="small" style={{ marginTop: 6 }}><MapPin size={12} aria-hidden /> {e.address}</div>}
      {mine && e.lat != null && <a className="link small" href={`https://www.google.com/maps/dir/?api=1&destination=${e.lat},${e.lng}`} target="_blank" rel="noreferrer">📍 {L('Map-ൽ വീട് കാണുക', 'See home on map')}</a>}
      {e.note && <div className="small muted">{e.note}</div>}
      {e.replies.map((r, i) => (
        <div key={i} className="small" style={{ background: r.byUid === profile?.uid ? '#e8f5e9' : '#f1f1ec', borderRadius: 10, padding: '6px 10px', marginTop: 6 }}>
          <b>{r.byName}:</b> {r.text} <span className="muted">· {timeAgo(r.at, lang)}</span>
        </div>
      ))}
      <div className="row nowrap" style={{ gap: 8, marginTop: 8 }}>
        <a className="btn sm grow" href={telHref(other.phone)}><Phone size={16} aria-hidden /> {showPhone(other.phone)}</a>
        <a className="btn sm wa grow" href={waHref(other.phone, L(`നമസ്കാരം, ഗ്രാമസേവ ഓർഡർ: ${e.items}`, `Hello, Gramaseva order: ${e.items}`))} target="_blank" rel="noreferrer"><MessageCircle size={16} aria-hidden /> WhatsApp</a>
      </div>
      {mine && (!closed || d) && <AssignDelivery e={e} d={d} onChange={onChange} />}
      {!mine && <DeliveryInfo d={d} />}
      {!closed && (<>
        <div className="row nowrap" style={{ gap: 6, marginTop: 8 }}>
          <input className="input grow" style={{ minHeight: 40 }} maxLength={300} value={text} onChange={(ev) => setText(ev.target.value)} placeholder={L('മറുപടി എഴുതുക…', 'Write a reply…')} aria-label={L('മറുപടി', 'Reply')} />
          <button className="btn sm" disabled={busy || !text.trim()} onClick={() => act(mine && e.status === 'new' ? 'replied' : e.status, true)}>{L('അയയ്ക്കുക', 'Send')}</button>
        </div>
        <div className="row" style={{ gap: 6, marginTop: 8 }}>
          {mine ? (<>
            {e.status !== 'accepted' && <button className="btn sm" disabled={busy} onClick={() => act('accepted', true)}>{L('ഉറപ്പിക്കുക', 'Accept')}</button>}
            <button className="btn sm outline" disabled={busy} onClick={() => act('done', true)}>{L('കഴിഞ്ഞു', 'Done')}</button>
            <button className="btn sm danger" disabled={busy} onClick={() => act('declined', true)}>{L('പറ്റില്ല', 'Decline')}</button>
          </>) : (
            <button className="btn sm danger" disabled={busy} onClick={() => { if (confirm(L('ഈ ഓർഡർ റദ്ദാക്കണോ?', 'Cancel this order?'))) void act('cancelled', true); }}>{L('റദ്ദാക്കുക', 'Cancel')}</button>
          )}
        </div>
      </>)}
    </div>
  );
}

const rs = (n: number) => `₹${n.toLocaleString('en-IN')}`;
/** Store order bill; for daily / weekly / monthly orders also this month's bill from the delivery log. */
function Bill({ e, d }: { e: Enquiry; d?: Delivery }) {
  const { L } = useApp();
  const items = e.itemsTotal ?? 0;
  const fee = e.delivery ? e.deliveryFee ?? 0 : 0;
  const n = inMonth(d?.log);
  return (
    <div className="small" style={{ margin: '6px 0', background: '#fafaf6', borderRadius: 10, padding: 8 }}>
      {e.lines!.map((x, i) => <div key={i} className="row between"><span>{x.title} × {x.qty}</span><span className="num">{rs(x.price * x.qty)}</span></div>)}
      {e.delivery && <div className="row between muted"><span>{L('ഡെലിവറി ചാർജ്', 'Delivery charge')}{e.km != null ? ` (~${e.km} km)` : ''}</span><span className="num">{rs(fee)}</span></div>}
      <div className="row between" style={{ borderTop: '1px solid var(--line)', marginTop: 4, paddingTop: 4 }}><b>{e.freq === 'once' ? L('ആകെ', 'Total') : L('ഓരോ തവണയും', 'Each time')}</b><b className="num">{rs(items + fee)}</b></div>
      {e.freq !== 'once' && <div style={{ marginTop: 4 }}>🧾 {L(`ഈ മാസം ${n} തവണ എത്തിച്ചു → bill ${rs(n * (items + fee))}`, `This month: ${n} deliveries → bill ${rs(n * (items + fee))}`)}{e.delivery && n ? L(` (ഡെലിവറിക്കാരന് ${rs(n * fee)})`, ` (delivery person: ${rs(n * fee)})`) : ''}</div>}
      <div className="muted">💵 {L('Cash / UPI നേരിട്ട്', 'Cash / UPI directly')}</div>
    </div>
  );
}

/** Small home-screen card: new orders waiting for a shop owner / seller, or replies to the user's own orders. */
export function OrdersCard() {
  const { api, profile, provider, L } = useApp();
  const [d] = useLoad(async () => {
    if (!profile) return null;
    const [got, sent] = await Promise.all([api.listEnquiriesTo(profile.uid), api.listEnquiriesFrom(profile.uid)]);
    return { newGot: got.filter((e) => e.status === 'new').length, got: got.length, sent: sent.filter((e) => !['done', 'declined', 'cancelled'].includes(e.status)).length };
  }, [profile?.uid ?? '', provider?.uid ?? '']);
  if (!d || (!d.got && !d.sent)) return null;
  return (
    <Link to={d.got ? '/orders' : '/orders?tab=sent'} className="card" style={d.newGot ? { borderColor: 'var(--orange-ink)', background: '#fff8e1' } : undefined}>
      <ShoppingCart size={26} color="var(--green)" aria-hidden />
      <span className="grow stack">
        <b>{L('ഓർഡറുകൾ / അന്വേഷണങ്ങൾ', 'Orders & enquiries')}</b>
        <span className="muted small">
          {d.newGot ? L(`${d.newGot} പുതിയ ഓർഡർ — മറുപടി കൊടുക്കുക`, `${d.newGot} new — please reply`) : d.got ? L(`${d.got} ഓർഡറുകൾ വന്നിട്ടുണ്ട്`, `${d.got} orders received`) : L(`${d.sent} ഓർഡർ നടക്കുന്നു`, `${d.sent} orders in progress`)}
        </span>
      </span>
      {d.newGot > 0 && <span className="badge warn">{d.newGot}</span>}
    </Link>
  );
}
