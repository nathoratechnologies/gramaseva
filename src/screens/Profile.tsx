import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ClipboardList, Newspaper, Truck, Briefcase, ShoppingBasket, Bell, ChevronRight, HardHat, Languages, LayoutDashboard, LifeBuoy, Lock, LogOut, MapPin, ShieldCheck, Trash2, Users } from 'lucide-react';
import { panchayatName, sortedWards, wardLabel } from '../lib/panchayat';
import { useApp, useLoad } from '../lib/app';
import { Avatar, Screen } from '../components/ui';
import { prettyPhone } from '../lib/util';
import { ConsentStep, PincodeStep, VillageStep } from './Onboarding';
import { isOwner } from '../lib/owner';
import { roleText } from '../types';
import { DISCLAIMER } from '../lib/store';

export function Profile() {
  const { api, profile, provider, authUser, homeVillage: village, refresh, L, lang, setLang, toast } = useApp();
  const nav = useNavigate();
  if (!profile) return null;
  const isAdmin = profile.role === 'superadmin' || profile.role === 'coordinator' || isOwner(profile, authUser);

  const Row = ({ to, icon, label, value, danger, onClick }: { to?: string; icon: JSX.Element; label: string; value?: string; danger?: boolean; onClick?: () => void }) => {
    const inner = (
      <>
        <span style={{ color: danger ? 'var(--red)' : 'var(--muted)', display: 'grid' }}>{icon}</span>
        <span className="grow" style={{ fontWeight: 600, color: danger ? 'var(--red)' : undefined }}>{label}</span>
        {value && <span className="muted small">{value}</span>}
        {!danger && <ChevronRight size={18} color="var(--grey)" aria-hidden />}
      </>
    );
    return to ? <Link to={to} className="card" style={{ padding: '12px 14px' }}>{inner}</Link>
      : <button className="card tap" style={{ padding: '12px 14px' }} onClick={onClick}>{inner}</button>;
  };

  return (
    <Screen title={L('പ്രൊഫൈൽ', 'Profile')} back={false} nav>
      <div className="card">
        <Avatar name={profile.name} />
        <span className="stack grow">
          <b style={{ fontSize: 17 }}>{profile.name}</b>
          <span className="muted small num">+91 {prettyPhone(profile.phone)}{profile.ward ? ` · ${wardLabel(village, profile.ward, lang)}` : ''}</span>
        </span>
      </div>
      <Row to="/profile/village" icon={<MapPin size={20} />} label={L('എന്റെ പഞ്ചായത്ത്', 'My panchayat')} value={village ? panchayatName(village, lang) : ''} />
      <Row to="/profile/pincode" icon={<MapPin size={20} />} label={L('എന്റെ പിൻകോഡ്', 'My PIN code')} value={profile.pincode ? `${profile.pincode}${profile.pinPlace ? ' · ' + profile.pinPlace.split(',')[0] : ''}` : ''} />
      {village?.wards?.length ? (
        <label className="card" style={{ padding: '12px 14px' }}>
          <span style={{ color: 'var(--muted)', display: 'grid' }}><Users size={20} /></span>
          <span className="grow" style={{ fontWeight: 600 }}>{L('എന്റെ വാർഡ്', 'My ward')}</span>
          <select aria-label={L('എന്റെ വാർഡ്', 'My ward')} value={profile.ward ?? ''} style={{ maxWidth: 170 }}
            onChange={async (e) => { await api.saveProfile({ ...profile, ward: e.target.value }); await refresh(); toast(L('വാർഡ് സേവ് ചെയ്തു', 'Ward saved')); }}>
            <option value="">—</option>
            {sortedWards(village, lang).map((w) => <option key={w.no} value={String(w.no)}>{lang === 'ml' ? w.name : w.nameEn}</option>)}
          </select>
        </label>
      ) : null}
      <Row icon={<Languages size={20} />} label={L('ഭാഷ', 'Language')} value={lang === 'ml' ? 'മലയാളം' : 'English'}
        onClick={async () => { const l = lang === 'ml' ? 'en' : 'ml'; setLang(l); await api.saveProfile({ ...profile, lang: l }); }} />
      <Row to={provider ? '/work' : '/work/register'} icon={<HardHat size={20} />} label={provider ? L('എന്റെ പണി', 'My work') : L('സേവനദാതാവായി ചേരുക', 'Join as a provider')} />
      <Row to="/bookings" icon={<ClipboardList size={20} />} label={L('എന്റെ ബുക്കിംഗുകൾ (പണിക്കാർ / വണ്ടി)', 'My bookings (workers / rides)')} />
      <Row to="/news" icon={<Newspaper size={20} />} label={L('ഗ്രാമവാർത്ത', 'Village news')} />
      <Row to="/orders" icon={<ShoppingBasket size={20} />} label={L('ഓർഡറുകൾ / അന്വേഷണങ്ങൾ', 'Orders & enquiries')} />
      <Row to="/delivery" icon={<Truck size={20} />} label={L('ഡെലിവറി ബോയ് (ചേരുക / എന്റെ ഡെലിവറികൾ)', 'Delivery person (join / my deliveries)')} />
      <Row to="/market/my" icon={<ShoppingBasket size={20} />} label={L('എന്റെ വിൽപ്പനയും പരസ്യവും', 'My items & ads')} />
      {isOwner(profile, authUser) && <Row to="/business" icon={<Briefcase size={20} />} label={L('Business panel (payments, പരസ്യം)', 'Business panel (payments, ads)')} />}
      <Row to="/profile/privacy" icon={<Lock size={20} />} label={L('Privacy & സമ്മതം', 'Privacy & consent')} />
      <Row to="/profile/privacy" icon={<Bell size={20} />} label="Notifications" value={profile.consent?.notify ? L('ഓൺ', 'On') : L('ഓഫ്', 'Off')} />
      <Row to="/emergency" icon={<LifeBuoy size={20} />} label={L('അടിയന്തര നമ്പറുകൾ', 'Emergency numbers')} />
      {!isAdmin && <Row to="/profile/request-admin" icon={<ShieldCheck size={20} />} label={L('Admin / വാർഡ് മെമ്പർ ആകാൻ അപേക്ഷിക്കുക', 'Apply to be an admin / ward member')} />}
      {isAdmin && <Row to="/admin" icon={<LayoutDashboard size={20} />} label={L('Admin panel', 'Admin panel')} value={isOwner(profile, authUser) || profile.role === 'superadmin' ? 'Super admin' : roleText(profile, lang)} />}
      <Row to="/profile/delete" icon={<Trash2 size={20} />} label={L('എന്റെ data delete ചെയ്യുക', 'Delete my data')} danger />
      <Row icon={<LogOut size={20} />} label="Logout" danger onClick={async () => { await api.signOut(); toast(L('Logout ചെയ്തു', 'Logged out')); nav('/'); }} />
      <p className="muted small center" style={{ fontSize: 11.5 }}>{L(...DISCLAIMER)}</p>
      <p className="muted small center">ഗ്രാമസേവ · v1.0{api.mode === 'demo' ? ' · Demo' : ''}</p>
    </Screen>
  );
}

export function PrivacyScreen() {
  const { api, profile, refresh, L, toast } = useApp();
  const nav = useNavigate();
  if (!profile) return null;
  return (
    <ConsentStep back initial={profile.consent} onDone={async (c) => {
      await api.saveProfile({ ...profile, consent: c });
      await refresh();
      toast(L('സേവ് ചെയ്തു', 'Saved'));
      nav(-1);
    }} />
  );
}

export function ChangePincode() {
  const nav = useNavigate();
  return <PincodeStep back onDone={() => nav(-1)} />;
}

export function ChangeVillage() {
  const { api, profile, refresh, setView, L, toast } = useApp();
  const nav = useNavigate();
  if (!profile) return null;
  return (
    <VillageStep back current={profile.villageId} onDone={async (v) => {
      if (!v) return nav(-1);
      await api.saveProfile({ ...profile, villageId: v.id, ...(v.id !== profile.villageId ? { ward: '' } : {}) });
      await refresh();
      setView(null);
      toast(L(`പഞ്ചായത്ത്: ${v.panchayat || v.name}`, `Panchayat: ${v.nameEn}`));
      nav('/');
    }} />
  );
}

export function DeleteData() {
  const { api, profile, L, toast } = useApp();
  const nav = useNavigate();
  const [typed, setTyped] = useState('');
  if (!profile) return null;
  const word = L('ഡിലീറ്റ്', 'DELETE');
  return (
    <Screen title={L('എന്റെ data delete ചെയ്യുക', 'Delete my data')}>
      <div className="notice bad">
        {L('നിങ്ങളുടെ profile, സേവനദാതാവ് വിവരങ്ങൾ എന്നിവ ഗ്രാമസേവയിൽ നിന്ന് മാറ്റും. ഇത് തിരിച്ചെടുക്കാൻ പറ്റില്ല.',
          'Your profile and provider details will be removed from Gramaseva. This cannot be undone.')}
      </div>
      <div className="field">
        <label htmlFor="confirm">{L(`ഉറപ്പാണെങ്കിൽ "${word}" എന്ന് type ചെയ്യുക`, `Type "${word}" to confirm`)}</label>
        <input id="confirm" className="input" value={typed} onChange={(e) => setTyped(e.target.value)} />
      </div>
      <div className="spacer" />
      <button className="btn block danger" disabled={typed.trim() !== word} onClick={async () => {
        await api.deleteMyData(profile.uid);
        toast(L('നിങ്ങളുടെ data delete ചെയ്തു', 'Your data was deleted'));
        nav('/');
      }}>{L('എല്ലാം delete ചെയ്യുക', 'Delete everything')}</button>
    </Screen>
  );
}

export function RequestAdmin() {
  const { api, profile, homeVillage, panchayats, L, toast } = useApp();
  // Residents' complaints and news are saved under the panchayat's main record, so the ward member must be made
  // admin of that same record (not of a duplicate record of the same panchayat), or they would never see them.
  const village = (homeVillage && panchayats.find((p) => p.ids.includes(homeVillage.id))?.main) || homeVillage;
  const nav = useNavigate();
  const [req, reload] = useLoad(() => (profile ? api.getMyRoleRequest(profile.uid) : Promise.resolve(null)), [profile?.uid]);
  const [position, setPosition] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  if (!profile) return null;

  async function send() {
    if (!profile || !village) return;
    setBusy(true);
    try {
      await api.requestRole({
        uid: profile.uid, name: profile.name, phone: profile.phone, villageId: village.id,
        position: position.trim(), note: note.trim(), status: 'pending', createdAt: Date.now(),
      });
      toast(L('അപേക്ഷ അയച്ചു', 'Request sent'));
      reload();
    } catch (e) {
      console.error(e);
      toast(L('അയയ്ക്കാൻ പറ്റിയില്ല', "Couldn't send"));
    } finally { setBusy(false); }
  }

  return (
    <Screen title={L('Admin ആകാൻ അപേക്ഷ', 'Apply to be an admin')}>
      <p className="muted" style={{ fontSize: 15 }}>
        {L('വാർഡ് മെമ്പർമാർക്കും പഞ്ചായത്ത് പ്രതിനിധികൾക്കും വേണ്ടി. Approve ആയാൽ നിങ്ങളുടെ വില്ലേജിലെ വാർത്തകൾ നേരിട്ട് ഇടാനും, മറ്റുള്ളവർ അയയ്ക്കുന്ന വാർത്തകളും പണിക്കാരെയും പരിശോധിച്ച് approve ചെയ്യാനും പറ്റും.',
          'For ward members and panchayat representatives. Once approved you can post news for your village, and check and approve news and workers that others send.')}
      </p>
      {req === undefined && <p className="muted">…</p>}
      {req?.status === 'pending' && <div className="notice warn">{L('നിങ്ങളുടെ അപേക്ഷ Super admin പരിശോധിക്കുകയാണ്.', 'The super admin is reviewing your request.')}</div>}
      {req?.status === 'approved' && <div className="notice">{L('അപേക്ഷ approve ആയി. App reload ചെയ്താൽ Profile-ൽ Admin panel കാണാം.', 'Approved. Reload the app to see the Admin panel in Profile.')}</div>}
      {req?.status === 'rejected' && <div className="notice bad">{L('കഴിഞ്ഞ അപേക്ഷ നിരസിച്ചു. വിവരങ്ങൾ ചേർത്ത് വീണ്ടും അയയ്ക്കാം.', 'Your last request was declined. You can send it again with more details.')}</div>}
      {!village && <div className="notice warn">{L('ആദ്യം Profile-ൽ നിങ്ങളുടെ വില്ലേജ് തിരഞ്ഞെടുക്കുക.', 'Choose your village in Profile first.')}</div>}
      {req !== undefined && req?.status !== 'pending' && req?.status !== 'approved' && village && (
        <>
          <div className="card"><span className="stack grow"><span className="muted small">{L('വില്ലേജ്', 'Village')}</span><b>{village.name}</b></span></div>
          <div className="field"><label htmlFor="pos">{L('നിങ്ങളുടെ സ്ഥാനം', 'Your position')}</label><input id="pos" className="input" value={position} onChange={(e) => setPosition(e.target.value)} placeholder={L('ഉദാ: വാർഡ് 7 മെമ്പർ', 'e.g. Ward 7 member')} maxLength={80} /></div>
          <div className="field"><label htmlFor="why">{L('കൂടുതൽ വിവരം (വേണമെങ്കിൽ)', 'More details (optional)')}</label><textarea id="why" className="input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} /></div>
          <div className="spacer" />
          <button className="btn block" disabled={busy || position.trim().length < 3} onClick={send}>{L('അപേക്ഷ അയയ്ക്കുക', 'Send request')}</button>
        </>
      )}
      <button className="link" style={{ alignSelf: 'center' }} onClick={() => nav(-1)}>{L('തിരികെ', 'Back')}</button>
    </Screen>
  );
}
