import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Trash2, X } from 'lucide-react';
import { useApp, useLoad } from '../lib/app';
import { Loading, LoadError, Screen } from '../components/ui';
import { isOwner } from '../lib/owner';
import { panchayatName } from '../lib/panchayat';
import { prettyDate, prettyPhone, telHref, timeAgo } from '../lib/util';
import { DEFAULT_PAY, boyActive, sellerActive, type DeliveryBoy, type PaySettings, type Village } from '../types';
import { VEHICLE } from './Delivery';
import { ITEM_LABEL, KIND_LABEL, PayRow, priceText } from './Market';

type Tab = 'pay' | 'ads' | 'sellers' | 'delivery' | 'items' | 'settings';
const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const day = (ms: number, lang: 'ml' | 'en') => prettyDate(new Date(ms).toISOString().slice(0, 10), lang);
const showPhone = (p: string) => (/^\+91\d{10}$/.test(p) ? prettyPhone(p) : p);

/** Owner's business panel: payments to approve, ads, sellers, items for sale and UPI settings. */
export function Business() {
  const { api, profile, authUser, villages, lang, L, pair, toast } = useApp();
  const [tab, setTab] = useState<Tab>('pay');
  const [data, reload, err] = useLoad(async () => {
    const [pays, ads, sellers, items, settings, boys, deliveries] = await Promise.all([api.listPayments(), api.listAllAds(), api.listSellers(), api.listListings(null), api.getPaySettings(),
      api.listDeliveryBoys(null), api.listDeliveries(null)]);
    return { pays, ads, sellers, items, settings, boys, deliveries };
  }, []);
  const [busy, setBusy] = useState('');
  if (!isOwner(profile, authUser)) return <Screen title="Business"><div className="notice bad">{L('ഈ ഭാഗം owner-ന് മാത്രം.', 'Only for the owner.')}</div></Screen>;

  const vname = (id: string) => { const v = villages.find((x) => x.id === id); return v ? panchayatName(v as Village, lang) : id; };
  const month = new Date(); month.setDate(1); month.setHours(0, 0, 0, 0);
  const approved = data?.pays.filter((p) => p.status === 'approved') ?? [];
  const pending = data?.pays.filter((p) => p.status === 'pending') ?? [];
  const sum = (xs: typeof approved) => xs.reduce((t, p) => t + p.amount, 0);

  async function decide(id: string, ok: boolean) {
    const p = data?.pays.find((x) => x.id === id);
    if (!p || !profile) return;
    setBusy(id);
    try { await api.decidePayment(p, ok, profile.name); toast(ok ? L('ശരിയാക്കി — active ആയി', 'Approved — now active') : L('നിരസിച്ചു', 'Rejected')); reload(); }
    catch (e) { console.error(e); toast(L('പറ്റിയില്ല', "Couldn't do that")); } finally { setBusy(''); }
  }

  async function setBoy(b: DeliveryBoy, patch: Partial<DeliveryBoy>, msg: string) {
    setBusy(b.uid);
    try { await api.saveDeliveryBoy(b.uid, patch); toast(msg); reload(); }
    catch (e) { console.error(e); toast(L('പറ്റിയില്ല', "Couldn't do that")); } finally { setBusy(''); }
  }

  async function cash(kind: 'seller' | 'ad' | 'delivery', uid: string, name: string, phone: string, villageId: string, weeks: number, adId?: string) {
    if (!data || !profile) return;
    const amount = (kind === 'ad' ? data.settings.adFee : kind === 'delivery' ? data.settings.deliveryFee : data.settings.sellerFee) * weeks;
    if (!confirm(L(`${name}-ൽ നിന്ന് ₹${amount} നേരിട്ട് കിട്ടിയോ? ${weeks} ആഴ്ച ചേർക്കും.`, `Received ₹${amount} from ${name} in person? This adds ${weeks} week(s).`))) return;
    setBusy(uid + (adId ?? ''));
    try {
      await api.recordCash({ uid, name, phone, villageId, purpose: kind, ...(adId ? { adId } : {}), weeks, amount, utr: 'CASH-' + Date.now().toString(36).toUpperCase(), createdAt: Date.now() }, profile.name);
      toast(L('ചേർത്തു', 'Added')); reload();
    } catch (e) { console.error(e); toast(L('പറ്റിയില്ല', "Couldn't do that")); } finally { setBusy(''); }
  }

  const tabs: [Tab, string][] = [
    ['pay', L(`Payments${pending.length ? ` (${pending.length})` : ''}`, `Payments${pending.length ? ` (${pending.length})` : ''}`)],
    ['ads', L('പരസ്യങ്ങൾ', 'Ads')], ['sellers', L('വിൽപ്പനക്കാർ', 'Sellers')],
    ['delivery', L(`ഡെലിവറി${data?.boys.filter((b) => b.status === 'pending').length ? ` (${data.boys.filter((b) => b.status === 'pending').length})` : ''}`, `Delivery${data?.boys.filter((b) => b.status === 'pending').length ? ` (${data.boys.filter((b) => b.status === 'pending').length})` : ''}`)], ['items', L('സാധനങ്ങൾ', 'Items')], ['settings', 'Settings'],
  ];

  return (
    <Screen title={L('Business panel', 'Business panel')} sub={authUser?.email}>
      {err && <LoadError retry={reload} />}
      {!data && !err && <Loading />}
      {data && (<>
        <div className="row nowrap" style={{ gap: 8 }}>
          {([[L('ഈ മാസം', 'This month'), rupees(sum(approved.filter((p) => (p.decidedAt ?? p.createdAt) >= month.getTime())))],
            [L('ആകെ', 'All time'), rupees(sum(approved))], [L('പരിശോധിക്കാൻ', 'To check'), String(pending.length)]] as [string, string][]).map(([k, v]) => (
            <div key={k} className="card grow" style={{ display: 'block', textAlign: 'center', padding: 10 }}><div className="muted small">{k}</div><b style={{ fontSize: 20 }}>{v}</b></div>
          ))}
        </div>
        <div className="chips">{tabs.map(([k, t]) => <button key={k} className={'chip' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}>{t}</button>)}</div>

        {tab === 'pay' && (<>
          <p className="muted small">{L('നേരിട്ട് (cash / UPI) കിട്ടിയ പണം: "വിൽപ്പനക്കാർ" / "പരസ്യങ്ങൾ" / "ഡെലിവറി" tab-ൽ +1 ആഴ്ച അമർത്തുക. Play Store app-ൽ ആളുകൾക്ക് app-നുള്ളിൽ pay ചെയ്യാൻ പറ്റില്ല.', 'Money received in person (cash / UPI): use +1 week on the Sellers / Ads tab. In the Play Store app, people cannot pay inside the app.')}</p>
          {pending.length > 0 && <div className="notice warn">{L('Bank / UPI app-ൽ UTR നമ്പറും തുകയും ഒത്തുനോക്കിയ ശേഷം മാത്രം ✓ അമർത്തുക.', 'Tap ✓ only after matching the UTR and amount in your bank / UPI app.')}</div>}
          {data.pays.length === 0 && <p className="muted">{L('ഇതുവരെ payments ഇല്ല.', 'No payments yet.')}</p>}
          {data.pays.map((p) => (
            <PayRow key={p.id} p={p} extra={<>
              <span className="small">{p.name} · <a className="link" href={telHref(p.phone)}>{showPhone(p.phone)}</a> · {vname(p.villageId)}</span>
              {p.purpose === 'ad' && <span className="small muted">{L('പരസ്യം', 'Ad')}: {data.ads.find((a) => a.id === p.adId)?.title ?? '—'}</span>}
              {p.status === 'pending' && (
                <span className="row" style={{ gap: 8, marginTop: 6 }}>
                  <button className="btn sm" disabled={busy === p.id} onClick={() => decide(p.id, true)}><Check size={16} aria-hidden /> {L('ശരിയാണ്', 'Approve')}</button>
                  <button className="btn sm danger" disabled={busy === p.id} onClick={() => decide(p.id, false)}><X size={16} aria-hidden /> {L('നിരസിക്കുക', 'Reject')}</button>
                </span>
              )}
              {p.decidedBy && <span className="muted small">{p.decidedBy} · {p.decidedAt ? timeAgo(p.decidedAt, lang) : ''}</span>}
            </>} />
          ))}
        </>)}

        {tab === 'ads' && (<>
          {data.ads.length === 0 && <p className="muted">{L('ഇതുവരെ പരസ്യങ്ങൾ ഇല്ല.', 'No ads yet.')}</p>}
          {data.ads.map((a) => {
            const live = a.status === 'live' && a.until > Date.now();
            return (
              <div key={a.id} className="card" style={{ alignItems: 'flex-start' }}>
                {a.photo && <img src={a.photo} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 10 }} />}
                <span className="stack grow" style={{ minWidth: 0 }}>
                  <b>{a.title}</b>
                  <span className="small">{a.name} · <a className="link" href={telHref(a.phone)}>{showPhone(a.phone)}</a></span>
                  <span className="muted small">{vname(a.villageId)} · {timeAgo(a.createdAt, lang)}</span>
                  <span className={live ? 'badge' : a.status === 'pending' ? 'badge warn' : 'badge grey'}>
                    {live ? L(`Live — ${day(a.until, lang)} വരെ`, `Live until ${day(a.until, lang)}`) : a.status === 'pending' ? L('Payment കാത്തിരിക്കുന്നു', 'Awaiting payment') : a.status === 'rejected' ? L('നിരസിച്ചു', 'Rejected') : L('കാലാവധി കഴിഞ്ഞു', 'Expired')}
                  </span>
                </span>
                <button className="btn sm" disabled={busy === a.uid + a.id} onClick={() => cash('ad', a.uid, a.name, a.phone, a.villageId, 1, a.id)}>{live ? L('+1 ആഴ്ച (cash)', '+1 week (cash)') : L('Cash കിട്ടി — live ആക്കുക', 'Cash received — go live')}</button>
                {live && <button className="btn sm outline" onClick={async () => { if (confirm(L('ഈ പരസ്യം നിർത്തണോ?', 'Stop this ad?'))) { await api.setAdStatus(a.id, 'rejected', 0); reload(); } }}>{L('നിർത്തുക', 'Stop')}</button>}
              </div>
            );
          })}
        </>)}

        {tab === 'sellers' && (<>
          <p className="muted small">{L(`${data.sellers.length} വിൽപ്പനക്കാർ · ${data.sellers.filter((s) => sellerActive(s)).length} active`, `${data.sellers.length} sellers · ${data.sellers.filter((s) => sellerActive(s)).length} active`)}</p>
          {[...data.sellers].sort((a, b) => b.createdAt - a.createdAt).map((s) => {
            const until = Math.max(s.freeUntil, s.paidUntil);
            const n = data.items.filter((l) => l.sellerUid === s.uid).length;
            return (
              <div key={s.uid} className="card">
                <span className="stack grow" style={{ minWidth: 0 }}>
                  <b>{s.name}</b>
                  <span className="small"><a className="link" href={telHref(s.phone)}>{showPhone(s.phone)}</a> · {vname(s.villageId)}</span>
                  <span className="muted small">{n} {L('സാധനങ്ങൾ', 'items')} · {s.paidUntil > s.freeUntil ? L('പണമടച്ചു', 'Paid') : 'Free'} {L(`${day(until, lang)} വരെ`, `until ${day(until, lang)}`)}</span>
                </span>
                <span className="stack" style={{ gap: 6, alignItems: 'flex-end' }}>
                  <span className={sellerActive(s) ? 'badge' : 'badge bad'}>{sellerActive(s) ? 'Active' : L('കഴിഞ്ഞു', 'Expired')}</span>
                  <span className="row nowrap" style={{ gap: 4 }}>
                    <button className="btn sm outline" disabled={busy === s.uid} onClick={() => cash('seller', s.uid, s.name, s.phone, s.villageId, 1)}>+1 {L('ആഴ്ച', 'wk')}</button>
                    <button className="btn sm outline" disabled={busy === s.uid} onClick={() => cash('seller', s.uid, s.name, s.phone, s.villageId, 4)}>+4</button>
                  </span>
                </span>
              </div>
            );
          })}
        </>)}

        {tab === 'delivery' && (<>
          <p className="muted small">{L(`${data.boys.length} ഡെലിവറി ബോയ്സ് · ${data.boys.filter((b) => boyActive(b)).length} active · ആകെ ${data.deliveries.reduce((t, d) => t + (d.deliveredCount || 0), 0)} ഡെലിവറി കഴിഞ്ഞു`,
            `${data.boys.length} delivery people · ${data.boys.filter((b) => boyActive(b)).length} active · ${data.deliveries.reduce((t, d) => t + (d.deliveredCount || 0), 0)} deliveries done`)}</p>
          {data.boys.length === 0 && <p className="muted">{L('ഇതുവരെ ആരും ചേർന്നിട്ടില്ല. ആളുകൾ പ്രൊഫൈൽ → "ഡെലിവറി ബോയ്" വഴി അപേക്ഷിക്കും.', 'Nobody has joined yet. People apply from Profile → "Delivery person".')}</p>}
          {[...data.boys].sort((a, b) => Number(b.status === 'pending') - Number(a.status === 'pending') || b.createdAt - a.createdAt).map((b) => {
            const jobs = data.deliveries.filter((d) => d.deliveryUid === b.uid);
            const done = jobs.reduce((t, d) => t + (d.deliveredCount || 0), 0);
            const openJobs = jobs.filter((d) => ['assigned', 'accepted', 'picked'].includes(d.status)).length;
            const last = jobs.map((d) => d.lastDeliveredAt ?? 0).reduce((m, x) => Math.max(m, x), 0);
            const until = Math.max(b.freeUntil, b.paidUntil);
            const badge = b.status === 'pending' ? ['badge warn', L('അപേക്ഷ', 'Pending')] : b.status === 'suspended' ? ['badge bad', L('Suspended', 'Suspended')]
              : b.status === 'removed' ? ['badge grey', L('മാറ്റി', 'Removed')] : boyActive(b) ? ['badge', 'Active'] : ['badge bad', L('Fee കഴിഞ്ഞു', 'Fee expired')];
            return (
              <div key={b.uid} className="card" style={{ display: 'block' }}>
                <div className="row between"><b>{VEHICLE[b.vehicle][2]} {b.name}</b><span className={badge[0]}>{badge[1]}</span></div>
                <div className="small"><a className="link" href={telHref(b.phone)}>{showPhone(b.phone)}</a> · {vname(b.villageId)}{b.area ? ` · ${b.area}` : ''}</div>
                <div className="small muted">
                  {L(`${done} ഡെലിവറി കഴിഞ്ഞു · ${openJobs} നടക്കുന്നു`, `${done} delivered · ${openJobs} in progress`)}{last ? ` · ${L('അവസാനം', 'last')} ${timeAgo(last, lang)}` : ''}
                  {b.status === 'active' && until ? ` · ${b.paidUntil > b.freeUntil ? L('പണമടച്ചു', 'Paid') : 'Free'} ${L(`${day(until, lang)} വരെ`, `until ${day(until, lang)}`)}` : ''}
                </div>
                {b.warning && <div className="small" style={{ color: 'var(--red)' }}>⚠ {b.warning}</div>}
                <div className="row" style={{ gap: 6, marginTop: 8 }}>
                  {(b.status === 'pending' || b.status === 'removed') && (
                    <button className="btn sm" disabled={busy === b.uid} onClick={() => setBoy(b, { status: 'active', freeUntil: Date.now() + data.settings.deliveryFreeDays * 86400000 }, L(`Approve ചെയ്തു — ${data.settings.deliveryFreeDays} ദിവസം free`, `Approved — ${data.settings.deliveryFreeDays} days free`))}>{L('Approve ചെയ്യുക', 'Approve')}</button>
                  )}
                  {b.status === 'active' && (
                    <button className="btn sm danger" disabled={busy === b.uid} onClick={() => {
                      const w = prompt(L('Suspend ചെയ്യാനുള്ള കാരണം / warning (ഡെലിവറി ബോയിന് കാണാം):', 'Reason / warning for suspending (the delivery person will see it):'), '');
                      if (w !== null) void setBoy(b, { status: 'suspended', warning: w.trim().slice(0, 200) || L('Admin നിർത്തി വെച്ചു', 'Suspended by admin') }, L('Suspend ചെയ്തു', 'Suspended'));
                    }}>{L('Suspend (warning)', 'Suspend (warning)')}</button>
                  )}
                  {b.status === 'suspended' && <button className="btn sm" disabled={busy === b.uid} onClick={() => setBoy(b, { status: 'active', warning: '' }, L('വീണ്ടും Active ആക്കി', 'Active again'))}>{L('വീണ്ടും Active', 'Re-activate')}</button>}
                  {b.status !== 'removed' && <button className="btn sm outline" disabled={busy === b.uid} onClick={() => { if (confirm(L(`${b.name}-നെ ഡെലിവറി list-ൽ നിന്ന് മാറ്റണോ?`, `Remove ${b.name} from the delivery list?`))) void setBoy(b, { status: 'removed' }, L('മാറ്റി', 'Removed')); }}>{L('മാറ്റുക (Remove)', 'Remove')}</button>}
                  {b.status === 'active' && <>
                    <button className="btn sm outline" disabled={busy === b.uid} onClick={() => cash('delivery', b.uid, b.name, b.phone, b.villageId, 1)}>+1 {L('ആഴ്ച', 'wk')}</button>
                    <button className="btn sm outline" disabled={busy === b.uid} onClick={() => cash('delivery', b.uid, b.name, b.phone, b.villageId, 4)}>+4</button>
                  </>}
                </div>
              </div>
            );
          })}
          {data.deliveries.some((d) => d.lastDeliveredAt) && <span className="section">{L('അവസാനം കഴിഞ്ഞ ഡെലിവറികൾ', 'Recent deliveries')}</span>}
          {data.deliveries.filter((d) => d.lastDeliveredAt).sort((a, b) => (b.lastDeliveredAt ?? 0) - (a.lastDeliveredAt ?? 0)).slice(0, 20).map((d) => (
            <div key={d.id} className="card">
              <span className="stack grow" style={{ minWidth: 0 }}>
                <b>{d.items}{d.qty ? ` — ${d.qty}` : ''}</b>
                <span className="small">{d.shopName} → {d.customerName}</span>
                <span className="muted small">🛵 {d.deliveryName} · {d.deliveredCount}× · {timeAgo(d.lastDeliveredAt ?? d.updatedAt, lang)}</span>
              </span>
            </div>
          ))}
        </>)}

        {tab === 'items' && (<>
          <p className="muted small">{L(`ആകെ ${data.items.length} സാധനങ്ങൾ`, `${data.items.length} items in all`)}</p>
          {data.items.map((l) => (
            <div key={l.id} className="card">
              <span style={{ fontSize: 26 }}>{ITEM_LABEL[l.category][2]}</span>
              <span className="stack grow" style={{ minWidth: 0 }}>
                <b>{l.title}</b>
                <span className="small">{pair(KIND_LABEL[l.kind])} · {priceText(l, L)}{l.active ? '' : ` · ${L('മറച്ചത്', 'hidden')}`}</span>
                <span className="muted small">{l.sellerName} · {showPhone(l.phone)} · {vname(l.villageId)} · {timeAgo(l.createdAt, lang)}</span>
              </span>
              <button className="iconbtn" aria-label={L('ഡിലീറ്റ്', 'Delete')} onClick={async () => { if (confirm(L('ഈ സാധനം ഡിലീറ്റ് ചെയ്യണോ?', 'Delete this item?'))) { await api.deleteListing(l.id); reload(); } }}><Trash2 size={18} /></button>
            </div>
          ))}
        </>)}

        {tab === 'settings' && <PaySettingsForm initial={data.settings} onSaved={reload} />}
      </>)}
      <p className="muted small center"><Link className="link" to="/market">{L('Market തുറക്കുക', 'Open market')}</Link></p>
    </Screen>
  );
}

function PaySettingsForm({ initial, onSaved }: { initial: PaySettings; onSaved: () => void }) {
  const { api, L, toast } = useApp();
  const [s, setS] = useState<PaySettings>({ ...DEFAULT_PAY, ...initial });
  const n = (k: keyof PaySettings) => (e: React.ChangeEvent<HTMLInputElement>) => setS({ ...s, [k]: Number(e.target.value.replace(/\D/g, '')) || 0 });
  const upiOk = /^[\w.-]{2,}@[a-zA-Z]{2,}$/.test(s.upiId.trim());
  return (
    <div className="stack-lg">
      <label htmlFor="upi">{L('പണം വരേണ്ട UPI ID', 'UPI ID to receive money')}</label>
      <input id="upi" className="input" value={s.upiId} onChange={(e) => setS({ ...s, upiId: e.target.value.trim() })} placeholder="yourname@okaxis" />
      <label htmlFor="payee">{L('UPI-ൽ കാണിക്കേണ്ട പേര്', 'Name shown in UPI')}</label>
      <input id="payee" className="input" value={s.payeeName} onChange={(e) => setS({ ...s, payeeName: e.target.value })} />
      <div className="row nowrap">
        <span className="grow stack"><label htmlFor="sf">{L('വിൽപ്പന fee ₹/ആഴ്ച', 'Seller fee ₹/week')}</label><input id="sf" className="input" inputMode="numeric" value={s.sellerFee} onChange={n('sellerFee')} /></span>
        <span className="grow stack"><label htmlFor="af">{L('പരസ്യം ₹/ആഴ്ച', 'Ad ₹/week')}</label><input id="af" className="input" inputMode="numeric" value={s.adFee} onChange={n('adFee')} /></span>
        <span className="grow stack"><label htmlFor="fd">{L('Free ദിവസം', 'Free days')}</label><input id="fd" className="input" inputMode="numeric" value={s.freeDays} onChange={n('freeDays')} /></span>
      </div>
      <div className="row nowrap">
        <span className="grow stack"><label htmlFor="dfee">{L('ഡെലിവറി ബോയ് ₹/ആഴ്ച', 'Delivery person ₹/week')}</label><input id="dfee" className="input" inputMode="numeric" value={s.deliveryFee} onChange={n('deliveryFee')} /></span>
        <span className="grow stack"><label htmlFor="dfd">{L('ഡെലിവറി free ദിവസം', 'Delivery free days')}</label><input id="dfd" className="input" inputMode="numeric" value={s.deliveryFreeDays} onChange={n('deliveryFreeDays')} /></span>
      </div>
      <b>{L('ഡെലിവറി ചാർജ് (വാങ്ങുന്നയാൾ അടയ്ക്കും → ഡെലിവറി ചെയ്യുന്നയാൾക്ക്)', 'Delivery charge (customer pays → delivery person)')}</b>
      <div className="row nowrap">
        <span className="grow stack"><label htmlFor="db">{L('ആദ്യ ₹', 'Base ₹')}</label><input id="db" className="input" inputMode="numeric" value={s.delBase} onChange={n('delBase')} /></span>
        <span className="grow stack"><label htmlFor="dbk">{L('ഇത്ര km വരെ', 'Up to km')}</label><input id="dbk" className="input" inputMode="numeric" value={s.delBaseKm} onChange={n('delBaseKm')} /></span>
        <span className="grow stack"><label htmlFor="dpk">{L('ശേഷം ₹/km', 'Then ₹/km')}</label><input id="dpk" className="input" inputMode="numeric" value={s.delPerKm} onChange={n('delPerKm')} /></span>
        <span className="grow stack"><label htmlFor="dd">{L('ദിവസവും ₹', 'Daily ₹')}</label><input id="dd" className="input" inputMode="numeric" value={s.delDaily} onChange={n('delDaily')} /></span>
      </div>
      <p className="muted small">{L(`ഉദാ: ${s.delBaseKm} km വരെ ₹${s.delBase}, 4 km = ₹${s.delBase + Math.max(0, 4 - s.delBaseKm) * s.delPerKm}. ദിവസവും എത്തിക്കുന്ന പാൽ / മുട്ടയ്ക്ക് ഓരോ ദിവസവും ₹${s.delDaily}.`, `e.g. up to ${s.delBaseKm} km ₹${s.delBase}, 4 km = ₹${s.delBase + Math.max(0, 4 - s.delBaseKm) * s.delPerKm}. Daily milk / eggs: ₹${s.delDaily} per day.`)}</p>
      <button className="btn block" disabled={!upiOk || s.sellerFee < 1 || s.adFee < 1 || s.deliveryFee < 1} onClick={async () => {
        try { await api.savePaySettings({ ...s, freeDays: Math.min(30, s.freeDays) }); toast(L('സേവ് ചെയ്തു', 'Saved')); onSaved(); }
        catch (e) { console.error(e); toast(L('സേവ് ചെയ്യാൻ പറ്റിയില്ല', "Couldn't save")); }
      }}>{L('സേവ് ചെയ്യുക', 'Save')}</button>
      <p className="muted small">{L('Free ദിവസം പരമാവധി 30.', 'Free days: at most 30.')}</p>
    </div>
  );
}
