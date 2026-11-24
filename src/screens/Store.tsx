import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MapPin, Minus, Plus, Search, ShoppingCart, Store as StoreIcon, Trash2, Truck } from 'lucide-react';
import { useApp, useLoad } from '../lib/app';
import { BottomNav, Empty, LoadError, Loading, Screen } from '../components/ui';
import { HomeLocation } from '../components/HomeLocation';
import { km } from '../lib/util';
import { LISTING_CATS, ORDER_FREQS, deliveryCharge, sellerActive, type Listing, type ListingCat, type OrderFreq } from '../types';
import { ITEM_LABEL, usePay } from './Market';
import { FREQ_LABEL } from './Orders';

// ---------- Cart (one shop / seller at a time, kept on this phone) ----------
export interface CartLine { id: string; title: string; price: number; unit?: string; qty: number; photo?: string; daily: boolean }
export interface Cart { sellerUid: string; sellerName: string; phone: string; villageId: string; lat?: number; lng?: number; lines: CartLine[] }
const CART_KEY = 'gs-cart';
const readCart = (): Cart | null => { try { return JSON.parse(localStorage.getItem(CART_KEY) ?? 'null'); } catch { return null; } };
const writeCart = (c: Cart | null) => { try { if (c && c.lines.length) localStorage.setItem(CART_KEY, JSON.stringify(c)); else localStorage.removeItem(CART_KEY); } catch { /* ignore */ } };
const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;

function useCart() {
  const [cart, set] = useState<Cart | null>(readCart);
  const save = (c: Cart | null) => { writeCart(c); set(c && c.lines.length ? c : null); };
  return [cart, save] as const;
}

/** Cart state + add / remove one item (shared by the shop and the home screen). */
export function useCartAdd() {
  const { L } = useApp();
  const [cart, saveCart] = useCart();
  const qtyOf = (id: string) => cart?.lines.find((x) => x.id === id)?.qty ?? 0;
  const count = cart?.lines.reduce((t, x) => t + x.qty, 0) ?? 0;
  const total = cart?.lines.reduce((t, x) => t + x.qty * x.price, 0) ?? 0;
  function add(l: Listing, d: number) {
    let c = cart;
    if (c && c.sellerUid !== l.sellerUid) {
      if (!confirm(L(`Cart-ൽ ${c.sellerName}-ന്റെ സാധനങ്ങൾ ഉണ്ട്. ഒരു ഓർഡറിൽ ഒരു കടയിൽ നിന്ന് മാത്രം. പഴയത് മാറ്റി ഇത് ചേർക്കട്ടെ?`, `Your cart has items from ${c.sellerName}. One order = one shop. Replace them?`))) return;
      c = null;
    }
    const base: Cart = c ?? { sellerUid: l.sellerUid, sellerName: l.shopName || l.sellerName, phone: l.phone, villageId: l.villageId, ...(l.lat != null ? { lat: l.lat, lng: l.lng } : {}), lines: [] };
    const has = base.lines.find((x) => x.id === l.id);
    const lines = has
      ? base.lines.map((x) => (x.id === l.id ? { ...x, qty: Math.max(0, Math.min(99, x.qty + d)) } : x)).filter((x) => x.qty > 0)
      : d > 0 ? [...base.lines, { id: l.id, title: l.title, price: l.price, ...(l.unit ? { unit: l.unit } : {}), qty: 1, ...(l.photo ? { photo: l.photo } : {}), daily: l.category === 'milk' || l.category === 'egg' }] : base.lines;
    saveCart({ ...base, lines });
  }
  return { cart, qtyOf, count, total, add };
}

/** Products that can be bought now: priced "sell" items from sellers whose period is active. */
export async function loadProducts(api: ReturnType<typeof useApp>['api'], reachIds: string[]) {
  const all = (await api.listListings(reachIds)).filter((l) => l.kind === 'sell' && l.price > 0 && l.active !== false);
  const sellers = await api.listSellers([...new Set(all.map((l) => l.sellerUid))]);
  const ok = new Set(sellers.filter((s) => sellerActive(s)).map((s) => s.uid));
  return all.filter((l) => ok.has(l.sellerUid));
}

/** Blinkit-style product card. The seller sees "Remove" on their own item instead of ADD. */
export function ProductCard({ l, qty, onAdd, onRemoved, width }: { l: Listing; qty: number; onAdd: (d: number) => void; onRemoved?: () => void; width?: number }) {
  const { api, profile, villages, L, toast } = useApp();
  const out = l.inStock === false;
  const mine = !!profile && l.sellerUid === profile.uid;
  const daily = l.category === 'milk' || l.category === 'egg';
  const v = villages.find((x) => x.id === l.villageId);
  async function remove() {
    if (!confirm(L(`"${l.title}" നീക്കം ചെയ്യണോ? ഇത് ഇനി ആർക്കും കാണില്ല.`, `Remove "${l.title}"? Nobody will see it any more.`))) return;
    await api.deleteListing(l.id);
    toast(L('സാധനം നീക്കം ചെയ്തു', 'Item removed'));
    onRemoved?.();
  }
  return (
    <div className="pcard" style={{ opacity: out ? 0.6 : 1, ...(width ? { width, flex: 'none' } : {}) }}>
      <div className="pimg">
        {l.photo ? <img src={l.photo} alt="" /> : <span aria-hidden>{ITEM_LABEL[l.category][2]}</span>}
        {mine && <span className="ptag mine">{L('എന്റേത്', 'Mine')}</span>}
      </div>
      {daily && <span className="pchip">🕖 {L('ദിവസവും കിട്ടും', 'Daily')}</span>}
      <b className="ptitle">{l.title}</b>
      {l.unit && <span className="muted" style={{ fontSize: 12 }}>{l.unit}</span>}
      <span className="muted" style={{ fontSize: 12 }}>{l.shopName || l.sellerName}{v && !l.shopName ? ` · ${v.name}` : ''}</span>
      <span className="row between nowrap" style={{ marginTop: 'auto', paddingTop: 4 }}>
        <b className="num" style={{ fontSize: 16 }}>{rupees(l.price)}</b>
        {mine ? <button className="addbtn danger" onClick={remove} aria-label={L('നീക്കം ചെയ്യുക', 'Remove')}><Trash2 size={14} aria-hidden /> {L('നീക്കുക', 'Remove')}</button>
          : out ? <span className="badge grey">{L('തീർന്നു', 'Out')}</span>
          : qty === 0 ? <button className="addbtn" onClick={() => onAdd(1)}>{L('ADD', 'ADD')}</button>
          : <span className="stepper">
              <button onClick={() => onAdd(-1)} aria-label="-"><Minus size={14} /></button>
              <b className="num">{qty}</b>
              <button onClick={() => onAdd(1)} aria-label="+"><Plus size={14} /></button>
            </span>}
      </span>
    </div>
  );
}

/** Green bar above the bottom nav: items in the cart and the total. */
export function CartBar({ count, total }: { count: number; total: number }) {
  const nav = useNavigate();
  const { L } = useApp();
  return (
    <div className="cartwrap"><button className="cartbar" onClick={() => nav('/cart')}>
      <ShoppingCart size={22} aria-hidden />
      <span className="grow stack" style={{ gap: 0, textAlign: 'left' }}>
        <b>{L(`${count} സാധനം`, `${count} items`)} · {rupees(total)}</b>
        <span style={{ fontSize: 12, opacity: 0.9 }}>{L('ഡെലിവറി ചാർജ് അടുത്ത പേജിൽ', 'Delivery charge on next page')}</span>
      </span>
      <b>{L('Cart കാണുക', 'View cart')} ›</b>
    </button></div>
  );
}

/** Instamart-style shop: category rail on the left, product grid, cart bar. */
export function Store() {
  const { api, reachIds, village, lang, L } = useApp();
  const { cart, qtyOf, count, total, add } = useCartAdd();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<ListingCat | ''>('');
  const [list, reload, err] = useLoad(() => loadProducts(api, reachIds), [reachIds.join(',')]);
  const rows = useMemo(() => (list ?? []).filter((l) => (!cat || l.category === cat)
    && (!q.trim() || `${l.title} ${l.shopName ?? ''} ${l.sellerName} ${ITEM_LABEL[l.category][0]} ${ITEM_LABEL[l.category][1]}`.toLowerCase().includes(q.trim().toLowerCase()))), [list, cat, q]);
  const cats = LISTING_CATS.filter((c) => c !== 'rental' && (list ?? []).some((l) => l.category === c));

  return (
    <>
      <header className="shophead">
        <div className="row between nowrap">
          <div className="stack" style={{ gap: 0 }}>
            <h1 className="h1">{L('കട', 'Shop')}</h1>
            <span className="small" style={{ color: 'var(--muted)' }}><MapPin size={13} aria-hidden /> {village?.name ?? ''} · {L('നാട്ടിലെ കടകൾ', 'Local shops')}</span>
          </div>
          <Link to="/market/my" className="sellpill"><StoreIcon size={16} aria-hidden /> {L('എന്റെ കട', 'My shop')}</Link>
        </div>
        <label className="searchbar" htmlFor="sq">
          <Search size={20} color="var(--grey)" aria-hidden />
          <input id="sq" value={q} onChange={(e) => setQ(e.target.value)} placeholder={L('പാൽ, മുട്ട, അരി, കേക്ക്…', 'Milk, eggs, rice, cake…')} />
        </label>
      </header>
      <div className="split">
        <nav className="rail" aria-label={L('വിഭാഗങ്ങൾ', 'Categories')}>
          <button className={!cat ? 'on' : ''} onClick={() => setCat('')}><span className="rimg">🛒</span>{L('എല്ലാം', 'All')}</button>
          {cats.map((c) => (
            <button key={c} className={cat === c ? 'on' : ''} onClick={() => setCat(c)}>
              <span className="rimg">{ITEM_LABEL[c][2]}</span>{lang === 'ml' ? ITEM_LABEL[c][0] : ITEM_LABEL[c][1]}
            </button>
          ))}
        </nav>
        <main className="pgrid-wrap">
          {err && <LoadError retry={reload} />}
          {!list && !err && <Loading />}
          <div className="pgrid">
            {rows.map((l) => <ProductCard key={l.id} l={l} qty={qtyOf(l.id)} onAdd={(d) => add(l, d)} onRemoved={reload} />)}
          </div>
          {list && rows.length === 0 && (
            <Empty icon={<ShoppingCart size={28} />} text={L('ഇവിടെ ഇതുവരെ സാധനങ്ങളില്ല. കടക്കാരും വീട്ടിൽ നിന്ന് വിൽക്കുന്നവരും വിലയോടെ ചേർക്കുമ്പോൾ ഇവിടെ വരും.', 'No products yet. They appear here when shops and home sellers add them with a price.')}>
              <Link to="/market/sell" className="btn">{L('ഞാൻ വിൽക്കാം', "I'll sell")}</Link>
            </Empty>
          )}
        </main>
      </div>
      {cart && <CartBar count={count} total={total} />}
      <BottomNav />
    </>
  );
}

/** Cart → bill (goods + delivery charge) → place the order. Payment: cash / UPI on delivery. */
export function CartScreen() {
  const nav = useNavigate();
  const { api, profile, L, pair, toast } = useApp();
  const pay = usePay();
  const [cart, saveCart] = useCart();
  const daily = !!cart?.lines.every((x) => x.daily);
  const [freq, setFreq] = useState<OrderFreq>(daily ? 'daily' : 'once');
  const [delivery, setDelivery] = useState(true);
  const [address, setAddress] = useState(() => { try { return localStorage.getItem('gs-last-address') ?? ''; } catch { return ''; } });
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [note, setNote] = useState('');
  const [loc, setLoc] = useState<{ lat: number; lng: number } | null>(() => { try { return JSON.parse(localStorage.getItem('gs-last-loc') ?? 'null'); } catch { return null; } });
  const [busy, setBusy] = useState(false);
  if (!profile) return null;
  if (!cart) return <Screen title="Cart"><Empty icon={<ShoppingCart size={28} />} text={L('Cart ഒഴിഞ്ഞു കിടക്കുന്നു.', 'Your cart is empty.')}><Link to="/store" className="btn">{L('സാധനങ്ങൾ നോക്കുക', 'Browse products')}</Link></Empty></Screen>;

  const itemsTotal = cart.lines.reduce((t, x) => t + x.qty * x.price, 0);
  const dist = loc && cart.lat != null && cart.lng != null ? km(loc, { lat: cart.lat, lng: cart.lng }) : null;
  const dc = delivery ? deliveryCharge(pay, freq, dist) : { fee: 0, km: null };
  const total = itemsTotal + dc.fee;
  const ok = (!delivery || address.trim().length >= 5) && phone.replace(/\D/g, '').length >= 10 && cart.sellerUid !== profile.uid;
  const set = (id: string, d: number) => saveCart({ ...cart, lines: cart.lines.map((x) => (x.id === id ? { ...x, qty: Math.max(0, Math.min(99, x.qty + d)) } : x)).filter((x) => x.qty > 0) });

  async function place() {
    if (!profile || !cart || busy) return;
    setBusy(true);
    try {
      const now = Date.now();
      await api.createEnquiry({
        villageId: cart.villageId, toUid: cart.sellerUid, toName: cart.sellerName, toPhone: cart.phone, kind: 'listing', listingId: cart.lines[0].id, listingTitle: L('കട ഓർഡർ', 'Store order'),
        fromUid: profile.uid, fromName: profile.name, fromPhone: phone.trim(), ...(profile.pincode ? { pincode: profile.pincode } : {}),
        items: cart.lines.map((x) => `${x.title} × ${x.qty}`).join(', ').slice(0, 300), freq, delivery,
        ...(delivery && address.trim() ? { address: address.trim().slice(0, 300) } : {}), ...(delivery && loc ? { lat: loc.lat, lng: loc.lng } : {}),
        ...(note.trim() ? { note: note.trim().slice(0, 300) } : {}),
        lines: cart.lines.map((x) => ({ listingId: x.id, title: x.title, price: x.price, ...(x.unit ? { unit: x.unit } : {}), qty: x.qty })),
        itemsTotal, deliveryFee: dc.fee, ...(dc.km != null ? { km: dc.km } : {}),
        status: 'new', replies: [], createdAt: now, updatedAt: now,
      });
      try { if (address.trim()) localStorage.setItem('gs-last-address', address.trim()); if (loc) localStorage.setItem('gs-last-loc', JSON.stringify(loc)); } catch { /* ignore */ }
      saveCart(null);
      toast(L('ഓർഡർ അയച്ചു! കടക്കാരൻ ഉറപ്പിക്കുമ്പോൾ "ഞാൻ അയച്ചത്"-ൽ കാണാം.', 'Order placed! See it under "Sent" once the shop confirms.'));
      nav('/orders?tab=sent', { replace: true });
    } catch (e) { console.error(e); toast(L('ഓർഡർ അയയ്ക്കാൻ പറ്റിയില്ല', "Couldn't place the order")); } finally { setBusy(false); }
  }

  return (
    <Screen title="Cart" sub={cart.sellerName}>
      {cart.lines.map((x) => (
        <div key={x.id} className="card">
          {x.photo ? <img src={x.photo} alt="" style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 10 }} /> : <span style={{ fontSize: 30 }}>🛒</span>}
          <span className="stack grow" style={{ minWidth: 0 }}><b>{x.title}</b><span className="muted small">{rupees(x.price)}{x.unit ? ` / ${x.unit}` : ''}</span></span>
          <span className="row nowrap" style={{ gap: 4 }}>
            <button className="iconbtn" onClick={() => set(x.id, -1)} aria-label="-">{x.qty === 1 ? <Trash2 size={16} /> : <Minus size={16} />}</button>
            <b className="num">{x.qty}</b>
            <button className="iconbtn" onClick={() => set(x.id, 1)} aria-label="+"><Plus size={16} /></button>
          </span>
          <b className="num" style={{ minWidth: 56, textAlign: 'right' }}>{rupees(x.qty * x.price)}</b>
        </div>
      ))}
      <Link to="/store" className="link small">+ {L('കൂടുതൽ സാധനങ്ങൾ ചേർക്കുക', 'Add more items')}</Link>

      <label>{L('എപ്പോഴൊക്കെ വേണം?', 'How often?')}</label>
      <div className="chips">{ORDER_FREQS.map((f) => <button key={f} className={'chip' + (freq === f ? ' on' : '')} onClick={() => setFreq(f)}>{pair(FREQ_LABEL[f])}</button>)}</div>
      <label>{L('വീട്ടിൽ എത്തിക്കണോ?', 'Home delivery?')}</label>
      <div className="chips">
        <button className={'chip' + (delivery ? ' on' : '')} onClick={() => setDelivery(true)}><Truck size={14} aria-hidden /> {L('വേണം', 'Yes')}</button>
        <button className={'chip' + (!delivery ? ' on' : '')} onClick={() => setDelivery(false)}>{L('ഞാൻ വന്ന് വാങ്ങാം', "I'll pick up")}</button>
      </div>
      {delivery && (<>
        <label htmlFor="ca">{L('വിലാസം (വീട്ടുപേര്, സ്ഥലം, അടയാളം)', 'Address (house name, place, landmark)')}</label>
        <textarea id="ca" className="input" rows={2} maxLength={300} value={address} onChange={(e) => setAddress(e.target.value)} />
        <HomeLocation loc={loc} setLoc={setLoc} />
      </>)}
      <label htmlFor="cp">{L('ഫോൺ നമ്പർ', 'Phone number')}</label>
      <input id="cp" className="input" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <label htmlFor="cn">{L('കുറിപ്പ് (വേണമെങ്കിൽ)', 'Note (optional)')}</label>
      <input id="cn" className="input" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder={L('ഉദാ: രാവിലെ 7-ന് മുൻപ്', 'e.g. before 7 am')} />

      <div className="card" style={{ display: 'block' }}>
        <b>{L('Bill', 'Bill')}</b>
        <div className="row between small"><span>{L('സാധനങ്ങൾ', 'Items')}</span><span className="num">{rupees(itemsTotal)}</span></div>
        {delivery && <div className="row between small"><span>{L('ഡെലിവറി ചാർജ്', 'Delivery charge')}{dc.km != null ? ` (~${dc.km} km)` : ''}</span><span className="num">{rupees(dc.fee)}</span></div>}
        <div className="row between" style={{ borderTop: '1px solid var(--line)', marginTop: 6, paddingTop: 6 }}><b>{freq === 'once' ? L('ആകെ', 'Total') : L('ഓരോ തവണയും', 'Each delivery')}</b><b className="num">{rupees(total)}</b></div>
        {freq === 'daily' && <div className="small muted">{L(`മാസം ഏകദേശം ${rupees(total * 30)} (30 ദിവസം) — മാസാവസാനം bill`, `About ${rupees(total * 30)} a month (30 days) — billed monthly`)}</div>}
        {delivery && freq === 'once' && dc.km == null && <div className="small muted">{L('വീടിന്റെ location ചേർത്താൽ ദൂരം അനുസരിച്ച് കൃത്യമായ ചാർജ് കാണാം.', 'Add your home location to see the exact charge by distance.')}</div>}
        <div className="small" style={{ marginTop: 6 }}>💵 {L('പണം: സാധനം കിട്ടുമ്പോൾ Cash / UPI. ഡെലിവറി ചാർജ് ഡെലിവറി ചെയ്യുന്നയാൾക്കാണ്.', 'Payment: cash / UPI when you receive it. The delivery charge goes to the delivery person.')}</div>
      </div>
      {cart.sellerUid === profile.uid && <div className="notice warn">{L('ഇത് നിങ്ങളുടെ തന്നെ സാധനങ്ങളാണ്.', 'These are your own items.')}</div>}
      <button className="btn block lg" disabled={busy || !ok} onClick={place}>{L(`ഓർഡർ ചെയ്യുക — ${rupees(total)}`, `Place order — ${rupees(total)}`)}</button>
    </Screen>
  );
}
