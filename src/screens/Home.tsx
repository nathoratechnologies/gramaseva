import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShoppingBasket, Ambulance, Bike, BusFront, ChevronDown, ChevronRight, FireExtinguisher, GraduationCap, Hospital, Landmark, Newspaper, Phone, Search, Siren, Store, Wrench, Zap, CarTaxiFront, HardHat, ShieldCheck, Users } from 'lucide-react';
import { inWard, listPanchayatNews, panchayatName, wardLabel } from '../lib/panchayat';
import { LocalTiles } from './Local';
import { AdStrip } from './Market';
import { OrdersCard } from './Orders';
import { DeliveryCard } from './Delivery';
import { CartBar, ProductCard, loadProducts, useCartAdd } from './Store';
import { useApp, useLoad } from '../lib/app';
import { BottomNav, Hills, NEWS_ICON, Screen } from '../components/ui';
import { LiveOrderCard } from './Track';
import { CAT_LABEL, isFree, timeAgo } from '../lib/util';
import { WORK_CATS, VEHICLE_CATS, SHOP_CATS, boyActive, isShop, type Category } from '../types';

const QUICK: { to: string; ml: string; en: string; Icon: typeof Wrench; color: string; bg: string }[] = [
  { to: '/store', ml: 'കട', en: 'Shop', Icon: ShoppingBasket, color: '#1b7a3a', bg: '#e6f4ea' },
  { to: '/services', ml: 'പണിക്കാർ', en: 'Workers', Icon: Wrench, color: '#e8710a', bg: '#fff1e0' },
  { to: '/ride', ml: 'ഓട്ടോ / ടാക്സി', en: 'Auto / taxi', Icon: CarTaxiFront, color: '#e8710a', bg: '#fff1e0' },
  { to: '/delivery/boys', ml: 'ഡെലിവറി', en: 'Delivery', Icon: Bike, color: '#1b7a3a', bg: '#e6f4ea' },
  { to: '/news', ml: 'ഗ്രാമവാർത്ത', en: 'News', Icon: Newspaper, color: '#1565c0', bg: '#e3f0fd' },
  { to: '/directory/hospital', ml: 'ആശുപത്രി', en: 'Hospitals', Icon: Hospital, color: '#c62828', bg: '#fdecec' },
  { to: '/directory/school', ml: 'സ്കൂൾ / കോളേജ്', en: 'Schools', Icon: GraduationCap, color: '#1565c0', bg: '#e3f0fd' },
  { to: '/timings?mode=bus', ml: 'ബസ് സമയം', en: 'Bus times', Icon: BusFront, color: '#e8710a', bg: '#fff1e0' },
];

export function Home() {
  const { api, profile, village, viewIds, reachIds, isHomeView, provider, L, lang, pair } = useApp();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const myWard = isHomeView ? profile?.ward ?? '' : '';
  const [allNews] = useLoad(() => listPanchayatNews(api, viewIds), [viewIds.join(',')]);
  const news = allNews?.filter((n) => inWard(n, myWard));
  const latest = (news ?? []).slice(0, 3);
  const important = (news ?? []).find((n) => n.important && Date.now() - n.createdAt < 2 * 86400000);
  const [products, reloadProducts] = useLoad(() => loadProducts(api, reachIds), [reachIds.join(',')]);
  const { cart, qtyOf, count, total, add } = useCartAdd();
  const daily = (products ?? []).slice().sort((a, b) => Number(['milk', 'egg', 'vegetable', 'fish'].includes(b.category)) - Number(['milk', 'egg', 'vegetable', 'fish'].includes(a.category)) || b.createdAt - a.createdAt).slice(0, 10);

  // Simple search: match a work, vehicle or shop category, or a product name.
  const qq = q.trim().toLowerCase();
  const matches = qq.length < 2 ? [] : ([...WORK_CATS, ...VEHICLE_CATS, ...SHOP_CATS] as Category[]).filter((c) => CAT_LABEL[c].some((s) => s.toLowerCase().includes(qq)));
  const prodHits = qq.length < 2 ? [] : (products ?? []).filter((l) => `${l.title} ${l.shopName ?? ''}`.toLowerCase().includes(qq)).slice(0, 6);
  const go = (c: Category) => nav(isShop(c) ? `/shops/${c}` : (VEHICLE_CATS as Category[]).includes(c) ? `/ride?v=${c}` : `/services/${c}`);
  const first = profile?.name.split(' ')[0] ?? '';

  return (
    <>
      <header className="hero">
        <Hills />
        <div className="row nowrap anim-up" style={{ alignItems: 'flex-start', gap: 10 }}>
          <div className="grow stack" style={{ gap: 2 }}>
            <span className="heropill">🌿 {L('നാടിന്റെ എല്ലാം ഒരിടത്ത്', 'Your village, all in one place')}</span>
            <Link to="/panchayats">
              <b style={{ fontSize: 21, lineHeight: 1.2 }}>{village ? panchayatName(village, lang) : L('പഞ്ചായത്ത് തിരഞ്ഞെടുക്കുക', 'Choose panchayat')} <ChevronDown size={20} aria-hidden style={{ verticalAlign: 'middle' }} /></b>
            </Link>
            <span style={{ fontSize: 13, opacity: 0.92 }}>
              {!isHomeView ? L('മറ്റൊരു പഞ്ചായത്ത് നോക്കുന്നു', 'Viewing another panchayat') : myWard && village ? `${wardLabel(village, myWard, lang)} · ` : ''}
              {isHomeView ? `${L('നമസ്കാരം', 'Hello')}, ${first} 👋` : ''}
            </span>
          </div>
          <Link to="/emergency" className="herobtn sos" aria-label={L('അടിയന്തര നമ്പറുകൾ', 'Emergency numbers')}><Siren size={22} aria-hidden /></Link>
          <Link to="/profile" className="herobtn" aria-label={L('പ്രൊഫൈൽ', 'Profile')}><b>{first.slice(0, 1) || '?'}</b></Link>
        </div>
        <label className="searchbar anim-up d1" htmlFor="search">
          <Search size={20} color="var(--grey)" aria-hidden />
          <input id="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={L('"പാൽ", "പ്ലംബർ", "ഓട്ടോ" തിരയുക…', 'Search "milk", "plumber", "auto"…')} />
        </label>
      </header>
      <main className="content with-nav" style={{ paddingTop: 14 }}>
        {qq.length >= 2 && (
          <div className="stack-lg">
            {matches.length > 0 && <div className="chips">{matches.map((c) => <button key={c} className="chip on" onClick={() => go(c)}>{pair(CAT_LABEL[c])} →</button>)}</div>}
            {prodHits.length > 0 && <div className="hscroll">{prodHits.map((l) => <ProductCard key={l.id} l={l} width={150} qty={qtyOf(l.id)} onAdd={(d) => add(l, d)} onRemoved={reloadProducts} />)}</div>}
            {matches.length === 0 && prodHits.length === 0 && <p className="muted small">{L('ഒന്നും കിട്ടിയില്ല. താഴെയുള്ള വിഭാഗങ്ങൾ നോക്കുക.', 'No match. Try the sections below.')}</p>}
          </div>
        )}

        <LiveOrderCard />
        <div className="qgrid">
          {QUICK.map((t) => (
            <Link key={t.to} to={t.to} className="qtile">
              <span className="qic" style={{ background: t.bg, color: t.color }}><t.Icon size={26} aria-hidden /></span>
              <span>{lang === 'ml' ? t.ml : t.en}</span>
            </Link>
          ))}
        </div>

        {important && (
          <Link to={`/news/${important.id}`} className="notice warn">
            <Zap size={20} aria-hidden style={{ flex: 'none' }} />
            <span><b>{important.title}</b></span>
          </Link>
        )}

        <OrdersCard />
        <DeliveryCard />
        <MyShopCard />
        <AdStrip />

        {daily.length > 0 && (<>
          <div className="row between"><span className="section">{L('ദിവസവും വേണ്ടത്', 'Daily needs')}</span><Link to="/store" className="link small">{L('എല്ലാം കാണുക ›', 'See all ›')}</Link></div>
          <div className="hscroll">
            {daily.map((l) => <ProductCard key={l.id} l={l} width={150} qty={qtyOf(l.id)} onAdd={(d) => add(l, d)} onRemoved={reloadProducts} />)}
          </div>
        </>)}

        <Link to="/services" className="card">
          <span className="qic" style={{ background: '#fff1e0', color: '#e8710a', width: 44, height: 44 }}><Wrench size={22} aria-hidden /></span>
          <span className="grow stack" style={{ gap: 0 }}>
            <b>{L('പണിക്കാരെ വിളിക്കാം', 'Call a worker')}</b>
            <span className="muted small">{L('പ്ലംബർ, ഇലക്ട്രീഷ്യൻ, തെങ്ങുകയറ്റം…', 'Plumber, electrician, coconut climber…')}</span>
          </span>
          <ChevronRight size={22} color="var(--grey)" aria-hidden />
        </Link>
        <Link to="/market" className="card">
          <span className="qic" style={{ background: '#e6f4ea', color: '#1b7a3a', width: 44, height: 44 }}><ShoppingBasket size={22} aria-hidden /></span>
          <span className="grow stack" style={{ gap: 0 }}>
            <b>{L('വാങ്ങാം · വിൽക്കാം · വാടക', 'Buy · Sell · Rent')}</b>
            <span className="muted small">{L('പാൽ, മുട്ട, പച്ചക്കറി, വാടക സാധനങ്ങൾ…', 'Milk, eggs, vegetables, rental items…')}</span>
          </span>
          <ChevronRight size={22} color="var(--grey)" aria-hidden />
        </Link>

        <LocalTiles />

        <Link to="/people" className="card">
          <Users size={26} color="var(--green)" aria-hidden />
          <span className="grow stack">
            <b>{L('ഈ പഞ്ചായത്തിലെ എല്ലാവരും', 'Everyone in this panchayat')}</b>
            <span className="muted small">{L('എല്ലാ പണിക്കാരും ഡ്രൈവർമാരും — നേരിട്ട് വിളിക്കാം', 'All workers and drivers — call directly')}</span>
          </span>
        </Link>
        {village?.wards?.length ? (
          <Link to="/wards" className="card">
            <Landmark size={26} color="var(--green)" aria-hidden />
            <span className="grow stack">
              <b>{L('വാർഡുകളും മെമ്പർമാരും', 'Wards and members')}</b>
              <span className="muted small">{village.wards.length} {L('വാർഡുകൾ', 'wards')}{myWard ? ` · ${L('എന്റെ വാർഡ്', 'my ward')}: ${wardLabel(village, myWard, lang)}` : ''}</span>
            </span>
          </Link>
        ) : null}

        {provider ? (
          <Link to="/work" className="card">
            <HardHat size={26} color="var(--green)" aria-hidden />
            <span className="grow stack">
              <b>{L('എന്റെ പണി', 'My work')}</b>
              <span className="muted small">
                {provider.status !== 'approved' ? L('Approval കാത്തിരിക്കുന്നു', 'Waiting for approval') : isFree(provider) ? L('നിങ്ങൾ ഇപ്പോൾ ഫ്രീ ആണ്', 'You are free now') : L('നിങ്ങൾ തിരക്കിലാണ്', 'You are busy')}
              </span>
            </span>
            <span className={'dot' + (provider.status === 'approved' && isFree(provider) ? '' : ' off')} />
          </Link>
        ) : null}

        <div className="row between">
          <span className="section">{L('പുതിയ അറിയിപ്പുകൾ', 'Latest notices')}</span>
          <Link to="/news" className="link small">{L('എല്ലാം ›', 'All ›')}</Link>
        </div>
        {latest.map((n) => {
          const { Icon, bg } = NEWS_ICON[n.category];
          return (
            <Link key={n.id} to={`/news/${n.id}`} className="card">
              <span style={{ width: 44, height: 44, borderRadius: 12, background: bg, color: '#fff', display: 'grid', placeItems: 'center', flex: 'none' }}><Icon size={22} aria-hidden /></span>
              <span className="stack grow"><b>{n.title}</b><span className="muted small">{n.postedByName} · {timeAgo(n.createdAt, lang)}</span></span>
            </Link>
          );
        })}
        {news && news.length === 0 && <p className="muted">{L('ഇപ്പോൾ അറിയിപ്പുകളൊന്നുമില്ല.', 'No notices right now.')}</p>}
      </main>
      {cart && <CartBar count={count} total={total} />}
      <BottomNav />
    </>
  );
}

/** Home card for shop owners and sellers: their items (with remove) and the delivery people who joined. */
function MyShopCard() {
  const { api, profile, provider, reachIds, L } = useApp();
  const shopOwner = !!provider && isShop(provider.category);
  const [d] = useLoad(async () => {
    if (!profile) return null;
    const [seller, items] = await Promise.all([api.getSeller(profile.uid), api.listMyListings(profile.uid)]);
    if (!seller && !items.length && !shopOwner) return null;
    const boys = (await api.listDeliveryBoys(reachIds)).filter((b) => boyActive(b));
    return { items: items.length, boys: boys.length, fresh: boys.filter((b) => Date.now() - b.createdAt < 7 * 86400000).length };
  }, [profile?.uid ?? '', shopOwner, reachIds.join(',')]);
  if (!d) return null;
  return (
    <Link to="/market/my" className="card" style={{ background: '#f1f8f2' }}>
      <span className="qic" style={{ background: '#1b7a3a', color: '#fff', width: 44, height: 44 }}><Store size={22} aria-hidden /></span>
      <span className="grow stack" style={{ gap: 0 }}>
        <b>{L('എന്റെ കട', 'My shop')}</b>
        <span className="muted small">{L(`${d.items} സാധനങ്ങൾ · ചേർക്കാം / നീക്കാം`, `${d.items} items · add / remove`)}</span>
        <span className="small" style={{ color: 'var(--green-dark)' }}>🛵 {L(`${d.boys} ഡെലിവറി ബോയ്സ് ചേർന്നിട്ടുണ്ട്`, `${d.boys} delivery people joined`)}{d.fresh ? L(` (${d.fresh} പുതിയത്)`, ` (${d.fresh} new)`) : ''}</span>
      </span>
      <ChevronRight size={22} color="var(--grey)" aria-hidden />
    </Link>
  );
}

export function Emergency() {
  const { L, village } = useApp();
  const list: [typeof Ambulance, string, string, boolean][] = [
    [Ambulance, L('ആംബുലൻസ്', 'Ambulance'), '108', true],
    [ShieldCheck, L('പോലീസ് / എല്ലാ അടിയന്തരങ്ങളും', 'Police / all emergencies'), '112', true],
    [FireExtinguisher, L('ഫയർ ഫോഴ്സ്', 'Fire force'), '101', true],
    [Zap, L('KSEB (വൈദ്യുതി)', 'KSEB (electricity)'), '1912', false],
    [Landmark, L('പഞ്ചായത്ത് ഓഫീസ്', 'Panchayat office'), village?.panchayatPhone ?? '', false],
  ];
  return (
    <Screen title={L('അടിയന്തര നമ്പറുകൾ', 'Emergency numbers')}>
      {list.map(([Icon, name, num, red]) => (
        <div key={name} className="card">
          <Icon size={28} color={red ? 'var(--red)' : 'var(--green)'} aria-hidden />
          <span className="stack grow">
            <b>{name}</b>
            <span className="muted num" style={{ userSelect: 'all' }}>{num || L('നമ്പർ ചേർത്തിട്ടില്ല', 'Not added yet')}</span>
          </span>
          {num && (
            <a className="callbtn" style={{ background: red ? 'var(--red)' : undefined }} href={`tel:${num.replace(/\s/g, '')}`} aria-label={`${L('വിളിക്കുക', 'Call')} ${num}`}>
              <Phone size={22} aria-hidden />
            </a>
          )}
        </div>
      ))}
      <p className="muted small">{L('112 ഇന്ത്യയിലെ എല്ലാ അടിയന്തരങ്ങൾക്കുമുള്ള നമ്പറാണ്.', '112 is India’s single number for all emergencies.')}</p>
    </Screen>
  );
}
