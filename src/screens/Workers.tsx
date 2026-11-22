import { OrderButton } from './Orders';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { BadgeCheck, Flag, MapPin } from 'lucide-react';
import { useApp, useLoad } from '../lib/app';
import { Avatar, CallButton, CallWhatsApp, CatIcon, Empty, LoadError, Loading, Screen, StarRow } from '../components/ui';
import { ALL_JOBS, canonJob, jobLabel, mapsLink, CAT_LABEL, CAT_WORKER, SLOTS, jobName, isFree, km, prettyDate, rateText, rating, timeAgo, todayISO } from '../lib/util';
import { panchayatName, wardLabel } from '../lib/panchayat';
import { useAdminHere } from './Local';
import { WORK_CATS, isShop, isVehicle, type Category, type Provider, type Village } from '../types';

/** Providers of the panchayat being viewed, plus those from nearby panchayats who travel that far. */
export function withReach(list: Provider[], village: Village | null, ids: string[] = village ? [village.id] : []) {
  return list
    .map((p) => ({ p, dist: village ? km(village, p) : 0, home: ids.includes(p.villageId) }))
    .filter(({ p, dist, home }) => !village || home || dist <= p.radiusKm)
    .sort((a, b) => Number(isFree(b.p)) - Number(isFree(a.p)) || a.dist - b.dist);
}

export function Services() {
  const { api, village, viewIds, reachIds, L, pair } = useApp();
  const nav = useNavigate();
  // Count of free workers in reach, per category, for the hint card.
  const [info] = useLoad(async () => {
    const all = withReach((await api.listApprovedProviders(null, reachIds)).filter((p) => (WORK_CATS as readonly string[]).includes(p.category)), village, viewIds);
    // Work names people typed under "Others" become their own sections.
    const jobs = new Map<string, number>();
    for (const { p } of all) if (p.category === 'other' && p.jobTitle) jobs.set(canonJob(p.jobTitle), (jobs.get(canonJob(p.jobTitle)) ?? 0) + 1);
    // Ready-made works are always listed (even with 0 people yet); typed-in works get added after them.
    const ready = ALL_JOBS.map((j) => [j[0], jobs.get(j[0]) ?? 0] as [string, number]);
    const typed = [...jobs.entries()].filter(([j]) => !ALL_JOBS.some((x) => x[0] === j)).sort((a, b) => b[1] - a[1]);
    return { free: all.filter(({ p }) => isFree(p)).length, jobs: [...typed, ...ready.sort((a, b) => b[1] - a[1])] };
  }, [reachIds.join(',')]);
  const freeCount = info?.free;
  return (
    <Screen title={L('ഏത് പണിക്കാരനെ വേണം?', 'Which worker do you need?')} nav>
      <div className="grid2">
        {WORK_CATS.map((c) => (
          <button key={c} className="tile" onClick={() => nav(c === 'other' ? '/services/more' : `/services/${c}`)}>
            <CatIcon cat={c} />
            {pair(CAT_LABEL[c])}
          </button>
        ))}
      </div>
      <Link to="/work/register" className="muted small center">{L('നിങ്ങളുടെ തൊഴിൽ ലിസ്റ്റിൽ ഇല്ലേ? "മറ്റുള്ളവ" തിരഞ്ഞെടുത്ത് സ്വന്തം തൊഴിൽ ചേർക്കാം →', 'Your work not listed? Choose "Others" and add your own →')}</Link>
      {freeCount !== undefined && (
        <div className="notice"><span className="dot" style={{ marginTop: 6 }} />{L(`ഇപ്പോൾ ${freeCount} പണിക്കാർ ഫ്രീ ആണ്`, `${freeCount} workers are free right now`)}</div>
      )}
    </Screen>
  );
}

function ProviderCard({ p, dist }: { p: Provider; dist: number }) {
  const { villages, L, lang, pair } = useApp();
  const free = isFree(p);
  const ask = !free && !!p.imported; // added from Excel: no live status, just call
  return (
    <Link to={`/provider/${p.uid}`} className="card" style={{ opacity: free || ask ? 1 : 0.7 }}>
      <Avatar name={p.name} className={isVehicle(p.category) ? 'auto' : ''} />
      <span className="stack grow">
        <span className="row" style={{ gap: 6 }}>
          <b style={{ fontSize: 16 }}>{p.name}</b>
          {p.verified && <span className="badge"><BadgeCheck size={13} aria-hidden />Verified</span>}
        </span>
        <span className="row muted small" style={{ gap: 6 }}>
          <StarRow value={rating(p)} count={p.ratingCount} />
          <span className="num">· {dist} km</span>
          {p.category === 'other' && p.jobTitle && <span>· {jobLabel(p.jobTitle, pair)}</span>}
          {p.vehicleNo && <span>· {p.vehicleNo}</span>}
          {p.ward && <span>· {wardLabel(villages.find((v) => v.id === p.villageId), p.ward, lang)}</span>}
        </span>
        <span className="row small" style={{ gap: 6, color: free ? 'var(--green-dark)' : 'var(--muted)' }}>
          <span className={'dot' + (free ? '' : ' off')} />
          {free ? L('ഇപ്പോൾ ഫ്രീ', 'Free now') : ask ? L('വിളിച്ച് ചോദിക്കുക', 'Call to check') : L('തിരക്കിലാണ്', 'Busy')} · {rateText(p, lang)}
        </span>
      </span>
      <CallButton phone={p.phone} off={!free && !ask} />
    </Link>
  );
}

/** "Others": every other kind of work as an easy-to-scan list (ready-made ones plus those people typed in). */
export function MoreWorks() {
  const { api, village, viewIds, reachIds, L, pair } = useApp();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [jobs] = useLoad(async () => {
    const all = withReach((await api.listApprovedProviders('other', reachIds)), village, viewIds);
    const n = new Map<string, number>();
    for (const { p } of all) if (p.jobTitle) n.set(canonJob(p.jobTitle), (n.get(canonJob(p.jobTitle)) ?? 0) + 1);
    const typed = [...n.keys()].filter((j) => !ALL_JOBS.some((x) => x[0] === j)).map((j) => [j, j] as [string, string]);
    return [...ALL_JOBS, ...typed].map(([ml, en]) => ({ key: ml, ml, en, count: n.get(ml) ?? 0 }));
  }, [reachIds.join(',')]);
  const rows = (jobs ?? []).filter((j) => !q.trim() || (j.ml + ' ' + j.en).toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <Screen title={L('മറ്റ് പണിക്കാർ', 'Other workers')} nav>
      <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={L('പണി തിരയുക…', 'Search for a work…')} />
      {!jobs && <Loading />}
      {rows.map((j) => (
        <button key={j.key} className="card" style={{ justifyContent: 'space-between', textAlign: 'left', width: '100%' }} onClick={() => nav(`/services/other?job=${encodeURIComponent(j.key)}`)}>
          <b>{pair([j.ml, j.en])}</b>
          <span className={'badge' + (j.count ? '' : ' grey')}>{j.count ? `${j.count}` : L('ആരുമില്ല', 'None yet')}</span>
        </button>
      ))}
      {jobs && rows.length === 0 && <Empty text={L('ഈ പണി ലിസ്റ്റിൽ ഇല്ല. "സേവനദാതാവായി ചേരുക" വഴി നിങ്ങൾക്ക് സ്വന്തം പണി ചേർക്കാം.', 'Not in the list. You can add your own work when you join as a provider.')}><Link to="/work/register" className="btn">{L('സേവനദാതാവായി ചേരുക', 'Join as a provider')}</Link></Empty>}
      <Link to="/work/register" className="muted small center">{L('നിങ്ങളുടെ തൊഴിൽ ലിസ്റ്റിൽ ഇല്ലേ? സ്വന്തം തൊഴിൽ ചേർക്കാം →', 'Your work not listed? Add your own →')}</Link>
    </Screen>
  );
}

export function WorkerList() {
  const { cat = 'plumbing' } = useParams();
  const { api, village, viewIds, reachIds, lang, L, pair } = useApp();
  const [filter, setFilter] = useState<'free' | 'near' | 'rating'>('free');
  const [params] = useSearchParams();
  const job = params.get('job') ?? '';
  const [list, reload, err] = useLoad(() => api.listApprovedProviders(cat as Category, reachIds), [cat, reachIds.join(',')]);
  const rows = useMemo(() => {
    const r = withReach((list ?? []).filter((p) => !job || canonJob(p.jobTitle) === canonJob(job)), village, viewIds);
    if (filter === 'near') r.sort((a, b) => a.dist - b.dist);
    if (filter === 'rating') r.sort((a, b) => rating(b.p) - rating(a.p));
    return r;
  }, [list, village, viewIds, filter, job]);
  const mine = rows.filter(({ home }) => home);
  const nearby = rows.filter(({ home }) => !home);

  return (
    <Screen title={job ? jobLabel(job, pair) : pair(CAT_WORKER[cat as Category])} nav>
      <div className="chips">
        <button className={'chip' + (filter === 'free' ? ' on' : '')} onClick={() => setFilter('free')}>{L('ഇപ്പോൾ ഫ്രീ', 'Free now')}</button>
        <button className={'chip' + (filter === 'near' ? ' on' : '')} onClick={() => setFilter('near')}>{L('അടുത്തുള്ളവർ', 'Nearest')}</button>
        <button className={'chip' + (filter === 'rating' ? ' on' : '')} onClick={() => setFilter('rating')}>{L('റേറ്റിംഗ്', 'Rating')}</button>
      </div>
      {err && <LoadError retry={reload} />}
      {!list && !err && <Loading />}
      {village && <p className="muted small"><MapPin size={14} style={{ verticalAlign: -2 }} /> {panchayatName(village, lang)} · <Link className="link" to="/panchayats">{L('മാറ്റുക', 'Change')}</Link></p>}
      {mine.map(({ p, dist }) => <ProviderCard key={p.uid} p={p} dist={dist} />)}
      {nearby.length > 0 && <p className="section">{L('അടുത്ത പഞ്ചായത്തുകളിൽ നിന്ന്', 'From nearby panchayats')}</p>}
      {nearby.map(({ p, dist }) => <ProviderCard key={p.uid} p={p} dist={dist} />)}
      {list && rows.length === 0 && (
        <Empty text={L('ഈ പണിക്ക് ഇതുവരെ ആരും ചേർന്നിട്ടില്ല. പരിചയമുള്ളവരോട് ഗ്രാമസേവയിൽ ചേരാൻ പറയൂ.', 'No one has joined for this work yet. Ask people you know to join Gramaseva.')} />
      )}
    </Screen>
  );
}

export function ProviderProfile() {
  const { uid = '' } = useParams();
  const { api, village, L, lang, pair, toast } = useApp();
  const adminVid = useAdminHere();
  const nav = useNavigate();
  const [p, reloadP] = useLoad(() => api.getProvider(uid), [uid]);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [reviews] = useLoad(() => api.listReviews(uid), [uid]);
  if (p === undefined) return <Screen title=""><Loading /></Screen>;
  if (p === null) return <Screen title=""><Empty text={L('ഈ ആളെ കണ്ടെത്താനായില്ല.', 'This person was not found.')} /></Screen>;
  const free = isFree(p);
  const dist = village ? km(village, p) : 0;

  return (
    <Screen title="" right={<Link to={`/report/${p.uid}`} className="iconbtn" aria-label={L('പരാതി', 'Report')}><Flag size={20} /></Link>}>
      <div className="stack" style={{ alignItems: 'center', gap: 8, textAlign: 'center' }}>
        <Avatar name={p.name} size="lg" className={isVehicle(p.category) ? 'auto' : ''} />
        <h1 className="h2">{p.shopName || p.name}</h1>
        {p.shopName && <span className="muted small">{L('ഉടമ', 'Owner')}: {p.name}</span>}
        <span className="row" style={{ justifyContent: 'center' }}>
          {p.verified && <span className="badge"><BadgeCheck size={13} aria-hidden />Verified</span>}
          <span className="badge warn">{jobName(p, pair)}</span>
        </span>
        {!isShop(p.category) && (
        <span className="row muted small" style={{ justifyContent: 'center' }}>
          <span className={'dot' + (free ? '' : ' off')} />
          {free ? L('ഇപ്പോൾ ഫ്രീ', 'Free now') : L('തിരക്കിലാണ്', 'Busy')} · <MapPin size={14} aria-hidden /> <span className="num">{dist} km</span>
        </span>)}
      </div>
      <div className="card" style={{ justifyContent: 'space-around', textAlign: 'center' }}>
        <span className="stack"><b className="num">{p.ratingCount ? rating(p).toFixed(1) + ' ★' : '—'}</b><span className="muted small">{p.ratingCount} reviews</span></span>
        {p.experienceYears ? <span className="stack"><b className="num">{p.experienceYears} {L('വർഷം', 'yrs')}</b><span className="muted small">{L('പരിചയം', 'Experience')}</span></span> : null}
        {!isShop(p.category) && <span className="stack"><b className="num">{rateText(p, lang)}</b><span className="muted small">{L('നിരക്ക്', 'Rate')}</span></span>}
      </div>
      {p.address && <div className="card"><span className="muted">{L('സ്ഥലം', 'Address')}</span><b className="grow" style={{ textAlign: 'right' }}>{p.address}</b></div>}
      {p.openHours && <div className="card"><span className="muted">{L('സമയം', 'Hours')}</span><b className="grow" style={{ textAlign: 'right' }}>{p.openHours}</b></div>}
      {isShop(p.category) && <a className="btn block outline" href={mapsLink(`${p.shopName ?? ''} ${p.address ?? ''}, ${village ? (village.nameEn || village.name) : ''}, Kerala`)} target="_blank" rel="noreferrer"><MapPin size={18} /> {L('Google Maps-ൽ കാണുക', 'View on Google Maps')}</a>}
      {p.vehicleNo && <div className="card"><span className="muted">{L('വാഹന നമ്പർ', 'Vehicle no.')}</span><b className="grow" style={{ textAlign: 'right' }}>{p.vehicleNo}</b></div>}
      {p.about && <p style={{ fontSize: 16 }}>{p.about}</p>}
      {reviews && reviews.length > 0 && <p className="section">{L('അഭിപ്രായങ്ങൾ', 'Reviews')}</p>}
      {reviews?.slice(0, 5).map((r) => (
        <div key={r.id} className="card col" style={{ gap: 4 }}>
          <span className="row"><b>{'★'.repeat(r.stars)}<span style={{ color: 'var(--line-strong)' }}>{'★'.repeat(5 - r.stars)}</span></b><b>{r.customerName}</b><span className="muted small">{timeAgo(r.createdAt, lang)}</span></span>
          {r.comment && <span className="muted">{r.comment}</span>}
        </div>
      ))}
      {adminVid === p.villageId && (
        <button className="btn block danger" onClick={async () => {
          if (!confirmBlock) { setConfirmBlock(true); return; }
          try { await api.reviewProvider(p.uid, p.status === 'blocked' ? 'approved' : 'blocked', p.verified); toast(L('സേവ് ചെയ്തു', 'Saved')); setConfirmBlock(false); reloadP(); }
          catch (e) { console.error(e); toast(L('പറ്റിയില്ല', "Couldn't do that")); }
        }}>
          {confirmBlock ? L('ഉറപ്പാണോ? വീണ്ടും അമർത്തുക', 'Sure? Tap again') : p.status === 'blocked' ? L('Unblock ചെയ്യുക (വാർഡ് മെമ്പർ)', 'Unblock (ward member)') : L('Block ചെയ്യുക (വാർഡ് മെമ്പർ)', 'Block (ward member)')}
        </button>
      )}
      <div className="spacer" />
      <CallWhatsApp phone={p.phone} text={L('നമസ്കാരം, ഗ്രാമസേവയിൽ നിന്നാണ്.', 'Hello, I found you on Gramaseva.')} />
      {isShop(p.category) && <OrderButton to={p.uid} kind="shop" />}
      {!isShop(p.category) && !p.imported && <button className="btn block outline" onClick={() => nav(isVehicle(p.category) ? `/ride?v=${p.category}&p=${p.uid}` : `/book/${p.uid}`)}>
        {L('ബുക്ക് ചെയ്യുക', 'Book')}
      </button>}
    </Screen>
  );
}

export function BookingRequest() {
  const { uid = '' } = useParams();
  const { api, profile, L, lang, toast } = useApp();
  const nav = useNavigate();
  const [p] = useLoad(() => api.getProvider(uid), [uid]);
  const [day, setDay] = useState(todayISO(1));
  const [slot, setSlot] = useState('morning');
  const [details, setDetails] = useState('');
  const [place, setPlace] = useState('');
  const [busy, setBusy] = useState(false);
  if (!p || !profile) return <Screen title=""><Loading /></Screen>;

  async function send() {
    if (!p || !profile) return;
    if (p.uid === profile.uid) { toast(L('സ്വന്തം profile ബുക്ക് ചെയ്യാൻ പറ്റില്ല', "You can't book yourself")); return; }
    setBusy(true);
    try {
      const id = await api.createBooking({
        type: 'service', customerId: profile.uid, customerName: profile.name, customerPhone: profile.phone,
        providerId: p.uid, providerName: p.name, providerPhone: p.phone, villageId: p.villageId,
        category: p.category, date: day, slot, details: details.trim() + (place.trim() ? `\n📍 ${place.trim()}` : ''),
        status: 'requested', rated: false, createdAt: Date.now(),
      });
      toast(L('Request അയച്ചു', 'Request sent'));
      nav(`/booking/${id}`, { replace: true });
    } catch {
      toast(L('അയയ്ക്കാൻ പറ്റിയില്ല. വീണ്ടും ശ്രമിക്കുക.', "Couldn't send. Try again."));
    } finally { setBusy(false); }
  }

  const days = [todayISO(), todayISO(1), todayISO(2), todayISO(3)];
  return (
    <Screen title={L(`${p.name}-നെ ബുക്ക് ചെയ്യുക`, `Book ${p.name}`)}>
      <p className="section">{L('എപ്പോൾ?', 'When?')}</p>
      <div className="chips">{days.map((d) => <button key={d} className={'chip' + (day === d ? ' on' : '')} onClick={() => setDay(d)}>{prettyDate(d, lang)}</button>)}</div>
      <div className="chips">{(['morning', 'noon', 'evening'] as const).map((s) => <button key={s} className={'chip' + (slot === s ? ' on' : '')} onClick={() => setSlot(s)}>{lang === 'ml' ? SLOTS[s][0] : SLOTS[s][1]}</button>)}</div>
      <div className="field">
        <label htmlFor="det" className="section" style={{ color: 'var(--ink)' }}>{L('എന്താണ് പണി?', 'What is the work?')}</label>
        <textarea id="det" className="input" rows={3} value={details} onChange={(e) => setDetails(e.target.value)} placeholder={L('ഉദാ: അടുക്കളയിലെ പൈപ്പ് ചോരുന്നു', 'e.g. Kitchen pipe is leaking')} maxLength={500} />
      </div>
      <div className="field">
        <label htmlFor="place" className="section" style={{ color: 'var(--ink)' }}>{L('സ്ഥലം / വഴി', 'Place / directions')}</label>
        <input id="place" className="input" value={place} onChange={(e) => setPlace(e.target.value)} placeholder={L('ഉദാ: പള്ളിപ്പടി, കിണറിനടുത്തുള്ള വീട്', 'e.g. Near the church, house next to the well')} />
      </div>
      <div className="notice warn">{L('കൂലി പണിക്കാരനുമായി നേരിട്ട് സംസാരിച്ച് തീരുമാനിക്കുക. പണം നേരിട്ട് (cash / UPI) കൊടുക്കാം.', 'Agree the charge directly with the worker. Pay them directly (cash / UPI).')}</div>
      <div className="spacer" />
      <button className="btn block" disabled={busy || details.trim().length < 3} onClick={send}>{L('Request അയയ്ക്കുക', 'Send request')}</button>
    </Screen>
  );
}

export function ReportProvider() {
  const { uid = '' } = useParams();
  const { api, profile, L, toast } = useApp();
  const nav = useNavigate();
  const [p] = useLoad(() => api.getProvider(uid), [uid]);
  const reasons = [
    L('പറഞ്ഞ സമയത്ത് വന്നില്ല', 'Did not come on time'),
    L('മോശം പെരുമാറ്റം', 'Bad behaviour'),
    L('അമിത കൂലി ചോദിച്ചു', 'Overcharged'),
    L('വ്യാജ profile', 'Fake profile'),
  ];
  const [reason, setReason] = useState('');
  const [more, setMore] = useState('');
  if (!p || !profile) return <Screen title=""><Loading /></Screen>;
  async function send() {
    if (!p || !profile) return;
    await api.createReport({
      reportedBy: profile.uid, reporterName: profile.name, againstId: p.uid, againstName: p.name,
      villageId: p.villageId, reason: [reason, more.trim()].filter(Boolean).join(' — '), status: 'open', createdAt: Date.now(),
    });
    toast(L('പരാതി Village Coordinator-ന് അയച്ചു', 'Complaint sent to the village coordinator'));
    nav(-1);
  }
  return (
    <Screen title={L('പരാതി നൽകുക', 'Report a problem')} sub={p.name}>
      {reasons.map((r) => <button key={r} className={'chip' + (reason === r ? ' on' : '')} style={{ justifyContent: 'flex-start', minHeight: 48 }} onClick={() => setReason(r)}>{r}</button>)}
      <div className="field"><label htmlFor="more">{L('കൂടുതൽ വിവരം (വേണമെങ്കിൽ)', 'More details (optional)')}</label><textarea id="more" className="input" value={more} onChange={(e) => setMore(e.target.value)} maxLength={500} /></div>
      <div className="spacer" />
      <button className="btn block danger" disabled={!reason} onClick={send}>{L('പരാതി അയയ്ക്കുക', 'Send complaint')}</button>
    </Screen>
  );
}
