import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { ComplaintInbox } from '../screens/Complaints';
import { ImportAdmin } from './Import';
import { FileSpreadsheet, MessageSquareWarning, ArrowLeft, BadgeCheck, Home, KeyRound, LayoutDashboard, MapPin, Newspaper, ShieldCheck, TriangleAlert, UserCog, Users } from 'lucide-react';
import { isOwner } from '../lib/owner';
import { sortedWards, wardLabel } from '../lib/panchayat';
import { jobName } from '../lib/util';
import { useApp, useLoad } from '../lib/app';
import { getPosition, reverseGeocode } from '../lib/geo';
import { Avatar } from '../components/ui';
import { NEWS_LABEL, prettyPhone, rateText, rating, timeAgo } from '../lib/util';
import { NEWS_CATS, POSITION_LABEL, isHeadPos, roleText, type NewsCat, type Provider, type ProviderStatus, type RoleRequest, type StaffPosition, type UserProfile, type Village } from '../types';

function useAdminVillage() {
  const { profile, villages } = useApp();
  const fixed = profile?.role === 'coordinator' ? profile.coordinatorOf ?? null : null;
  const [vid, setVid] = useState<string | null>(() => {
    try { return fixed ?? sessionStorage.getItem('gs-admin-village') ?? profile?.villageId ?? null; } catch { return fixed ?? profile?.villageId ?? null; }
  });
  useEffect(() => { try { if (vid) sessionStorage.setItem('gs-admin-village', vid); } catch { /* ignore */ } }, [vid]);
  const id = fixed ?? vid ?? villages[0]?.id ?? null;
  return { villageId: id, village: villages.find((v) => v.id === id) ?? null, setVid, canSwitch: !fixed };
}

export function AdminApp() {
  const { api, profile, authUser, villages, L, lang, toast } = useApp();
  const av = useAdminVillage();
  const owner = isOwner(profile, authUser);
  if (!profile || (!owner && profile.role !== 'superadmin' && profile.role !== 'coordinator')) {
    return (
      <div className="phone"><main className="content" style={{ paddingTop: 40 }}>
        <div className="notice bad">{L('ഈ ഭാഗം Village Coordinator-മാർക്കും Admin-നും മാത്രമാണ്.', 'This area is only for village coordinators and admins.')}</div>
        <Link to="/" className="btn">{L('ഹോമിലേക്ക്', 'Go home')}</Link>
      </main></div>
    );
  }
  const isSuper = profile.role === 'superadmin' || owner;
  const isHead = profile.role === 'coordinator' && isHeadPos(profile.position);
  async function changePw() {
    const pw = prompt(L('പുതിയ പാസ്‌വേഡ് (കുറഞ്ഞത് 6 അക്ഷരം)', 'New password (at least 6 characters)'));
    if (!pw) return;
    if (pw.length < 6) return toast(L('കുറഞ്ഞത് 6 അക്ഷരം വേണം', 'At least 6 characters'));
    try { await api.changePassword(pw); toast(L('പാസ്‌വേഡ് മാറ്റി ✓', 'Password changed ✓')); }
    catch (e) { console.error(e); toast(L('പറ്റിയില്ല. Logout ചെയ്ത് വീണ്ടും login ചെയ്ത ശേഷം ശ്രമിക്കുക.', "Couldn't change. Log out, log in again and retry.")); }
  }
  const vname = (v: Village) => (lang === 'ml' ? v.name : v.nameEn);
  const links: [string, typeof Home, string, boolean][] = [
    ['/admin', LayoutDashboard, 'Dashboard', true],
    ['/admin/news', Newspaper, L('വാർത്ത', 'News'), true],
    ['/admin/providers', ShieldCheck, L('സേവനദാതാക്കൾ', 'Providers'), true],
    ['/admin/messages', MessageSquareWarning, L('നാട്ടുകാരുടെ പരാതി', 'Resident messages'), true],
    ['/admin/reports', TriangleAlert, L('Provider പരാതികൾ', 'Provider reports'), true],
    ['/admin/import', FileSpreadsheet, L('Excel import', 'Excel import'), isSuper],
    ['/admin/villages', MapPin, L('വില്ലേജുകൾ', 'Villages'), isSuper],
    ['/admin/team', Users, isSuper ? L('Admin-മാർ / Login', 'Admins / logins') : L('വാർഡ് മെമ്പർമാർ', 'Ward members'), isSuper || isHead],
    ['/admin/users', UserCog, L('എല്ലാ users', 'All users'), isSuper],
  ];
  return (
    <div className="admin">
      <aside>
        <div className="brand">Gramaseva Admin</div>
        <div className="small" style={{ padding: '0 8px', color: '#a5d6a7' }}>{isSuper ? 'Super admin' : roleText(profile, lang)} · {profile.name}</div>
        {av.canSwitch ? (
          <select aria-label={L('വില്ലേജ്', 'Village')} value={av.villageId ?? ''} onChange={(e) => av.setVid(e.target.value)} style={{ margin: '8px 0' }}>
            {villages.map((v) => <option key={v.id} value={v.id}>{vname(v)}</option>)}
          </select>
        ) : <div style={{ padding: '10px 12px', background: 'var(--green)', borderRadius: 10, margin: '8px 0' }}>{av.village ? vname(av.village) : '—'}</div>}
        {links.filter((l) => l[3]).map(([to, Icon, label]) => (
          <NavLink key={to} to={to} end={to === '/admin'} className={({ isActive }) => (isActive ? 'active' : '')}><Icon size={18} aria-hidden />{label}</NavLink>
        ))}
        {authUser?.email && <a href="#" onClick={(e) => { e.preventDefault(); void changePw(); }} style={{ marginTop: 'auto' }}><KeyRound size={18} aria-hidden />{L('പാസ്‌വേഡ് മാറ്റുക', 'Change password')}</a>}
        <Link to="/" style={authUser?.email ? undefined : { marginTop: 'auto' }}><ArrowLeft size={18} aria-hidden />{L('App-ലേക്ക്', 'Back to app')}</Link>
      </aside>
      <main>
        <Routes>
          <Route index element={av.villageId ? <Dashboard villageId={av.villageId} title={av.village ? vname(av.village) : ''} /> : <NoVillage isSuper={isSuper} />} />
          <Route path="news" element={av.villageId ? <NewsAdmin villageId={av.villageId} /> : <NoVillage isSuper={isSuper} />} />
          <Route path="providers" element={av.villageId ? <ProvidersAdmin villageId={av.villageId} /> : <NoVillage isSuper={isSuper} />} />
          <Route path="messages" element={av.villageId ? <><h1 className="h1">{L('നാട്ടുകാരുടെ പരാതി / സന്ദേശം', 'Resident messages')}</h1><ComplaintInbox villageId={av.villageId} /></> : <NoVillage isSuper={isSuper} />} />
          <Route path="reports" element={av.villageId ? <ReportsAdmin villageId={av.villageId} /> : <NoVillage isSuper={isSuper} />} />
          <Route path="import" element={isSuper ? <ImportAdmin selectedVillageId={av.villageId} /> : <Navigate to="/admin" />} />
          <Route path="villages" element={isSuper ? <VillagesAdmin /> : <Navigate to="/admin" />} />
          <Route path="team" element={isSuper ? <TeamAdmin /> : isHead && av.villageId ? <HeadTeam villageId={av.villageId} /> : <Navigate to="/admin" />} />
          <Route path="users" element={isSuper ? <UsersAdmin /> : <Navigate to="/admin" />} />
        </Routes>
      </main>
    </div>
  );
}

function NoVillage({ isSuper }: { isSuper: boolean }) {
  const { L } = useApp();
  return (
    <div className="notice warn">
      {isSuper
        ? <span>{L('ആദ്യം ഒരു വില്ലേജ് ചേർക്കുക: ', 'Add a village first: ')}<Link className="link" to="/admin/villages">{L('വില്ലേജുകൾ →', 'Villages →')}</Link></span>
        : L('നിങ്ങൾക്ക് ഇതുവരെ ഒരു വില്ലേജ് നൽകിയിട്ടില്ല. Super admin-നെ ബന്ധപ്പെടുക.', 'You have not been given a village yet. Contact the super admin.')}
    </div>
  );
}

function Panel({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return <section className="panel"><div className="row between" style={{ marginBottom: 6 }}><h2 style={{ fontSize: 18 }}>{title}</h2>{action}</div>{children}</section>;
}

function Dashboard({ villageId, title }: { villageId: string; title: string }) {
  const { api, L } = useApp();
  const [stats, reloadStats] = useLoad(() => api.villageStats(villageId), [villageId]);
  const [pend, reloadP] = useLoad(() => api.listVillageProviders(villageId, 'pending'), [villageId]);
  const [news, reloadN] = useLoad(() => api.listNews(villageId, { includePending: true }), [villageId]);
  const pendingNews = (news ?? []).filter((n) => n.status === 'pending');
  const reloadAll = () => { reloadStats(); reloadP(); reloadN(); };
  return (
    <>
      <h1 className="h1">Dashboard — {title}</h1>
      <div className="stats">
        {[
          [stats?.users, L('Users', 'Users')],
          [stats?.providers, L('സേവനദാതാക്കൾ', 'Providers')],
          [stats?.bookings, L('ആകെ ബുക്കിംഗ്', 'Total bookings')],
          [stats?.pending, L('നടപടി വേണ്ടവ', 'Need action')],
        ].map(([v, l], i) => (
          <div key={i} className="stat"><b style={{ color: i === 3 && Number(v) > 0 ? 'var(--red)' : undefined }}>{v ?? '…'}</b><span className="muted">{l}</span></div>
        ))}
      </div>
      <div className="panels">
        <Panel title={L('Verify ചെയ്യാനുള്ള സേവനദാതാക്കൾ', 'Providers to verify')} action={<Link className="link" to="/admin/providers">{L('എല്ലാം', 'All')}</Link>}>
          {(pend ?? []).map((p) => <ProviderRow key={p.uid} p={p} onChange={reloadAll} />)}
          {pend && pend.length === 0 && <p className="muted">{L('ഒന്നുമില്ല.', 'Nothing pending.')}</p>}
        </Panel>
        <Panel title={L('Approve ചെയ്യാനുള്ള വാർത്ത', 'News to approve')} action={<Link className="link" to="/admin/news">{L('വാർത്ത ചേർക്കുക', 'Post news')}</Link>}>
          {pendingNews.map((n) => (
            <div key={n.id} className="item">
              <span className="stack grow"><b>{n.title}</b><span className="muted small">{n.postedByName} · {n.body.slice(0, 80)}</span></span>
              <button className="btn sm" onClick={async () => { await api.setNewsStatus(n.id, 'published'); reloadAll(); }}>Approve</button>
              <button className="btn sm danger" onClick={async () => { await api.setNewsStatus(n.id, 'rejected'); reloadAll(); }}>Reject</button>
            </div>
          ))}
          {news && pendingNews.length === 0 && <p className="muted">{L('ഒന്നുമില്ല.', 'Nothing pending.')}</p>}
        </Panel>
      </div>
    </>
  );
}

function ProviderRow({ p, onChange }: { p: Provider; onChange: () => void }) {
  const { api, L, lang, pair, toast } = useApp();
  const set = async (status: ProviderStatus, verified: boolean) => {
    await api.reviewProvider(p.uid, status, verified);
    toast(status === 'approved' ? L('Approve ചെയ്തു', 'Approved') : L('സേവ് ചെയ്തു', 'Saved'));
    onChange();
  };
  return (
    <div className="item">
      <Avatar name={p.name} />
      <span className="stack grow">
        <b>{p.name} {p.verified && <BadgeCheck size={15} color="var(--green)" aria-label="verified" />}</b>
        <span className="muted small">{jobName(p, pair)} · {rateText(p, lang)}{p.vehicleNo ? ` · ${p.vehicleNo}` : ''} · <span className="num" style={{ userSelect: 'all' }}>{prettyPhone(p.phone)}</span></span>
        <span className="muted small">{timeAgo(p.createdAt, lang)}</span>
      </span>
      {p.status === 'pending' && <>
        <button className="btn sm" onClick={() => set('approved', true)}>Approve</button>
        <button className="btn sm danger" onClick={() => set('rejected', false)}>Reject</button>
      </>}
    </div>
  );
}

function ProvidersAdmin({ villageId }: { villageId: string }) {
  const { api, L, lang, pair, toast } = useApp();
  const [list, reload] = useLoad(() => api.listVillageProviders(villageId), [villageId]);
  const set = async (p: Provider, status: ProviderStatus, verified: boolean) => {
    await api.reviewProvider(p.uid, status, verified); toast(L('സേവ് ചെയ്തു', 'Saved')); reload();
  };
  const label: Record<ProviderStatus, [string, string]> = {
    pending: ['badge warn', L('കാത്തിരിക്കുന്നു', 'Pending')], approved: ['badge', L('Approved', 'Approved')],
    rejected: ['badge bad', L('Rejected', 'Rejected')], blocked: ['badge bad', L('Blocked', 'Blocked')],
  };
  return (
    <>
      <h1 className="h1">{L('സേവനദാതാക്കൾ', 'Providers')}</h1>
      <p className="muted">{L('ആളെ നേരിട്ട് അറിയാമെങ്കിൽ / വാർഡ് മെമ്പർ സ്ഥിരീകരിച്ചാൽ മാത്രം Verified കൊടുക്കുക.', 'Give Verified only when you know the person or a ward member has confirmed them.')}</p>
      <div className="tablewrap">
        <table>
          <thead><tr><th>{L('പേര്', 'Name')}</th><th>{L('പണി', 'Work')}</th><th>{L('ഫോൺ', 'Phone')}</th><th>{L('റേറ്റിംഗ്', 'Rating')}</th><th>Status</th><th>Verified</th><th></th></tr></thead>
          <tbody>
            {(list ?? []).map((p) => (
              <tr key={p.uid}>
                <td><b>{p.name}</b></td>
                <td>{jobName(p, pair)}<div className="muted small">{rateText(p, lang)}{p.vehicleNo ? ` · ${p.vehicleNo}` : ''}</div></td>
                <td className="num" style={{ userSelect: 'all' }}>{prettyPhone(p.phone)}</td>
                <td className="num">{p.ratingCount ? `${rating(p).toFixed(1)} (${p.ratingCount})` : '—'}</td>
                <td><span className={label[p.status][0]}>{label[p.status][1]}</span></td>
                <td><input type="checkbox" aria-label="verified" checked={p.verified} onChange={(e) => set(p, p.status, e.target.checked)} /></td>
                <td>
                  <div className="row nowrap">
                    {p.status !== 'approved' && <button className="btn sm" onClick={() => set(p, 'approved', p.verified)}>Approve</button>}
                    {p.status === 'approved' && <button className="btn sm danger" onClick={() => set(p, 'blocked', false)}>Block</button>}
                    {p.status === 'pending' && <button className="btn sm danger" onClick={() => set(p, 'rejected', false)}>Reject</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {list && list.length === 0 && <p className="muted" style={{ padding: 12 }}>{L('ഈ വില്ലേജിൽ ഇതുവരെ ആരും ചേർന്നിട്ടില്ല.', 'No one has joined in this village yet.')}</p>}
      </div>
    </>
  );
}

function NewsAdmin({ villageId }: { villageId: string }) {
  const { api, profile, villages, L, lang, pair, toast } = useApp();
  const wards = sortedWards(villages.find((v) => v.id === villageId), lang);
  const [ward, setWard] = useState('');
  const [list, reload] = useLoad(() => api.listNews(villageId, { includePending: true }), [villageId]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [cat, setCat] = useState<NewsCat>('panchayat');
  const [important, setImportant] = useState(false);
  const [by, setBy] = useState('');

  async function post() {
    if (!profile) return;
    await api.createNews({
      villageId, title: title.trim(), body: body.trim(), category: cat, ...(ward ? { ward } : {}), important, status: 'published',
      postedBy: profile.uid, postedByName: by.trim() || profile.name, createdAt: Date.now(),
    });
    setTitle(''); setBody(''); setImportant(false);
    toast(L('വാർത്ത പ്രസിദ്ധീകരിച്ചു', 'News published'));
    reload();
  }

  return (
    <>
      <h1 className="h1">{L('വാർത്ത', 'News')}</h1>
      <div className="panels">
        <Panel title={L('പുതിയ വാർത്ത', 'Post news')}>
          <div className="stack-lg">
            <select className="input" aria-label={L('വിഭാഗം', 'Category')} value={cat} onChange={(e) => setCat(e.target.value as NewsCat)}>
              {NEWS_CATS.map((c) => <option key={c} value={c}>{pair(NEWS_LABEL[c])}</option>)}
            </select>
            {wards.length > 0 && (
              <select className="input" aria-label={L('വാർഡ്', 'Ward')} value={ward} onChange={(e) => setWard(e.target.value)}>
                <option value="">{L('പഞ്ചായത്ത് മുഴുവൻ', 'Whole panchayat')}</option>
                {wards.map((w) => <option key={w.no} value={String(w.no)}>{lang === 'ml' ? w.name : w.nameEn} ({w.member})</option>)}
              </select>
            )}
            <input className="input" aria-label={L('തലക്കെട്ട്', 'Headline')} placeholder={L('തലക്കെട്ട്', 'Headline')} value={title} onChange={(e) => setTitle(e.target.value)} />
            <textarea className="input" aria-label={L('വിവരം', 'Details')} placeholder={L('വിവരം', 'Details')} rows={5} value={body} onChange={(e) => setBody(e.target.value)} />
            <input className="input" aria-label={L('ആരുടെ അറിയിപ്പ്', 'From')} placeholder={L('ആരുടെ അറിയിപ്പ് (ഉദാ: KSEB, പഞ്ചായത്ത്)', 'From (e.g. KSEB, Panchayat)')} value={by} onChange={(e) => setBy(e.target.value)} />
            <label className="row"><input type="checkbox" checked={important} onChange={(e) => setImportant(e.target.checked)} />{L('പ്രധാന അറിയിപ്പ് (ഹോമിൽ മുകളിൽ കാണിക്കും)', 'Important (shown at the top of Home)')}</label>
            <button className="btn" disabled={title.trim().length < 3 || body.trim().length < 3} onClick={post}>{L('പ്രസിദ്ധീകരിക്കുക', 'Publish')}</button>
          </div>
        </Panel>
        <Panel title={L('എല്ലാ വാർത്തകളും', 'All news')}>
          {(list ?? []).map((n) => (
            <div key={n.id} className="item">
              <span className="stack grow">
                <span className="row"><span className={n.status === 'pending' ? 'badge warn' : 'badge'}>{n.status === 'pending' ? L('കാത്തിരിക്കുന്നു', 'Pending') : pair(NEWS_LABEL[n.category])}</span><span className="muted small">{timeAgo(n.createdAt, lang)}{n.ward ? ` · ${wardLabel(villages.find((v) => v.id === villageId), n.ward, lang)}` : ''}</span></span>
                <b>{n.title}</b>
                <span className="muted small">{n.postedByName}</span>
              </span>
              {n.status === 'pending' && <button className="btn sm" onClick={async () => { await api.setNewsStatus(n.id, 'published'); reload(); }}>Approve</button>}
              <button className="btn sm danger" onClick={async () => { await api.setNewsStatus(n.id, 'rejected'); reload(); }}>{n.status === 'pending' ? 'Reject' : L('മാറ്റുക', 'Remove')}</button>
            </div>
          ))}
        </Panel>
      </div>
    </>
  );
}

function ReportsAdmin({ villageId }: { villageId: string }) {
  const { api, L, lang, toast } = useApp();
  const [list, reload] = useLoad(() => api.listReports(villageId), [villageId]);
  return (
    <>
      <h1 className="h1">{L('പരാതികൾ', 'Complaints')}</h1>
      <div className="panel">
        {(list ?? []).map((r) => (
          <div key={r.id} className="item">
            <TriangleAlert size={22} color={r.status === 'open' ? 'var(--red)' : 'var(--grey)'} aria-hidden />
            <span className="stack grow">
              <b>{r.againstName}</b>
              <span>{r.reason}</span>
              <span className="muted small">{L('പരാതി നൽകിയത്', 'From')}: {r.reporterName} · {timeAgo(r.createdAt, lang)}</span>
            </span>
            {r.status === 'open' ? <>
              <button className="btn sm danger" onClick={async () => { await api.reviewProvider(r.againstId, 'blocked', false); await api.resolveReport(r.id); toast(L('Block ചെയ്തു', 'Blocked')); reload(); }}>Block</button>
              <button className="btn sm outline" onClick={async () => { await api.resolveReport(r.id); reload(); }}>{L('പരിഹരിച്ചു', 'Resolved')}</button>
            </> : <span className="badge grey">{L('പരിഹരിച്ചു', 'Resolved')}</span>}
          </div>
        ))}
        {list && list.length === 0 && <p className="muted">{L('പരാതികളൊന്നുമില്ല.', 'No complaints.')}</p>}
      </div>
    </>
  );
}

function VillagesAdmin() {
  const { api, villages, refresh, L, toast } = useApp();
  const blank: Village = { id: '', name: '', nameEn: '', panchayat: '', district: '', status: 'soon', lat: 10.5, lng: 76.2, panchayatPhone: '' };
  const [v, setV] = useState<Village>(blank);
  const set = (k: keyof Village, val: string | number) => setV({ ...v, [k]: val });
  const [finding, setFinding] = useState(false);
  async function fromLocation() {
    setFinding(true);
    try {
      const here = await getPosition();
      const p = await reverseGeocode(here.lat, here.lng);
      setV({ ...v, lat: p.lat, lng: p.lng, name: p.village || v.name, nameEn: p.villageEn || v.nameEn, panchayat: p.panchayat || v.panchayat, district: p.district || v.district });
    } catch {
      toast(L('Location കിട്ടിയില്ല', "Couldn't get your location"));
    } finally { setFinding(false); }
  }
  async function save() {
    const id = v.id || v.nameEn.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    await api.saveVillage({ ...v, id, lat: Number(v.lat), lng: Number(v.lng) });
    await refresh();
    setV(blank);
    toast(L('വില്ലേജ് സേവ് ചെയ്തു', 'Village saved'));
  }
  return (
    <>
      <h1 className="h1">{L('വില്ലേജുകൾ', 'Villages')}</h1>
      <p className="muted">{L('പുതിയ വില്ലേജ് ചേർക്കാൻ: വിവരങ്ങൾ നൽകുക → "ഉടൻ വരുന്നു" ആയി സേവ് ചെയ്യുക → Coordinator-നെ നിയമിക്കുക → 20 പണിക്കാരെ ചേർത്ത ശേഷം "ലഭ്യം" ആക്കുക.', 'To launch a village: add it as "Coming soon" → appoint a coordinator → after 20 providers join, switch it to "Live".')}</p>
      <div className="panels">
        <Panel title={v.id ? L('വില്ലേജ് മാറ്റുക', 'Edit village') : L('പുതിയ വില്ലേജ്', 'New village')}>
          <div className="stack-lg">
            <button className="btn outline" onClick={fromLocation} disabled={finding}>{finding ? L('കണ്ടെത്തുന്നു…', 'Finding…') : L('📍 ഇപ്പോഴത്തെ location-ൽ നിന്ന് നിറയ്ക്കുക', '📍 Fill from my current location')}</button>
            <input className="input" aria-label="name ml" placeholder={L('പേര് (മലയാളം)', 'Name (Malayalam)')} value={v.name} onChange={(e) => set('name', e.target.value)} />
            <input className="input" aria-label="name en" placeholder={L('പേര് (English)', 'Name (English)')} value={v.nameEn} onChange={(e) => set('nameEn', e.target.value)} />
            <input className="input" aria-label="panchayat" placeholder={L('പഞ്ചായത്ത്', 'Panchayat')} value={v.panchayat} onChange={(e) => set('panchayat', e.target.value)} />
            <input className="input" aria-label="district" placeholder={L('ജില്ല', 'District')} value={v.district} onChange={(e) => set('district', e.target.value)} />
            <div className="row nowrap">
              <input className="input" aria-label="lat" inputMode="decimal" placeholder="Latitude" value={v.lat} onChange={(e) => set('lat', e.target.value)} />
              <input className="input" aria-label="lng" inputMode="decimal" placeholder="Longitude" value={v.lng} onChange={(e) => set('lng', e.target.value)} />
            </div>
            <p className="muted small">{L('Google Maps-ൽ വില്ലേജ് മധ്യത്തിൽ long-press ചെയ്താൽ latitude, longitude കിട്ടും.', 'Long-press the village centre in Google Maps to get its latitude and longitude.')}</p>
            <input className="input" aria-label="panchayat phone" placeholder={L('പഞ്ചായത്ത് ഓഫീസ് ഫോൺ', 'Panchayat office phone')} value={v.panchayatPhone ?? ''} onChange={(e) => set('panchayatPhone', e.target.value)} />
            <select className="input" aria-label="status" value={v.status} onChange={(e) => set('status', e.target.value)}>
              <option value="soon">{L('ഉടൻ വരുന്നു', 'Coming soon')}</option>
              <option value="live">{L('ലഭ്യം (Live)', 'Live')}</option>
            </select>
            <button className="btn" disabled={!v.name.trim() || !v.nameEn.trim() || !v.panchayat.trim() || !v.district.trim()} onClick={save}>{L('സേവ് ചെയ്യുക', 'Save')}</button>
          </div>
        </Panel>
        <Panel title={L('എല്ലാ വില്ലേജുകളും', 'All villages')}>
          {villages.map((x) => (
            <div key={x.id} className="item">
              <MapPin size={20} color={x.status === 'live' ? 'var(--green)' : 'var(--grey)'} aria-hidden />
              <span className="stack grow"><b>{x.name} · {x.nameEn}</b><span className="muted small">{x.panchayat}, {x.district}</span></span>
              <span className={x.status === 'live' ? 'badge' : 'badge grey'}>{x.status === 'live' ? 'Live' : L('ഉടൻ', 'Soon')}</span>
              <button className="btn sm outline" onClick={() => setV(x)}>{L('മാറ്റുക', 'Edit')}</button>
            </div>
          ))}
        </Panel>
      </div>
    </>
  );
}

function TeamAdmin() {
  const { api, villages, profile, L, lang, toast } = useApp();
  const [list, reload] = useLoad(() => api.listCoordinators(), []);
  const [reqs, reloadReqs] = useLoad(() => api.listRoleRequests(), []);
  const [who, setWho] = useState('');
  const [role, setRole] = useState<'coordinator' | 'superadmin'>('coordinator');
  const [pos, setPos] = useState<StaffPosition>('member');
  const [vid, setVid] = useState(villages[0]?.id ?? '');
  const vname = (id?: string | null) => { const v = villages.find((x) => x.id === id); return v ? (lang === 'ml' ? v.name : v.nameEn) : '—'; };
  const isEmail = who.includes('@');
  const digits = who.replace(/\D/g, '').slice(-10);

  async function assign() {
    const u = isEmail ? await api.findUserByEmail(who.trim().toLowerCase()) : await api.findUserByPhone('+91' + digits);
    if (!u) return toast(L('ഇവർ ഇതുവരെ ഗ്രാമസേവയിൽ ഇല്ല. ആദ്യം അവർ app-ൽ login ചെയ്ത് profile ഉണ്ടാക്കണം.', 'Not found. They must log in to the app and create a profile first.'));
    if (u.uid === profile?.uid) return toast(L('സ്വന്തം അധികാരം ഇവിടെ മാറ്റാൻ പറ്റില്ല.', "You can't change your own access here."));
    await api.setRole(u.uid, role, role === 'coordinator' ? vid : null, role === 'coordinator' ? pos : null);
    setWho('');
    toast(role === 'superadmin'
      ? L(`${u.name} ഇനി Super admin ആണ്`, `${u.name} is now a super admin`)
      : L(`${u.name} ഇനി ${vname(vid)} admin ആണ്`, `${u.name} is now admin of ${vname(vid)}`));
    reload();
  }

  async function decide(r: RoleRequest, ok: boolean) {
    await api.decideRoleRequest(r, ok);
    toast(ok ? L(`${r.name} ഇനി ${vname(r.villageId)} admin ആണ്`, `${r.name} is now admin of ${vname(r.villageId)}`) : L('നിരസിച്ചു', 'Declined'));
    reloadReqs(); reload();
  }

  const pending = (reqs ?? []).filter((r) => r.status === 'pending');

  return (
    <>
      <h1 className="h1">{L('Admin-മാർ', 'Admins')}</h1>
      <p className="muted">{L('Village admin (വാർഡ് മെമ്പർ / coordinator): ആ വില്ലേജിലെ വാർത്തയും പണിക്കാരെയും പരാതികളും approve ചെയ്യാം. Super admin: എല്ലാ വില്ലേജുകളും, പുതിയ admin-മാരെയും.',
        'Village admin (ward member / coordinator): approves news, workers and complaints for that village. Super admin: all villages, and can appoint admins.')}</p>
      <Panel title={L(`Admin ആകാനുള്ള അപേക്ഷകൾ (${pending.length})`, `Admin requests (${pending.length})`)}>
        {pending.map((r) => (
          <div key={r.uid} className="item">
            <Avatar name={r.name} />
            <span className="stack grow">
              <b>{r.name} · {r.position}</b>
              <span className="muted small num">{prettyPhone(r.phone)} · {vname(r.villageId)} · {timeAgo(r.createdAt, lang)}</span>
              {r.note && <span className="small">{r.note}</span>}
            </span>
            <button className="btn sm" onClick={() => decide(r, true)}>Approve</button>
            <button className="btn sm danger" onClick={() => decide(r, false)}>Reject</button>
          </div>
        ))}
        {reqs && pending.length === 0 && <p className="muted">{L('പുതിയ അപേക്ഷകളില്ല. Users-ന് Profile → "Admin ആകാൻ അപേക്ഷിക്കുക" വഴി അപേക്ഷിക്കാം.', 'No new requests. Users can apply from Profile → "Apply to be an admin".')}</p>}
      </Panel>
      <StaffLoginPanel onDone={reload} />
      <div className="panels">
        <Panel title={L('നേരിട്ട് admin ആക്കുക', 'Make someone an admin')}>
          <div className="stack-lg">
            <p className="muted small">{L('അവർ ആദ്യം സ്വന്തം ഫോണിൽ ഗ്രാമസേവയിൽ login ചെയ്ത് profile ഉണ്ടാക്കിയിരിക്കണം.', 'They must first log in to Gramaseva and create a profile.')}</p>
            <input className="input" aria-label="phone or email" value={who} onChange={(e) => setWho(e.target.value)} placeholder={L('ഫോൺ നമ്പർ അല്ലെങ്കിൽ email', 'Phone number or email')} />
            <select className="input" aria-label="role" value={role} onChange={(e) => setRole(e.target.value as 'coordinator' | 'superadmin')}>
              <option value="coordinator">{L('Village admin (വാർഡ് മെമ്പർ / coordinator)', 'Village admin (ward member / coordinator)')}</option>
              <option value="superadmin">Super admin</option>
            </select>
            {role === 'coordinator' && (<>
              <PositionSelect value={pos} onChange={setPos} />
              <select className="input" aria-label="village" value={vid} onChange={(e) => setVid(e.target.value)}>
                {villages.map((v) => <option key={v.id} value={v.id}>{lang === 'ml' ? v.name : v.nameEn}</option>)}
              </select>
            </>)}
            {role === 'superadmin' && <div className="notice warn">{L('Super admin-ന് എല്ലാം മാറ്റാം. വളരെ വിശ്വാസമുള്ളവർക്ക് മാത്രം കൊടുക്കുക.', 'A super admin can change everything. Give this only to people you fully trust.')}</div>}
            <button className="btn" disabled={!(isEmail ? who.includes('.') : digits.length === 10) || (role === 'coordinator' && !vid)} onClick={assign}>{L('അധികാരം കൊടുക്കുക', 'Give access')}</button>
          </div>
        </Panel>
        <Panel title={L('ഇപ്പോഴത്തെ village admin-മാർ', 'Current village admins')}>
          {(list ?? []).map((u) => (
            <div key={u.uid} className="item">
              <Avatar name={u.name} />
              <span className="stack grow"><b>{u.name}</b><span className="small"><span className="badge">{roleText(u, lang)}</span> {vname(u.coordinatorOf)}</span><span className="muted small num">{prettyPhone(u.phone)}{u.email ? ` · ${u.email.replace('@gramaseva.app', '')}` : ''}</span></span>
              <button className="btn sm danger" onClick={async () => { if (confirm(L(`${u.name}-ന്റെ admin അധികാരം മാറ്റണോ?`, `Remove ${u.name}'s admin access?`))) { await api.setRole(u.uid, 'user', null, null); reload(); } }}>{L('മാറ്റുക', 'Remove')}</button>
            </div>
          ))}
          {list && list.length === 0 && <p className="muted">{L('ഇതുവരെ ആരുമില്ല.', 'None yet.')}</p>}
        </Panel>
      </div>
    </>
  );
}

function PositionSelect({ value, onChange }: { value: StaffPosition; onChange: (p: StaffPosition) => void }) {
  const { lang } = useApp();
  return (
    <select className="input" aria-label="position" value={value} onChange={(e) => onChange(e.target.value as StaffPosition)}>
      {(Object.keys(POSITION_LABEL) as StaffPosition[]).map((p) => <option key={p} value={p}>{lang === 'ml' ? POSITION_LABEL[p][0] : POSITION_LABEL[p][1]}</option>)}
    </select>
  );
}

/** Super admin: make a username + password login for a president / vice president / ward member. */
function StaffLoginPanel({ onDone }: { onDone: () => void }) {
  const { api, villages, L, lang, toast } = useApp();
  const empty = { name: '', phone: '', username: '', password: '', ward: '' };
  const [f, setF] = useState(empty);
  const [pos, setPos] = useState<StaffPosition>('president');
  const [vid, setVid] = useState(villages[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState<{ username: string; password: string; name: string } | null>(null);
  const wards = sortedWards(villages.find((v) => v.id === vid), lang);
  const digits = f.phone.replace(/\D/g, '').slice(-10);
  const uname = f.username.trim().toLowerCase();
  const unameOk = /^[a-z0-9._-]{3,30}$/.test(uname) && uname !== 'upasnath';
  const ok = f.name.trim().length >= 2 && /^[6-9]\d{9}$/.test(digits) && unameOk && f.password.length >= 6 && !!vid && (pos !== 'member' || !wards.length || !!f.ward);

  async function create() {
    if (!ok || busy) return;
    setBusy(true);
    try {
      await api.createStaffLogin({ username: uname, password: f.password, name: f.name.trim(), phone: '+91' + digits, villageId: vid, ...(f.ward ? { ward: f.ward } : {}), position: pos });
      setMade({ username: uname, password: f.password, name: f.name.trim() });
      setF(empty); onDone();
    } catch (e) {
      console.error(e);
      const code = (e as { code?: string }).code ?? '';
      toast(code.includes('email-already-in-use') ? L('ഈ username നേരത്തെ ഉണ്ട്. വേറെ ഒന്ന് കൊടുക്കുക.', 'This username is taken. Try another.')
        : code.includes('weak-password') ? L('പാസ്‌വേഡ് കുറച്ചുകൂടി ശക്തമാക്കുക', 'Use a stronger password')
        : L('Login ഉണ്ടാക്കാൻ പറ്റിയില്ല', "Couldn't create the login"));
    } finally { setBusy(false); }
  }

  return (
    <Panel title={L('പ്രസിഡന്റ് / വൈസ് പ്രസിഡന്റ് / മെമ്പർക്ക് login ഉണ്ടാക്കുക', 'Create a login for President / VP / Member')}>
      {made && (
        <div className="notice" style={{ display: 'block' }}>
          <b>{L(`${made.name}-ന് login ഉണ്ടാക്കി ✓`, `Login created for ${made.name} ✓`)}</b>
          <div>Username: <b className="num">{made.username}</b></div>
          <div>{L('പാസ്‌വേഡ്', 'Password')}: <b className="num">{made.password}</b></div>
          <div className="small">{L('ഇത് അവർക്ക് നേരിട്ട് കൊടുക്കുക. App-ൽ "Email / username" login വഴി കയറാം. ആദ്യം കയറിയാൽ Admin panel-ലെ "പാസ്‌വേഡ് മാറ്റുക" വഴി പാസ്‌വേഡ് മാറ്റാൻ പറയുക.',
            'Give these to them in person. They log in with "Email / username" in the app, then change the password from the Admin panel.')}</div>
          <button className="btn sm outline" style={{ marginTop: 6 }} onClick={() => setMade(null)}>OK</button>
        </div>
      )}
      <div className="stack-lg">
        <PositionSelect value={pos} onChange={setPos} />
        <select className="input" aria-label="village" value={vid} onChange={(e) => { setVid(e.target.value); setF({ ...f, ward: '' }); }}>
          {villages.map((v) => <option key={v.id} value={v.id}>{lang === 'ml' ? v.name : v.nameEn}</option>)}
        </select>
        {wards.length > 0 && (
          <select className="input" aria-label="ward" value={f.ward} onChange={(e) => setF({ ...f, ward: e.target.value })}>
            <option value="">{pos === 'member' ? L('വാർഡ് തിരഞ്ഞെടുക്കുക', 'Choose ward') : L('വാർഡ് (വേണമെങ്കിൽ)', 'Ward (optional)')}</option>
            {wards.map((w) => <option key={w.no} value={String(w.no)}>{lang === 'ml' ? w.name : w.nameEn}{w.member ? ` — ${w.member}` : ''}</option>)}
          </select>
        )}
        <input className="input" aria-label="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder={L('പേര്', 'Name')} />
        <input className="input" aria-label="phone" inputMode="numeric" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder={L('ഫോൺ നമ്പർ (10 അക്കം)', 'Phone (10 digits)')} />
        <input className="input" aria-label="username" autoCapitalize="none" autoComplete="off" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} placeholder={L('Username (ഉദാ: thakazhy.president)', 'Username (e.g. thakazhy.president)')} />
        {f.username && !unameOk && <span className="small" style={{ color: 'var(--red, #c62828)' }}>{L('3–30 ഇംഗ്ലീഷ് അക്ഷരം / അക്കം / . _ - മാത്രം', '3–30 letters, digits, . _ - only')}</span>}
        <input className="input" aria-label="password" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} placeholder={L('പാസ്‌വേഡ് (കുറഞ്ഞത് 6)', 'Password (min 6)')} />
        <button className="btn" disabled={!ok || busy} onClick={create}>{busy ? L('ഉണ്ടാക്കുന്നു…', 'Creating…') : L('Login ഉണ്ടാക്കുക', 'Create login')}</button>
        <p className="muted small">{L('ഇവർക്ക് വാർത്ത, പരാതികൾ, മറുപടി, സ്കൂൾ / ആശുപത്രി / ആശാ വർക്കർ വിവരങ്ങൾ എന്നിവ ചെയ്യാം. Payment, പരസ്യം, Business panel ഒന്നും കാണില്ല. പ്രസിഡന്റിനും വൈസ് പ്രസിഡന്റിനും വാർഡ് മെമ്പർമാരെ approve ചെയ്യാം.',
          'They can post news, see and reply to complaints, and add schools / hospitals / ASHA workers. They never see payments, ads or the Business panel. President and VP can approve ward members.')}</p>
      </div>
    </Panel>
  );
}

/** President / vice president: approve ward-member requests of their panchayat, see and remove members. */
function HeadTeam({ villageId }: { villageId: string }) {
  const { api, profile, villages, L, lang, toast } = useApp();
  const [reqs, reloadReqs] = useLoad(() => api.listRoleRequests(villageId), [villageId]);
  const [team, reloadTeam] = useLoad(() => api.listCoordinators(villageId), [villageId]);
  const village = villages.find((v) => v.id === villageId);
  async function decide(r: RoleRequest, ok: boolean) {
    try {
      await api.decideRoleRequest(r, ok);
      toast(ok ? L(`${r.name} ഇനി വാർഡ് മെമ്പർ ആണ്`, `${r.name} is now a ward member`) : L('നിരസിച്ചു', 'Declined'));
      reloadReqs(); reloadTeam();
    } catch (e) { console.error(e); toast(L('പറ്റിയില്ല', "Couldn't do that")); }
  }
  return (
    <>
      <h1 className="h1">{L('വാർഡ് മെമ്പർമാർ', 'Ward members')}</h1>
      <Panel title={L(`മെമ്പർ ആകാനുള്ള അപേക്ഷകൾ (${reqs?.length ?? 0})`, `Member requests (${reqs?.length ?? 0})`)}>
        {(reqs ?? []).map((r) => (
          <div key={r.uid} className="item">
            <Avatar name={r.name} />
            <span className="stack grow">
              <b>{r.name} · {r.position}</b>
              <span className="muted small num">{prettyPhone(r.phone)} · {timeAgo(r.createdAt, lang)}</span>
              {r.note && <span className="small">{r.note}</span>}
            </span>
            <button className="btn sm" onClick={() => decide(r, true)}>Approve</button>
            <button className="btn sm danger" onClick={() => decide(r, false)}>Reject</button>
          </div>
        ))}
        {reqs && reqs.length === 0 && <p className="muted">{L('പുതിയ അപേക്ഷകളില്ല. മെമ്പർമാർക്ക് Profile → "Admin / വാർഡ് മെമ്പർ ആകാൻ അപേക്ഷിക്കുക" വഴി അപേക്ഷിക്കാം.', 'No new requests. Members can apply from Profile → "Apply to be an admin / ward member".')}</p>}
      </Panel>
      <Panel title={L('ഇപ്പോഴത്തെ ടീം', 'Current team')}>
        {(team ?? []).map((u) => (
          <div key={u.uid} className="item">
            <Avatar name={u.name} />
            <span className="stack grow">
              <b>{u.name}</b>
              <span className="small"><span className="badge">{roleText(u, lang)}</span>{u.ward ? ` ${wardLabel(village, u.ward, lang)}` : ''}</span>
              <span className="muted small num">{prettyPhone(u.phone)}</span>
            </span>
            {(u.position ?? 'member') === 'member' && u.uid !== profile?.uid && (
              <button className="btn sm danger" onClick={async () => {
                if (!confirm(L(`${u.name}-നെ മെമ്പർ സ്ഥാനത്ത് നിന്ന് മാറ്റണോ?`, `Remove ${u.name} as a member?`))) return;
                try { await api.setRole(u.uid, 'user', null, null); reloadTeam(); } catch (e) { console.error(e); toast(L('പറ്റിയില്ല', "Couldn't do that")); }
              }}>{L('മാറ്റുക', 'Remove')}</button>
            )}
          </div>
        ))}
        {team && team.length === 0 && <p className="muted">{L('ഇതുവരെ ആരുമില്ല.', 'None yet.')}</p>}
      </Panel>
    </>
  );
}

type UserFilter = 'all' | 'super' | 'president' | 'vice' | 'member' | 'user';
/** Super admin: every user and their role. */
function UsersAdmin() {
  const { api, villages, L, lang } = useApp();
  const [list, reload, err] = useLoad(() => api.listUsers(), []);
  const [q, setQ] = useState('');
  const [f, setFilter] = useState<UserFilter>('all');
  const vname = (id?: string | null) => { const v = villages.find((x) => x.id === id); return v ? (lang === 'ml' ? v.name : v.nameEn) : '—'; };
  const kind = (u: UserProfile): UserFilter => (u.role === 'superadmin' ? 'super' : u.role === 'coordinator' ? (u.position ?? 'member') : 'user');
  const all = list ?? [];
  const count = (k: UserFilter) => (k === 'all' ? all.length : all.filter((u) => kind(u) === k).length);
  const t = q.trim().toLowerCase();
  const shown = all.filter((u) => (f === 'all' || kind(u) === f)
    && (!t || u.name.toLowerCase().includes(t) || u.phone.includes(t.replace(/\D/g, '') || '~') || (u.email ?? '').toLowerCase().includes(t)));
  const chips: [UserFilter, string][] = [
    ['all', L('എല്ലാം', 'All')], ['super', 'Super admin'], ['president', L('പ്രസിഡന്റ്', 'President')],
    ['vice', L('വൈസ് പ്രസിഡന്റ്', 'Vice President')], ['member', L('വാർഡ് മെമ്പർ', 'Ward members')], ['user', L('Users', 'Users')],
  ];
  return (
    <>
      <h1 className="h1">{L('എല്ലാ users', 'All users')}</h1>
      {err && <div className="notice bad">{L('ലോഡ് ചെയ്യാൻ പറ്റിയില്ല', "Couldn't load")} <button className="btn sm" onClick={reload}>{L('വീണ്ടും', 'Retry')}</button></div>}
      <input className="input" aria-label="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={L('പേര് / ഫോൺ / username തിരയുക', 'Search name / phone / username')} />
      <div className="chips" style={{ margin: '8px 0' }}>
        {chips.map(([k, label]) => <button key={k} className={'chip' + (f === k ? ' on' : '')} onClick={() => setFilter(k)}>{label} ({count(k)})</button>)}
      </div>
      <Panel title={L(`${shown.length} പേർ`, `${shown.length} people`)}>
        {!list && !err && <p className="muted">{L('ലോഡ് ചെയ്യുന്നു…', 'Loading…')}</p>}
        {shown.map((u) => {
          const v = villages.find((x) => x.id === (u.coordinatorOf || u.villageId));
          return (
            <div key={u.uid} className="item">
              <Avatar name={u.name} />
              <span className="stack grow" style={{ minWidth: 0 }}>
                <b>{u.name}</b>
                <span className="small"><span className={u.role === 'user' ? 'badge grey' : 'badge'}>{roleText(u, lang)}</span> {vname(u.coordinatorOf || u.villageId)}{u.ward ? ` · ${wardLabel(v, u.ward, lang)}` : ''}</span>
                <span className="muted small num">{u.phone ? prettyPhone(u.phone) : ''}{u.email ? ` · ${u.email.replace('@gramaseva.app', '')}` : ''} · {timeAgo(u.createdAt, lang)}</span>
              </span>
            </div>
          );
        })}
      </Panel>
    </>
  );
}
