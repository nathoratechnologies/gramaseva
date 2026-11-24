import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Camera, Copy, Megaphone, Pencil, Phone, Plus, ShoppingBasket, Trash2, Wallet } from 'lucide-react';
import { useApp, useLoad } from '../lib/app';
import { CallWhatsApp, Empty, LoadError, Loading, Screen } from '../components/ui';
import { sortedWards, wardLabel } from '../lib/panchayat';
import { compressImage, prettyDate, telHref, timeAgo } from '../lib/util';
import { isPlayApp } from '../lib/store';
import { getPosition } from '../lib/geo';
import { OrderButton } from './Orders';
import { NearTag, PinOnlyChip, StatStars, useNear } from '../components/near';
import { nearFirst } from '../lib/pincode';
import type { RatingStat } from '../types';
import {
  DEFAULT_PAY, LISTING_CATS, LISTING_KINDS, WEEK, boyActive, sellerActive,
  type Ad, type Listing, type ListingCat, type ListingKind, type Payment, type Seller,
} from '../types';

export const ITEM_LABEL: Record<ListingCat, [string, string, string]> = {
  milk: ['പാൽ', 'Milk', '🥛'], egg: ['മുട്ട', 'Eggs', '🥚'], vegetable: ['പച്ചക്കറി', 'Vegetables', '🥬'], fruit: ['പഴങ്ങൾ', 'Fruits', '🍌'],
  fish: ['മീൻ', 'Fish', '🐟'], meat: ['കോഴി / ഇറച്ചി', 'Chicken / meat', '🍗'], homefood: ['വീട്ടു ഭക്ഷണം / പലഹാരം', 'Home food / snacks', '🍱'],
  plants: ['ചെടി / തൈ', 'Plants / saplings', '🌱'], animals: ['പശു / ആട് / കോഴി', 'Cattle / goats / hens', '🐄'],
  rental: ['വാടക സാധനങ്ങൾ', 'Rental items', '🪑'], used: ['പഴയ സാധനങ്ങൾ', 'Used items', '♻️'], itemother: ['മറ്റുള്ളവ', 'Others', '📦'],
};
export const KIND_LABEL: Record<ListingKind, [string, string]> = { sell: ['വിൽക്കാൻ', 'For sale'], rent: ['വാടകയ്ക്ക്', 'For rent'], buy: ['വാങ്ങാൻ വേണം', 'Wanted'] };
const UNITS: [string, string][] = [['ലിറ്റർ', 'litre'], ['കിലോ', 'kg'], ['എണ്ണം', 'piece'], ['ഡസൻ', 'dozen'], ['ദിവസം', 'day'], ['മണിക്കൂർ', 'hour'], ['പാക്കറ്റ്', 'packet']];

const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;
/** Current fees set by the owner in Business panel → Settings. */
export function usePay() {
  const { api } = useApp();
  const [s] = useLoad(() => api.getPaySettings(), []);
  return s ?? DEFAULT_PAY;
}
export function priceText(l: Pick<Listing, 'price' | 'unit'>, L: (a: string, b: string) => string) {
  if (!l.price) return L('വില ചോദിക്കുക', 'Ask the price');
  return rupees(l.price) + (l.unit ? ` / ${l.unit}` : '');
}

/** Everyone's items for sale / rent / wanted in the panchayat being viewed (and nearby). Only sellers whose free period or weekly fee is active are shown. */
export function Market() {
  const { cat } = useParams();
  const nav = useNavigate();
  const { api, reachIds, villages, lang, L, pair } = useApp();
  const [kind, setKind] = useState<ListingKind | ''>('');
  const [onlyPin, setOnlyPin] = useState(false);
  const near = useNear();
  const [stats, setStats] = useState<Record<string, RatingStat>>({});
  const [list, reload, err] = useLoad(async () => {
    const all = await api.listListings(reachIds);
    const uids = [...new Set(all.map((l) => l.sellerUid))];
    const sellers = await api.listSellers(uids);
    api.getRatingStats('shop', uids).then(setStats).catch(() => undefined);
    const ok = new Set(sellers.filter((s) => sellerActive(s)).map((s) => s.uid));
    return all.filter((l) => ok.has(l.sellerUid));
  }, [reachIds.join(',')]);
  const sel = (LISTING_CATS as string[]).includes(cat ?? '') ? (cat as ListingCat) : null;
  // Nearest first: same PIN code, then by distance from my PIN area.
  const rows = nearFirst((list ?? []).filter((l) => (!sel || l.category === sel) && (!kind || l.kind === kind)), near.pin, near.point)
    .filter((r) => !onlyPin || r.same);
  const count = (c: ListingCat) => (list ?? []).filter((l) => l.category === c && (!kind || l.kind === kind)).length;

  return (
    <Screen title={L('വാങ്ങാം · വിൽക്കാം · വാടക', 'Buy · Sell · Rent')} nav
      right={<Link to="/market/my" className="iconbtn" aria-label={L('എന്റെ വിൽപ്പന', 'My items')}><Wallet size={22} /></Link>}>
      <Link to="/market/sell" className="big green">
        <span className="ic"><Plus size={28} aria-hidden /></span>
        <span><b>{L('ഞാനും വിൽക്കാം / വാടകയ്ക്ക് കൊടുക്കാം', 'Sell or rent out something')}</b><span>{L('പാൽ, മുട്ട, പച്ചക്കറി, കസേര, പന്തൽ…', 'Milk, eggs, vegetables, chairs, tents…')}</span></span>
      </Link>
      <div className="chips">
        <button className={'chip' + (!kind ? ' on' : '')} onClick={() => setKind('')}>{L('എല്ലാം', 'All')}</button>
        {LISTING_KINDS.map((k) => <button key={k} className={'chip' + (kind === k ? ' on' : '')} onClick={() => setKind(k)}>{pair(KIND_LABEL[k])}</button>)}
        <PinOnlyChip on={onlyPin} set={setOnlyPin} />
      </div>
      <div className="chips">
        <button className={'chip' + (!sel ? ' on' : '')} onClick={() => nav('/market', { replace: true })}>{L('എല്ലാ സാധനവും', 'All items')}</button>
        {LISTING_CATS.map((c) => (
          <button key={c} className={'chip' + (sel === c ? ' on' : '')} onClick={() => nav(`/market/c/${c}`, { replace: true })}>
            {ITEM_LABEL[c][2]} {lang === 'ml' ? ITEM_LABEL[c][0] : ITEM_LABEL[c][1]}{list && count(c) ? ` (${count(c)})` : ''}
          </button>
        ))}
      </div>
      {err && <LoadError retry={reload} />}
      {!list && !err && <Loading />}
      {rows.map(({ x: l, same, d }) => (
        <div key={l.id} className="card" style={{ display: 'block' }}>
          <div className="row nowrap" style={{ alignItems: 'flex-start', gap: 12 }}>
            {l.photo
              ? <img src={l.photo} alt="" style={{ width: 76, height: 76, objectFit: 'cover', borderRadius: 12, flex: 'none' }} />
              : <span style={{ width: 76, height: 76, borderRadius: 12, background: '#f1f1ec', display: 'grid', placeItems: 'center', fontSize: 34, flex: 'none' }}>{ITEM_LABEL[l.category][2]}</span>}
            <span className="stack grow" style={{ minWidth: 0 }}>
              <span className="row" style={{ gap: 6 }}>
                <span className={l.kind === 'buy' ? 'badge warn' : 'badge'}>{pair(KIND_LABEL[l.kind])}</span>
                <span className="muted small">{lang === 'ml' ? ITEM_LABEL[l.category][0] : ITEM_LABEL[l.category][1]}</span>
              </span>
              <b style={{ fontSize: 16 }}>{l.title}</b>
              <b style={{ color: 'var(--green-dark)' }}>{priceText(l, L)}</b>
              {l.note && <span className="small">{l.note}</span>}
              <span className="row small" style={{ gap: 8 }}><StatStars s={stats[l.sellerUid]} /><NearTag same={same} d={d} /></span>
              <span className="muted small">{l.sellerName}{l.ward ? ` · ${wardLabel(villages.find((v) => v.id === l.villageId), l.ward, lang)}` : ''} · {timeAgo(l.createdAt, lang)}</span>
            </span>
          </div>
          <div className="spacer" />
          <CallWhatsApp phone={l.phone} text={L(`നമസ്കാരം, ഗ്രാമസേവയിൽ "${l.title}" കണ്ടു.`, `Hello, I saw "${l.title}" on Gramaseva.`)} />
          {l.kind !== 'buy' && <><div className="spacer" /><OrderButton to={l.sellerUid} kind="listing" listingId={l.id} label={l.kind === 'rent' ? L('വാടകയ്ക്ക് ചോദിക്കുക', 'Ask to rent') : L('ഓർഡർ ചെയ്യുക', 'Order')} /></>}
        </div>
      ))}
      {list && rows.length === 0 && (
        <Empty icon={<ShoppingBasket size={28} />} text={L('ഇവിടെ ഇതുവരെ ഒന്നുമില്ല. നിങ്ങൾക്ക് വിൽക്കാനുള്ളത് ചേർക്കൂ.', 'Nothing here yet. Add something you sell.')}>
          <Link to="/market/sell" className="btn">{L('ചേർക്കുക', 'Add')}</Link>
        </Empty>
      )}
    </Screen>
  );
}

/** The seller record for the signed-in user, creating it (with the free period) on first use. */
async function ensureSeller(api: ReturnType<typeof useApp>['api'], profile: NonNullable<ReturnType<typeof useApp>['profile']>): Promise<Seller> {
  const s = await api.getSeller(profile.uid);
  if (s) return s;
  const pay = await api.getPaySettings();
  const now = Date.now();
  const ns: Seller = { uid: profile.uid, name: profile.name, phone: profile.phone, villageId: profile.villageId, freeUntil: now + Math.min(30, pay.freeDays) * 86400000, paidUntil: 0, createdAt: now };
  await api.createSeller(ns);
  return ns;
}

export function SellForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const { api, profile, provider, village, homeVillage, lang, L, pair, toast } = useApp();
  const home = homeVillage ?? village;
  const [l, setL] = useState<Omit<Listing, 'id'> | null>(null);
  const [seller] = useLoad(async () => {
    if (!profile) return null;
    if (id) {
      const mine = (await api.listMyListings(profile.uid)).find((x) => x.id === id);
      if (mine) { const { id: _i, ...rest } = mine; void _i; setL(rest); }
    } else {
      setL({ villageId: profile.villageId, sellerUid: profile.uid, sellerName: profile.name, phone: profile.phone, ...(profile.ward ? { ward: profile.ward } : {}), kind: 'sell', category: 'milk', title: '', price: 0, unit: 'ലിറ്റർ', active: true, inStock: true,
        ...(provider?.shopName ? { shopName: provider.shopName } : {}), ...(provider ? { lat: provider.lat, lng: provider.lng } : profile.pinLat != null ? { lat: profile.pinLat, lng: profile.pinLng } : {}),
        ...(profile.pincode ? { pincode: profile.pincode } : {}), createdAt: Date.now() });
    }
    return api.getSeller(profile.uid);
  }, [id ?? '']);
  const [busy, setBusy] = useState(false);
  const pay = usePay();
  if (!profile || !l) return <Screen title={L('സാധനം ചേർക്കുക', 'Add an item')}><Loading /></Screen>;
  const set = <K extends keyof typeof l>(k: K, v: (typeof l)[K]) => setL({ ...l, [k]: v });
  const active = seller === null || sellerActive(seller); // new sellers start free
  const play = isPlayApp();

  async function save() {
    if (!profile || !l || busy) return;
    setBusy(true);
    try {
      const s = await ensureSeller(api, profile);
      const clean = { ...l, title: l.title.trim(), note: l.note?.trim() || undefined };
      if (!clean.note) delete clean.note;
      if (!clean.photo) delete clean.photo;
      if (!clean.ward) delete clean.ward;
      await api.saveListing({ ...clean, ...(id ? { id } : {}) });
      toast(sellerActive(s) ? L('സേവ് ചെയ്തു — എല്ലാവർക്കും കാണാം', 'Saved — everyone can see it') : L('സേവ് ചെയ്തു. പുതുക്കിയാൽ എല്ലാവർക്കും കാണാം.', 'Saved. Everyone sees it once renewed.'));
      nav('/market/my', { replace: true });
    } catch (e) { console.error(e); toast(L('സേവ് ചെയ്യാൻ പറ്റിയില്ല', "Couldn't save")); } finally { setBusy(false); }
  }

  return (
    <Screen title={id ? L('മാറ്റം വരുത്തുക', 'Edit item') : L('സാധനം ചേർക്കുക', 'Add an item')}>
      {seller === null && <div className="notice">{play ? L(`ആദ്യ ${pay.freeDays} ദിവസം free!`, `First ${pay.freeDays} days free!`) : L(`ആദ്യ ${pay.freeDays} ദിവസം free! പിന്നീട് ആഴ്ചയിൽ ₹${pay.sellerFee} മാത്രം.`, `First ${pay.freeDays} days free! Then only ₹${pay.sellerFee} a week.`)}</div>}
      {seller && !active && <div className="notice warn">{L('നിങ്ങളുടെ free / പണമടച്ച സമയം കഴിഞ്ഞു. പുതുക്കിയാൽ മാത്രം മറ്റുള്ളവർക്ക് കാണാം.', 'Your free / paid time is over. Others see your items again once it is renewed.')} {play ? L('പുതുക്കാൻ Gramaseva പ്രതിനിധിയെ നേരിട്ട് കാണുക.', 'Meet a Gramaseva representative in person to renew.') : <Link className="link" to="/pay?for=seller">{L('Pay ചെയ്യുക', 'Pay')}</Link>}</div>}
      <label>{L('എന്ത് ചെയ്യാനാണ്?', 'What do you want to do?')}</label>
      <div className="chips">{LISTING_KINDS.map((k) => <button key={k} className={'chip' + (l.kind === k ? ' on' : '')} onClick={() => set('kind', k)}>{pair(KIND_LABEL[k])}</button>)}</div>
      <label htmlFor="cat">{L('വിഭാഗം', 'Category')}</label>
      <select id="cat" className="input" value={l.category} onChange={(e) => set('category', e.target.value as ListingCat)}>
        {LISTING_CATS.map((c) => <option key={c} value={c}>{ITEM_LABEL[c][2]} {lang === 'ml' ? ITEM_LABEL[c][0] : ITEM_LABEL[c][1]}</option>)}
      </select>
      <label htmlFor="title">{L('എന്താണ്? (ചെറുതായി)', 'What is it? (short)')}</label>
      <input id="title" className="input" maxLength={80} value={l.title} onChange={(e) => set('title', e.target.value)} placeholder={L('ഉദാ: നാടൻ പശുവിൻ പാൽ / കസേര 50 എണ്ണം', 'e.g. Fresh cow milk / 50 chairs')} />
      <div className="row nowrap">
        <span className="grow stack"><label htmlFor="price">{L('വില ₹ (0 = ചോദിക്കുക)', 'Price ₹ (0 = ask)')}</label>
          <input id="price" className="input" inputMode="numeric" value={l.price || ''} onChange={(e) => set('price', Number(e.target.value.replace(/\D/g, '')) || 0)} /></span>
        <span className="grow stack"><label htmlFor="unit">{L('ഓരോ', 'Per')}</label>
          <select id="unit" className="input" value={l.unit ?? ''} onChange={(e) => set('unit', e.target.value)}>
            <option value="">—</option>
            {UNITS.map(([ml, en]) => <option key={ml} value={lang === 'ml' ? ml : en}>{lang === 'ml' ? ml : en}</option>)}
          </select></span>
      </div>
      <label htmlFor="note">{L('കൂടുതൽ വിവരം (വേണമെങ്കിൽ)', 'More details (optional)')}</label>
      <textarea id="note" className="input" rows={3} maxLength={300} value={l.note ?? ''} onChange={(e) => set('note', e.target.value)} placeholder={L('ഉദാ: രാവിലെ 7 മണിക്ക് വീട്ടിൽ എത്തിക്കും', 'e.g. Delivered home at 7 am')} />
      {(home?.wards?.length ?? 0) > 0 && (<>
        <label htmlFor="ward">{L('വാർഡ്', 'Ward')}</label>
        <select id="ward" className="input" value={l.ward ?? ''} onChange={(e) => set('ward', e.target.value)}>
          <option value="">—</option>
          {sortedWards(home, lang).map((w) => <option key={w.no} value={String(w.no)}>{lang === 'ml' ? w.name : w.nameEn}</option>)}
        </select>
      </>)}
      <label className="btn outline">
        <Camera size={18} aria-hidden /> {l.photo ? L('ഫോട്ടോ മാറ്റുക', 'Change photo') : L('ഫോട്ടോ ചേർക്കുക (വേണമെങ്കിൽ)', 'Add a photo (optional)')}
        <input type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) set('photo', await compressImage(f, 480, 0.55)); }} />
      </label>
      {l.photo && <img src={l.photo} alt="" style={{ width: '100%', borderRadius: 12 }} />}
      {l.kind === 'sell' && (<>
        <label>{L('സ്റ്റോക്ക്', 'Stock')}</label>
        <div className="chips">
          <button className={'chip' + (l.inStock !== false ? ' on' : '')} onClick={() => set('inStock', true)}>{L('ഉണ്ട്', 'In stock')}</button>
          <button className={'chip' + (l.inStock === false ? ' on' : '')} onClick={() => set('inStock', false)}>{L('തീർന്നു', 'Out of stock')}</button>
        </div>
        <button className="btn outline" onClick={async () => { try { const p = await getPosition(); setL({ ...l, lat: p.lat, lng: p.lng }); toast(L('Location ചേർത്തു', 'Location added')); } catch { toast(L('Location കിട്ടിയില്ല', "Couldn't get location")); } }}>
          📍 {l.lat != null ? L('സാധനം എടുക്കേണ്ട location ഉണ്ട് ✓ (വീണ്ടും എടുക്കുക)', 'Pick-up location set ✓ (take again)') : L('സാധനം എടുക്കേണ്ട സ്ഥലത്തെ location ചേർക്കുക (ഡെലിവറി ചാർജിന്)', 'Add the pick-up location (for the delivery charge)')}
        </button>
        {l.price > 0 && <p className="muted small">{L('വില ചേർത്താൽ ഈ സാധനം "കട" ഭാഗത്ത് cart-ൽ ചേർത്ത് ഓർഡർ ചെയ്യാൻ പറ്റും.', 'With a price, this item appears in the Shop where people add it to a cart and order.')}</p>}
      </>)}
      <button className="btn block" disabled={busy || l.title.trim().length < 2} onClick={save}>{L('സേവ് ചെയ്യുക', 'Save')}</button>
      <p className="muted small">{L('നിങ്ങളുടെ പേരും ഫോൺ നമ്പറും ഈ പരസ്യത്തോടൊപ്പം എല്ലാവർക്കും കാണാം.', 'Your name and phone number are shown with this item to everyone.')}</p>
    </Screen>
  );
}

const sellerStatus = (s: Seller | null, L: (a: string, b: string) => string, lang: 'ml' | 'en') => {
  if (!s) return L('ഇതുവരെ ഒന്നും ചേർത്തിട്ടില്ല. തുടക്കത്തിൽ free.', 'Nothing added yet. It starts free.');
  const until = Math.max(s.freeUntil, s.paidUntil);
  const d = prettyDate(new Date(until).toISOString().slice(0, 10), lang);
  if (until <= Date.now()) return L(`സമയം കഴിഞ്ഞു (${d}). ആഴ്ച fee അടയ്ക്കുക.`, `Expired on ${d}. Please pay the weekly fee.`);
  return s.paidUntil > s.freeUntil ? L(`പണമടച്ചു — ${d} വരെ`, `Paid until ${d}`) : L(`Free — ${d} വരെ`, `Free until ${d}`);
};

/** The user's own items, seller status, ads and payments. */
export function MyMarket() {
  const nav = useNavigate();
  const { api, profile, lang, L, pair, toast } = useApp();
  const [data, reload, err] = useLoad(async () => {
    if (!profile) return null;
    const [seller, items, ads, pays] = await Promise.all([api.getSeller(profile.uid), api.listMyListings(profile.uid), api.listMyAds(profile.uid), api.listMyPayments(profile.uid)]);
    return { seller, items, ads, pays };
  }, [profile?.uid ?? '']);
  const pay = usePay();
  if (!profile) return null;
  const active = sellerActive(data?.seller);
  const play = isPlayApp();
  const pendingSeller = data?.pays.some((p) => p.purpose === 'seller' && p.status === 'pending');

  return (
    <Screen title={L('എന്റെ കട', 'My shop')} sub={L('എന്റെ സാധനങ്ങൾ, പരസ്യം, ഡെലിവറി ബോയ്സ്', 'My items, ads, delivery people')}>
      {err && <LoadError retry={reload} />}
      {!data && !err && <Loading />}
      {data && (<>
        <div className="grid2">
          <Link to="/market/sell" className="btn block">+ {L('സാധനം ചേർക്കുക', 'Add item')}</Link>
          <Link to="/orders" className="btn block outline">🛒 {L('ഓർഡറുകൾ', 'Orders')}</Link>
        </div>
        <div className="card" style={{ display: 'block' }}>
          <b>{play ? L('വിൽപ്പന കാലാവധി', 'Selling period') : L(`വിൽപ്പനക്കാരൻ — ആഴ്ച ₹${pay.sellerFee}`, `Seller — ₹${pay.sellerFee} a week`)}</b>
          <p className={active ? 'small' : 'small'} style={{ color: active ? 'var(--green-dark)' : 'var(--red)', margin: '4px 0 8px' }}>{sellerStatus(data.seller, L, lang)}</p>
          {pendingSeller && <div className="notice warn">{L('നിങ്ങളുടെ payment പരിശോധിക്കുകയാണ്.', 'Your payment is being checked.')}</div>}
          {data.seller && play && !active && <p className="small muted">{L('പുതുക്കാൻ Gramaseva പ്രതിനിധിയെ നേരിട്ട് കാണുക.', 'Meet a Gramaseva representative in person to renew.')}</p>}
          {data.seller && !play && <Link to="/pay?for=seller" className="btn outline block"><Wallet size={18} aria-hidden /> {L('ആഴ്ച fee അടയ്ക്കുക', 'Pay weekly fee')}</Link>}
        </div>

        <div className="row between"><span className="section">{L('എന്റെ സാധനങ്ങൾ', 'My items')}</span><Link to="/market/sell" className="link">+ {L('ചേർക്കുക', 'Add')}</Link></div>
        {data.items.length === 0 && <p className="muted small">{L('ഒന്നും ചേർത്തിട്ടില്ല.', 'Nothing added yet.')}</p>}
        {data.items.map((l) => (
          <div key={l.id} className="card" style={{ flexWrap: 'wrap' }}>
            <span style={{ fontSize: 28 }}>{ITEM_LABEL[l.category][2]}</span>
            <span className="stack grow" style={{ minWidth: 0 }}>
              <b>{l.title}</b>
              <span className="muted small">{pair(KIND_LABEL[l.kind])} · {priceText(l, L)}</span>
              <span className="small" style={{ color: l.active && active ? 'var(--green-dark)' : 'var(--muted)' }}>
                {!l.active ? L('മറച്ചിരിക്കുന്നു', 'Hidden') : active ? L('എല്ലാവർക്കും കാണാം', 'Visible to everyone') : L('Fee അടച്ചാൽ കാണാം', 'Visible after paying')}
              </span>
            </span>
            <button className="btn sm outline" onClick={async () => { await api.saveListing({ ...l, active: !l.active }); reload(); }}>{l.active ? L('മറയ്ക്കുക', 'Hide') : L('കാണിക്കുക', 'Show')}</button>
            <button className="iconbtn" aria-label={L('മാറ്റുക', 'Edit')} onClick={() => nav(`/market/edit/${l.id}`)}><Pencil size={18} /></button>
            <button className="btn sm danger" aria-label={L('നീക്കം ചെയ്യുക', 'Remove')} onClick={async () => { if (confirm(L(`"${l.title}" നീക്കം ചെയ്യണോ? ഇത് ഇനി ആർക്കും കാണില്ല.`, `Remove "${l.title}"? Nobody will see it any more.`))) { await api.deleteListing(l.id); toast(L('സാധനം നീക്കം ചെയ്തു', 'Item removed')); reload(); } }}><Trash2 size={16} aria-hidden /> {L('നീക്കുക', 'Remove')}</button>
          </div>
        ))}

        <MyDeliveryBoys />

        <div className="row between"><span className="section">{L('എന്റെ പരസ്യങ്ങൾ (കടകൾക്ക്)', 'My ads (for shops)')}</span><Link to="/ads/new" className="link">+ {L('പരസ്യം', 'Ad')}</Link></div>
        {data.ads.length === 0 && <p className="muted small">{play ? L('കടയുടെ പരസ്യം home screen-ൽ എല്ലാവർക്കും കാണിക്കാം.', 'Show your shop ad on everyone\'s home screen.') : L(`കടയുടെ പരസ്യം home screen-ൽ എല്ലാവർക്കും കാണിക്കാം — ആഴ്ചയിൽ ₹${pay.adFee}.`, `Show your shop ad on everyone's home screen — ₹${pay.adFee} a week.`)}</p>}
        {data.ads.map((a) => <AdRow key={a.id} a={a} pays={data.pays} reload={reload} />)}

        {data.pays.length > 0 && <span className="section">{L('എന്റെ payments', 'My payments')}</span>}
        {data.pays.map((p) => <PayRow key={p.id} p={p} />)}
      </>)}
    </Screen>
  );
}

/** Delivery people who joined (approved by the owner) near this shop — newest first, with call buttons. */
function MyDeliveryBoys() {
  const { api, reachIds, villages, lang, L } = useApp();
  const [list, reload, err] = useLoad(() => api.listDeliveryBoys(reachIds), [reachIds.join(',')]);
  const active = (list ?? []).filter((b) => boyActive(b)).sort((a, b) => Number(b.available) - Number(a.available) || b.createdAt - a.createdAt);
  const waiting = (list ?? []).filter((b) => b.status === 'pending').length;
  return (<>
    <div className="row between"><span className="section">🛵 {L('ചേർന്ന ഡെലിവറി ബോയ്സ്', 'Delivery people who joined')} {list ? `(${active.length})` : ''}</span><Link to="/delivery/boys" className="link small">{L('എല്ലാം ›', 'All ›')}</Link></div>
    {err && <LoadError retry={reload} />}
    {list && active.length === 0 && <p className="muted small">{L('ഇതുവരെ ആരും ചേർന്നിട്ടില്ല. ആരെങ്കിലും ചേർന്ന് approve ആയാൽ ഇവിടെ കാണും.', 'Nobody has joined yet. They show here once approved.')}</p>}
    {waiting > 0 && <p className="muted small">{L(`${waiting} പേർ കൂടി approval കാത്തിരിക്കുന്നു.`, `${waiting} more waiting for approval.`)}</p>}
    {active.slice(0, 6).map((b) => (
      <div key={b.uid} className="card" style={{ display: 'block' }}>
        <div className="row between nowrap">
          <b>{b.name}{Date.now() - b.createdAt < 7 * 86400000 && <span className="badge warn" style={{ marginLeft: 6 }}>{L('പുതിയത്', 'New')}</span>}</b>
          <span className={b.available ? 'badge' : 'badge grey'}>{b.available ? L('ലഭ്യം', 'Available') : L('ഓഫ്', 'Off')}</span>
        </div>
        <div className="small muted">{wardLabel(villages.find((v) => v.id === b.villageId), b.ward ?? '', lang) || ''}{b.area ? ` · ${b.area}` : ''}</div>
        <div className="row" style={{ marginTop: 8 }}>
          <a className="btn sm" href={telHref(b.phone)}><Phone size={16} aria-hidden /> {L('വിളിക്കുക', 'Call')}</a>
        </div>
      </div>
    ))}
  </>);
}

function AdRow({ a, pays, reload }: { a: Ad; pays: Payment[]; reload: () => void }) {
  const { api, lang, L, toast } = useApp();
  const live = a.status === 'live' && a.until > Date.now();
  const waiting = pays.some((p) => p.adId === a.id && p.status === 'pending');
  const play = isPlayApp();
  return (
    <div className="card">
      <Megaphone size={24} color="var(--green)" aria-hidden />
      <span className="stack grow" style={{ minWidth: 0 }}>
        <b>{a.title}</b>
        <span className="small" style={{ color: live ? 'var(--green-dark)' : 'var(--muted)' }}>
          {live ? L(`Live — ${prettyDate(new Date(a.until).toISOString().slice(0, 10), lang)} വരെ`, `Live until ${prettyDate(new Date(a.until).toISOString().slice(0, 10), lang)}`)
            : waiting ? L('Payment പരിശോധിക്കുകയാണ്', 'Payment being checked')
            : a.status === 'rejected' ? L('നിരസിച്ചു', 'Rejected') : play ? L('Gramaseva team ബന്ധപ്പെട്ട ശേഷം live ആകും', 'Goes live after the Gramaseva team contacts you') : L('Pay ചെയ്താൽ live ആകും', 'Goes live after payment')}
        </span>
      </span>
      {!waiting && !play && <Link className="btn sm" to={`/pay?for=ad&id=${a.id}`}>{live ? L('നീട്ടുക', 'Extend') : 'Pay'}</Link>}
      <button className="iconbtn" aria-label={L('ഡിലീറ്റ്', 'Delete')} onClick={async () => { if (confirm(L('ഡിലീറ്റ് ചെയ്യണോ?', 'Delete this?'))) { await api.deleteAd(a.id); toast(L('ഡിലീറ്റ് ചെയ്തു', 'Deleted')); reload(); } }}><Trash2 size={18} /></button>
    </div>
  );
}

export function PayRow({ p, extra }: { p: Payment; extra?: React.ReactNode }) {
  const { lang, L } = useApp();
  const badge = p.status === 'approved' ? 'badge' : p.status === 'pending' ? 'badge warn' : 'badge bad';
  return (
    <div className="card">
      <span className="stack grow" style={{ minWidth: 0 }}>
        <b>{rupees(p.amount)} · {p.purpose === 'seller' ? L('വിൽപ്പന fee', 'Seller fee') : L('പരസ്യം', 'Ad')} · {p.weeks} {L('ആഴ്ച', p.weeks > 1 ? 'weeks' : 'week')}</b>
        <span className="muted small">UTR: {p.utr} · {timeAgo(p.createdAt, lang)}</span>
        {extra}
      </span>
      <span className={badge}>{p.status === 'approved' ? L('ശരിയായി', 'Approved') : p.status === 'pending' ? L('പരിശോധനയിൽ', 'Pending') : L('നിരസിച്ചു', 'Rejected')}</span>
    </div>
  );
}

export function AdForm() {
  const nav = useNavigate();
  const { api, profile, provider, L, toast } = useApp();
  const [a, setA] = useState({ name: provider?.shopName ?? '', title: '', text: '', photo: '' });
  const [busy, setBusy] = useState(false);
  const play = isPlayApp();
  const pay = usePay();
  if (!profile) return null;
  async function save() {
    if (!profile || busy) return;
    setBusy(true);
    try {
      const id = await api.createAd({
        villageId: profile.villageId, uid: profile.uid, name: a.name.trim(), phone: profile.phone, title: a.title.trim(), text: a.text.trim(),
        ...(a.photo ? { photo: a.photo } : {}), status: 'pending', until: 0, createdAt: Date.now(),
      });
      if (play) toast(L('പരസ്യം സേവ് ചെയ്തു. Gramaseva team ബന്ധപ്പെടും.', 'Ad saved. The Gramaseva team will contact you.'));
      nav(play ? '/market/my' : `/pay?for=ad&id=${id}`, { replace: true });
    } catch (e) { console.error(e); toast(L('സേവ് ചെയ്യാൻ പറ്റിയില്ല', "Couldn't save")); } finally { setBusy(false); }
  }
  return (
    <Screen title={L('കടയുടെ പരസ്യം', 'Shop advertisement')}>
      <div className="notice">{play ? L('പരസ്യം എല്ലാവരുടെയും home screen-ൽ കാണിക്കും. Gramaseva team ബന്ധപ്പെട്ട് ഉറപ്പാക്കിയാൽ live ആകും.', "Your ad shows on everyone's home screen. It goes live once the Gramaseva team contacts you and confirms.")
        : L(`പരസ്യം എല്ലാവരുടെയും home screen-ൽ കാണിക്കും. ആഴ്ചയിൽ ₹${pay.adFee}. Pay ചെയ്ത് admin ശരിയാക്കിയാൽ live ആകും.`, `Your ad shows on everyone's home screen. ₹${pay.adFee} a week. It goes live once you pay and the admin confirms.`)}</div>
      <label htmlFor="an">{L('കടയുടെ പേര്', 'Shop name')}</label>
      <input id="an" className="input" maxLength={60} value={a.name} onChange={(e) => setA({ ...a, name: e.target.value })} />
      <label htmlFor="at">{L('തലക്കെട്ട്', 'Headline')}</label>
      <input id="at" className="input" maxLength={70} value={a.title} onChange={(e) => setA({ ...a, title: e.target.value })} placeholder={L('ഉദാ: ഓണം ഓഫർ — എല്ലാ തുണിക്കും 20% കിഴിവ്', 'e.g. Onam offer — 20% off on all clothes')} />
      <label htmlFor="ax">{L('വിവരം', 'Details')}</label>
      <textarea id="ax" className="input" rows={3} maxLength={250} value={a.text} onChange={(e) => setA({ ...a, text: e.target.value })} />
      <label className="btn outline">
        <Camera size={18} aria-hidden /> {a.photo ? L('ഫോട്ടോ മാറ്റുക', 'Change photo') : L('ഫോട്ടോ / poster ചേർക്കുക', 'Add a photo / poster')}
        <input type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) setA({ ...a, photo: await compressImage(f, 720, 0.58) }); }} />
      </label>
      {a.photo && <img src={a.photo} alt="" style={{ width: '100%', borderRadius: 12 }} />}
      <button className="btn block" disabled={busy || a.name.trim().length < 2 || a.title.trim().length < 3} onClick={save}>{play ? L('സേവ് ചെയ്യുക', 'Save') : L('തുടരുക — Pay ചെയ്യാൻ', 'Continue to payment')}</button>
    </Screen>
  );
}

/** UPI payment: open the UPI app with the amount filled in, then type the transaction id (UTR) so the owner can check it. */
export function Pay() {
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const { api, profile, L, toast } = useApp();
  const purpose = sp.get('for') === 'ad' ? 'ad' : sp.get('for') === 'delivery' ? 'delivery' : 'seller';
  const adId = sp.get('id') ?? '';
  const [settings] = useLoad(() => api.getPaySettings(), []);
  const [weeks, setWeeks] = useState(purpose === 'ad' ? 1 : 4);
  const [utr, setUtr] = useState('');
  const [busy, setBusy] = useState(false);
  if (!profile) return null;
  if (isPlayApp()) return <Screen title="Pay"><div className="notice">{L('ഈ app-ൽ നിന്ന് പണമടയ്ക്കാൻ പറ്റില്ല.', 'Payments are not available in this app.')}</div></Screen>;
  if (!settings) return <Screen title="Pay"><Loading /></Screen>;
  const fee = purpose === 'ad' ? settings.adFee : purpose === 'delivery' ? settings.deliveryFee : settings.sellerFee;
  const amount = fee * weeks;
  const note = `Gramaseva ${purpose} ${weeks}w`;
  const upi = `upi://pay?pa=${encodeURIComponent(settings.upiId)}&pn=${encodeURIComponent(settings.payeeName)}&am=${amount}.00&cu=INR&tn=${encodeURIComponent(note)}`;
  const utrOk = /^[A-Za-z0-9]{6,40}$/.test(utr.trim());

  async function submit() {
    if (!profile || busy) return;
    setBusy(true);
    try {
      await api.createPayment({
        uid: profile.uid, name: profile.name, phone: profile.phone, villageId: profile.villageId, purpose, ...(purpose === 'ad' ? { adId } : {}),
        weeks, amount, utr: utr.trim(), status: 'pending', createdAt: Date.now(),
      });
      toast(L('നന്ദി! Payment പരിശോധിച്ച ശേഷം active ആകും.', 'Thank you! It becomes active once the payment is checked.'));
      nav(purpose === 'delivery' ? '/delivery' : '/market/my', { replace: true });
    } catch (e) { console.error(e); toast(L('അയയ്ക്കാൻ പറ്റിയില്ല. Fee മാറിയിരിക്കാം — page വീണ്ടും തുറക്കുക.', "Couldn't send. The fee may have changed — reopen this page.")); } finally { setBusy(false); }
  }

  return (
    <Screen title={purpose === 'ad' ? L('പരസ്യത്തിന് Pay ചെയ്യുക', 'Pay for the ad') : purpose === 'delivery' ? L('ഡെലിവറി fee അടയ്ക്കുക', 'Pay the delivery fee') : L('വിൽപ്പന fee അടയ്ക്കുക', 'Pay the seller fee')}>
      {!settings.upiId ? <div className="notice bad">{L('Admin ഇതുവരെ UPI ID ചേർത്തിട്ടില്ല. കുറച്ചു കഴിഞ്ഞ് ശ്രമിക്കുക.', "The admin hasn't added a UPI ID yet. Please try later.")}</div> : (<>
        <label>{L('എത്ര ആഴ്ചത്തേക്ക്?', 'For how many weeks?')}</label>
        <div className="chips">{(purpose === 'ad' ? [1, 2, 4] : [1, 4, 12]).map((w) => (
          <button key={w} className={'chip' + (weeks === w ? ' on' : '')} onClick={() => setWeeks(w)}>{w} {L('ആഴ്ച', w > 1 ? 'weeks' : 'week')} · {rupees(fee * w)}</button>
        ))}</div>
        <div className="card" style={{ display: 'block', textAlign: 'center' }}>
          <div className="muted small">{L('അടയ്ക്കേണ്ടത്', 'Amount')}</div>
          <div style={{ fontSize: 34, fontWeight: 700 }}>{rupees(amount)}</div>
          <div className="small">UPI: <b>{settings.upiId}</b> <button className="link" onClick={() => { void navigator.clipboard?.writeText(settings.upiId); toast(L('Copy ചെയ്തു', 'Copied')); }}><Copy size={14} aria-hidden /> Copy</button></div>
        </div>
        <a className="btn block" href={upi}>{L('1. GPay / PhonePe / Paytm-ൽ Pay ചെയ്യുക', '1. Pay with GPay / PhonePe / Paytm')}</a>
        <label htmlFor="utr">{L('2. Pay ചെയ്ത ശേഷം UPI Transaction ID / UTR (12 അക്കം) ഇവിടെ നൽകുക', '2. After paying, enter the UPI transaction ID / UTR (12 digits)')}</label>
        <input id="utr" className="input" value={utr} onChange={(e) => setUtr(e.target.value.replace(/\s/g, ''))} placeholder="ഉദാ: 432112345678" />
        <button className="btn block" disabled={busy || !utrOk} onClick={submit}>{L('3. അയയ്ക്കുക', '3. Send')}</button>
        <p className="muted small">{L('Admin bank-ൽ പരിശോധിച്ച് ശരിയാക്കിയാൽ ഉടൻ active ആകും. തെറ്റായ ID നൽകിയാൽ നിരസിക്കും.', 'Active as soon as the admin checks it in the bank. Wrong IDs are rejected.')}</p>
      </>)}
    </Screen>
  );
}

/** Live shop ads on the home screen. */
export function AdStrip() {
  const { api, reachIds, L } = useApp();
  const [ads] = useLoad(() => api.listLiveAds(reachIds), [reachIds.join(',')]);
  if (!ads?.length) return null;
  return (
    <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4, scrollSnapType: 'x mandatory' }}>
      {ads.slice(0, 8).map((a) => (
        <div key={a.id} className="card" style={{ display: 'block', minWidth: '85%', scrollSnapAlign: 'start', padding: 0, overflow: 'hidden' }}>
          {a.photo && <img src={a.photo} alt="" style={{ width: '100%', maxHeight: 170, objectFit: 'cover', display: 'block' }} />}
          <div style={{ padding: 12 }}>
            <span className="badge grey">{L('പരസ്യം', 'Ad')}</span> <b>{a.name}</b>
            <div style={{ fontWeight: 700, margin: '4px 0' }}>{a.title}</div>
            {a.text && <div className="small">{a.text}</div>}
            <div className="spacer" />
            <CallWhatsApp phone={a.phone} text={L(`നമസ്കാരം, ഗ്രാമസേവയിൽ നിങ്ങളുടെ പരസ്യം കണ്ടു: ${a.title}`, `Hello, I saw your ad on Gramaseva: ${a.title}`)} />
          </div>
        </div>
      ))}
    </div>
  );
}

export const weeksLeft = (until: number) => Math.max(0, Math.ceil((until - Date.now()) / WEEK));
