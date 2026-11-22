import { BUILTIN_CONTACTS, BUILTIN_TIMINGS } from '../data/builtin';
import { useMemo, useState, type ComponentType } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Store, MapPin, MessageSquareWarning, Bus, Check, Droplet, HeartPulse, Hospital, Landmark, Plus, School, Ship, Trash2, TrainFront, type LucideProps } from 'lucide-react';
import { useApp, useLoad } from '../lib/app';
import { CallButton, Empty, LoadError, Loading, Screen } from '../components/ui';
import { panchayatName, sortedWards, wardLabel } from '../lib/panchayat';
import { tr, mapsLink, prettyPhone } from '../lib/util';
import {
  BLOOD_GROUPS, CONTACT_KINDS, TRAVEL_MODES,
  type BloodDonor, type BloodGroup, type Contact, type ContactKind, type Timing, type TravelMode,
} from '../types';

type Icon = ComponentType<LucideProps>;

/** Mobile numbers in the usual 5+5 format; landlines as typed. */
const showPhone = (p: string) => (/^\+91\d{10}$/.test(p) ? `+91 ${prettyPhone(p)}` : p);

export const KIND: Record<ContactKind, { one: [string, string]; many: [string, string]; Icon: Icon; color: string; bg: string }> = {
  hospital: { one: ['ആശുപത്രി', 'Hospital'], many: ['ആശുപത്രികൾ', 'Hospitals'], Icon: Hospital, color: '#c62828', bg: '#ffebee' },
  school: { one: ['സ്കൂൾ / കോളേജ്', 'School / college'], many: ['സ്കൂൾ / കോളേജുകൾ', 'Schools & colleges'], Icon: School, color: '#1565c0', bg: '#e3f2fd' },
  asha: { one: ['ആശാ വർക്കർ', 'ASHA worker'], many: ['ആശാ വർക്കർമാർ', 'ASHA workers'], Icon: HeartPulse, color: '#ad1457', bg: '#fce4ec' },
  office: { one: ['ഓഫീസ്', 'Office'], many: ['ഓഫീസുകൾ', 'Offices'], Icon: Landmark, color: '#2e7d32', bg: '#e8f5e9' },
};

export const MODE: Record<TravelMode, { label: [string, string]; Icon: Icon; color: string; bg: string }> = {
  train: { label: ['ട്രെയിൻ', 'Train'], Icon: TrainFront, color: '#4527a0', bg: '#ede7f6' },
  bus: { label: ['ബസ്', 'Bus'], Icon: Bus, color: '#e65100', bg: '#fff3e0' },
  boat: { label: ['ബോട്ട്', 'Boat'], Icon: Ship, color: '#00695c', bg: '#e0f2f1' },
};

function Ic({ Icon, color, bg, size = 22 }: { Icon: Icon; color: string; bg: string; size?: number }) {
  return (
    <span style={{ background: bg, color, width: size * 2, height: size * 2, borderRadius: size * 0.55, display: 'grid', placeItems: 'center', flex: 'none' }}>
      <Icon size={size} strokeWidth={2.2} aria-hidden />
    </span>
  );
}

/** Is the person an admin of the panchayat being viewed? Returns the village id their writes should use. */
export function useAdminHere(): string | null {
  const { profile, village, viewIds } = useApp();
  if (!profile || !village) return null;
  if (profile.role === 'superadmin') return village.id;
  if (profile.role === 'coordinator' && profile.coordinatorOf && viewIds.includes(profile.coordinatorOf)) return profile.coordinatorOf;
  return null;
}

/** Tiles for the home screen. */
export function LocalTiles() {
  const { L, pair } = useApp();
  const tiles: { to: string; label: string; Icon: Icon; color: string; bg: string }[] = [
    ...CONTACT_KINDS.map((k) => ({ to: `/directory/${k}`, label: pair(KIND[k].many), Icon: KIND[k].Icon, color: KIND[k].color, bg: KIND[k].bg })),
    { to: '/shops', label: L('കടകൾ', 'Shops'), Icon: Store, color: '#00796b', bg: '#e0f2f1' },
    { to: '/complaints', label: L('പരാതി / സന്ദേശം', 'Complaints'), Icon: MessageSquareWarning, color: '#6a1b9a', bg: '#f3e5f5' },
    { to: '/blood', label: L('രക്തദാനം', 'Blood donors'), Icon: Droplet, color: '#b71c1c', bg: '#ffebee' },
    ...TRAVEL_MODES.map((m) => ({ to: `/timings?mode=${m}`, label: L(`${MODE[m].label[0]} സമയം`, `${MODE[m].label[1]} times`), Icon: MODE[m].Icon, color: MODE[m].color, bg: MODE[m].bg })),
  ];
  return (
    <>
      <p className="section">{L('നാട്ടിലെ സേവനങ്ങൾ', 'Local services')}</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
        {tiles.map((t) => (
          <Link key={t.to} to={t.to} className="tile" style={{ minHeight: 92, fontSize: 12.5, padding: '8px 4px', gap: 6 }}>
            <Ic Icon={t.Icon} color={t.color} bg={t.bg} size={18} />
            <span style={{ lineHeight: 1.25 }}>{t.label}</span>
          </Link>
        ))}
      </div>
    </>
  );
}

// ---------------------------------------------------------------- Directory

export function DirectoryList() {
  const { kind = 'hospital' } = useParams();
  const k = (CONTACT_KINDS as string[]).includes(kind) ? (kind as ContactKind) : 'hospital';
  const { api, profile, village, viewIds, isHomeView, lang, L, pair, toast } = useApp();
  const adminVid = useAdminHere();
  const nav = useNavigate();
  const [ward, setWard] = useState(k === 'asha' && isHomeView ? profile?.ward ?? '' : '');
  const [dbList, reload, err] = useLoad(() => api.listContacts(k, viewIds), [k, viewIds.join(',')]);
  const list = dbList ? [...BUILTIN_CONTACTS.filter((c) => c.kind === k && viewIds.includes(c.villageId)), ...dbList] : dbList;
  const [pending, reloadPending] = useLoad(
    () => (adminVid ? api.listContacts(k, profile?.role === 'superadmin' ? viewIds : [adminVid], 'pending') : Promise.resolve([] as Contact[])),
    [k, adminVid, viewIds.join(',')]);
  const [mine, reloadMine] = useLoad(
    () => (k === 'asha' && profile ? api.getContact(`asha_${profile.uid}`).catch(() => null) : Promise.resolve(null)), [k, profile?.uid]);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const wards = sortedWards(village, lang);
  const rows = (list ?? []).filter((c) => !ward || c.ward === ward);
  const meta = KIND[k];

  async function remove(c: Contact) {
    if (confirmDel !== c.id) { setConfirmDel(c.id); return; }
    try { await api.deleteContact(c.id); toast(L('മാറ്റി', 'Removed')); reload(); reloadPending(); reloadMine(); } catch (e) { console.error(e); toast(L('പറ്റിയില്ല', "Couldn't do that")); }
    setConfirmDel(null);
  }
  async function approve(c: Contact) {
    try { await api.saveContact({ ...c, status: 'approved' }); toast(L('Approve ചെയ്തു', 'Approved')); reload(); reloadPending(); } catch (e) { console.error(e); toast(L('പറ്റിയില്ല', "Couldn't do that")); }
  }

  const Card = ({ c, isPending }: { c: Contact; isPending?: boolean }) => (
    <div className="card" style={{ alignItems: 'flex-start' }}>
      <Ic Icon={meta.Icon} color={meta.color} bg={meta.bg} />
      <span className="stack grow" style={{ minWidth: 0 }}>
        <b>{tr(c, 'name', lang)}</b>
        {c.ward && <span className="muted small">{L('വാർഡ്', 'Ward')}: {wardLabel(village, c.ward, lang)}</span>}
        {tr(c, 'note', lang) && <span className="small">{tr(c, 'note', lang)}</span>}
        {tr(c, 'address', lang) && <span className="muted small">{tr(c, 'address', lang)}</span>}
        <a className="link small" href={mapsLink(`${c.name}, ${village ? (village.nameEn || village.name) : ''}, Kerala`)} target="_blank" rel="noreferrer"><MapPin size={13} /> {L('മാപ്പിൽ', 'Map')}</a>
        {c.phone && <span className="muted small num">{showPhone(c.phone)}{c.phone2 ? ` · ${showPhone(c.phone2)}` : ''}</span>}
        {(adminVid || isPending) && (
          <span className="row" style={{ gap: 8, marginTop: 6 }}>
            {isPending && adminVid && <button className="chip on" onClick={() => approve(c)}><Check size={14} /> {L('Approve', 'Approve')}</button>}
            {adminVid && !c.id.startsWith('b-') && <button className="chip" style={{ color: 'var(--red)' }} onClick={() => remove(c)}><Trash2 size={14} /> {confirmDel === c.id ? L('ഉറപ്പാണോ? വീണ്ടും അമർത്തുക', 'Sure? Tap again') : L('മാറ്റുക', 'Remove')}</button>}
          </span>
        )}
      </span>
      {c.phone && <CallButton phone={c.phone} />}
    </div>
  );

  return (
    <Screen title={pair(meta.many)} nav
      right={adminVid ? <Link to={`/directory/${k}/new`} className="iconbtn" aria-label={L('ചേർക്കുക', 'Add')}><Plus size={24} /></Link> : undefined}>
      {village && <p className="muted small">{panchayatName(village, lang)} · <Link className="link" to="/panchayats">{L('മാറ്റുക', 'Change')}</Link></p>}
      {k === 'asha' && wards.length > 0 && (
        <select className="input" aria-label={L('വാർഡ്', 'Ward')} value={ward} onChange={(e) => setWard(e.target.value)}>
          <option value="">{L('എല്ലാ വാർഡും', 'All wards')}</option>
          {wards.map((w) => <option key={w.no} value={String(w.no)}>{lang === 'ml' ? w.name : w.nameEn}</option>)}
        </select>
      )}
      {err && <LoadError retry={reload} />}
      {!list && !err && <Loading />}
      {rows.map((c) => <Card key={c.id} c={c} />)}
      {list && rows.length === 0 && (
        <Empty icon={<Ic Icon={meta.Icon} color={meta.color} bg={meta.bg} size={26} />}
          text={adminVid ? L('ഇതുവരെ ഒന്നും ചേർത്തിട്ടില്ല. മുകളിലെ + അമർത്തി ചേർക്കുക.', 'Nothing added yet. Tap + above to add.')
            : L('ഇതുവരെ ചേർത്തിട്ടില്ല. വാർഡ് മെമ്പർ / admin ചേർക്കും.', 'Not added yet. Your ward member / admin will add them.')} />
      )}
      {!!pending?.length && (
        <>
          <p className="section">{L('Approve ചെയ്യാനുള്ളവ', 'Waiting for approval')}</p>
          {pending.map((c) => <Card key={c.id} c={c} isPending />)}
        </>
      )}
      {adminVid && <button className="btn block" onClick={() => nav(`/directory/${k}/new`)}><Plus size={20} /> {L(`${meta.one[0]} ചേർക്കുക`, `Add ${meta.one[1].toLowerCase()}`)}</button>}
      {k === 'asha' && !adminVid && profile && (
        mine ? (
          <div className={'notice' + (mine.status === 'pending' ? ' warn' : '')}>
            {mine.status === 'pending'
              ? L('നിങ്ങളുടെ ആശാ വർക്കർ വിവരം വാർഡ് മെമ്പർ / admin approve ചെയ്യാൻ കാത്തിരിക്കുന്നു.', 'Your ASHA worker listing is waiting for your ward member / admin to approve.')
              : L('നിങ്ങളെ ആശാ വർക്കറായി ലിസ്റ്റ് ചെയ്തിട്ടുണ്ട്.', 'You are listed as an ASHA worker.')}
            <button className="link" onClick={() => remove(mine)}>{confirmDel === mine.id ? L('ഉറപ്പാണോ? വീണ്ടും അമർത്തുക', 'Sure? Tap again') : L('ലിസ്റ്റിൽ നിന്ന് മാറ്റുക', 'Remove me')}</button>
          </div>
        ) : isHomeView && (
          <button className="btn block outline" onClick={() => nav('/directory/asha/new?self=1')}>{L('ഞാൻ ആശാ വർക്കറാണ് — എന്നെ ചേർക്കുക', "I'm an ASHA worker — add me")}</button>
        )
      )}
    </Screen>
  );
}

export function ContactForm() {
  const { kind = 'hospital' } = useParams();
  const k = (CONTACT_KINDS as string[]).includes(kind) ? (kind as ContactKind) : 'hospital';
  const [params] = useSearchParams();
  const self = params.get('self') === '1' && k === 'asha';
  const { api, profile, village, homeVillage, lang, L, pair, toast } = useApp();
  const adminVid = useAdminHere();
  const nav = useNavigate();
  const [name, setName] = useState(self ? profile?.name ?? '' : '');
  const [phone, setPhone] = useState(self ? (profile?.phone ?? '').replace(/^\+91/, '') : '');
  const [phone2, setPhone2] = useState('');
  const [ward, setWard] = useState(self ? profile?.ward ?? '' : '');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const target = self ? homeVillage : village;
  const wards = sortedWards(target, lang);
  const meta = KIND[k];
  const clean = (s: string) => s.replace(/[^\d+ -]/g, '').trim();
  const ok = name.trim().length >= 2 && clean(phone).replace(/\D/g, '').length >= 6 && (k !== 'asha' || !wards.length || ward);

  if (!profile || !target || (!self && !adminVid)) {
    return <Screen title={pair(meta.many)}><div className="notice warn">{L('ഇത് ചേർക്കാൻ വാർഡ് മെമ്പർ / admin-ന് മാത്രമേ പറ്റൂ.', 'Only a ward member / admin can add this.')}</div></Screen>;
  }

  async function save() {
    if (!profile || !target) return;
    setBusy(true);
    try {
      const digits = clean(phone);
      await api.saveContact({
        ...(self ? { id: `asha_${profile.uid}`, uid: profile.uid } : {}),
        villageId: self ? target.id : (adminVid as string), kind: k, name: name.trim(),
        phone: /^\d{10}$/.test(digits) ? `+91${digits}` : digits,
        ...(phone2.trim() ? { phone2: clean(phone2) } : {}),
        ...(ward ? { ward } : {}),
        ...(address.trim() ? { address: address.trim() } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
        status: self ? 'pending' : 'approved', createdBy: profile.uid, createdAt: Date.now(),
      });
      toast(self ? L('അയച്ചു. വാർഡ് മെമ്പർ approve ചെയ്താൽ എല്ലാവർക്കും കാണാം.', 'Sent. Everyone will see it once your ward member approves.') : L('ചേർത്തു', 'Added'));
      nav(-1);
    } catch (e) {
      console.error(e);
      toast(L('സേവ് ചെയ്യാൻ പറ്റിയില്ല', "Couldn't save"));
    } finally { setBusy(false); }
  }

  const notePh: Record<ContactKind, [string, string]> = {
    hospital: ['ഉദാ: 24 മണിക്കൂർ, ക്യാഷ്വാലിറ്റി ഉണ്ട്', 'e.g. 24 hours, casualty'],
    school: ['ഉദാ: LP / UP / ഹൈസ്കൂൾ, സർക്കാർ / എയ്ഡഡ്', 'e.g. LP / UP / High school, Govt / Aided'],
    asha: ['ഉദാ: രാവിലെ 9 മുതൽ 5 വരെ വിളിക്കാം', 'e.g. Call 9am to 5pm'],
    office: ['ഉദാ: പഞ്ചായത്ത് ഓഫീസ്, വില്ലേജ് ഓഫീസ്, KSEB', 'e.g. Panchayat office, Village office, KSEB'],
  };

  return (
    <Screen title={self ? L('ആശാ വർക്കറായി ചേരുക', 'Join as an ASHA worker') : L(`${meta.one[0]} ചേർക്കുക`, `Add ${meta.one[1].toLowerCase()}`)}>
      <p className="muted small">{panchayatName(target, lang)}</p>
      <div className="field"><label htmlFor="cn">{L('പേര്', 'Name')}</label><input id="cn" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} /></div>
      <div className="field"><label htmlFor="cp">{L('ഫോൺ നമ്പർ', 'Phone number')}</label><input id="cp" className="input" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="94470 12345 / 0477 270 0000" maxLength={20} /></div>
      {k !== 'asha' && <div className="field"><label htmlFor="cp2">{L('മറ്റൊരു നമ്പർ (വേണമെങ്കിൽ)', 'Another number (optional)')}</label><input id="cp2" className="input" inputMode="tel" value={phone2} onChange={(e) => setPhone2(e.target.value)} maxLength={20} /></div>}
      {wards.length > 0 && (
        <div className="field"><label htmlFor="cw">{k === 'asha' ? L('ഏത് വാർഡ്', 'Which ward') : L('വാർഡ് (വേണമെങ്കിൽ)', 'Ward (optional)')}</label>
          <select id="cw" className="input" value={ward} onChange={(e) => setWard(e.target.value)}>
            <option value="">{L('തിരഞ്ഞെടുക്കുക', 'Choose')}</option>
            {wards.map((w) => <option key={w.no} value={String(w.no)}>{lang === 'ml' ? w.name : w.nameEn}</option>)}
          </select>
        </div>
      )}
      {k !== 'asha' && <div className="field"><label htmlFor="ca">{L('സ്ഥലം / വിലാസം (വേണമെങ്കിൽ)', 'Place / address (optional)')}</label><input id="ca" className="input" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={160} /></div>}
      <div className="field"><label htmlFor="cno">{L('കൂടുതൽ വിവരം (വേണമെങ്കിൽ)', 'More details (optional)')}</label><input id="cno" className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={160} placeholder={pair(notePh[k])} /></div>
      {self && <div className="notice">{L('നിങ്ങളുടെ പേരും നമ്പറും എല്ലാവർക്കും കാണിക്കും. വാർഡ് മെമ്പർ / admin approve ചെയ്ത ശേഷമേ ലിസ്റ്റിൽ വരൂ.', 'Your name and number will be shown to everyone, after your ward member / admin approves.')}</div>}
      <div className="spacer" />
      <button className="btn block" disabled={busy || !ok} onClick={save}>{self ? L('അയയ്ക്കുക', 'Send') : L('ചേർക്കുക', 'Add')}</button>
    </Screen>
  );
}

// ---------------------------------------------------------------- Timings

const nowHM = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
function time12(t: string, lang: 'ml' | 'en') {
  const [h, m] = t.split(':').map(Number);
  const h12 = ((h + 11) % 12) + 1;
  const part = lang === 'ml' ? (h < 12 ? 'രാവിലെ' : h < 16 ? 'ഉച്ചയ്ക്ക്' : h < 19 ? 'വൈകിട്ട്' : 'രാത്രി') : h < 12 ? 'AM' : 'PM';
  return lang === 'ml' ? `${part} ${h12}:${String(m).padStart(2, '0')}` : `${h12}:${String(m).padStart(2, '0')} ${part}`;
}

export function Timings() {
  const [params, setParams] = useSearchParams();
  const mode = ((TRAVEL_MODES as string[]).includes(params.get('mode') ?? '') ? params.get('mode') : 'bus') as TravelMode;
  const { api, profile, village, viewIds, lang, L, pair, toast } = useApp();
  const adminVid = useAdminHere();
  const nav = useNavigate();
  const [dbList, reload, err] = useLoad(() => api.listTimings(viewIds), [viewIds.join(',')]);
  const list = dbList ? [...BUILTIN_TIMINGS.filter((t) => viewIds.includes(t.villageId)), ...dbList].sort((a, b) => a.time.localeCompare(b.time)) : dbList;
  const [stop, setStop] = useState('');
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const ofMode = (list ?? []).filter((t) => t.mode === mode);
  const stops = [...new Set(ofMode.map((t) => tr(t, 'stop', lang)).filter(Boolean))];
  const rows = ofMode.filter((t) => !stop || tr(t, 'stop', lang) === stop);
  const now = nowHM();
  const nextId = rows.find((t) => t.time >= now)?.id;
  const canAdd = !!profile && (mode === 'bus' || !!adminVid);
  const m = MODE[mode];

  async function remove(t: Timing) {
    if (confirmDel !== t.id) { setConfirmDel(t.id); return; }
    try { await api.deleteTiming(t.id); toast(L('മാറ്റി', 'Removed')); reload(); } catch (e) { console.error(e); toast(L('പറ്റിയില്ല', "Couldn't do that")); }
    setConfirmDel(null);
  }

  return (
    <Screen title={L('യാത്രാ സമയം', 'Travel times')} nav
      right={canAdd ? <Link to={`/timings/new?mode=${mode}`} className="iconbtn" aria-label={L('ചേർക്കുക', 'Add')}><Plus size={24} /></Link> : undefined}>
      <div className="chips">
        {TRAVEL_MODES.map((x) => (
          <button key={x} className={'chip' + (x === mode ? ' on' : '')} onClick={() => { setStop(''); setParams({ mode: x }, { replace: true }); }}>{pair(MODE[x].label)}</button>
        ))}
      </div>
      {village && <p className="muted small">{panchayatName(village, lang)} · <Link className="link" to="/panchayats">{L('മാറ്റുക', 'Change')}</Link></p>}
      {stops.length > 1 && (
        <select className="input" aria-label={L('സ്റ്റോപ്പ്', 'Stop')} value={stop} onChange={(e) => setStop(e.target.value)}>
          <option value="">{L('എല്ലാ സ്റ്റോപ്പുകളും', 'All stops')}</option>
          {stops.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      )}
      {err && <LoadError retry={reload} />}
      {!list && !err && <Loading />}
      {rows.map((t) => (
        <div key={t.id} className="card" style={{ alignItems: 'flex-start', outline: t.id === nextId ? '2px solid var(--green)' : undefined }}>
          <span className="stack" style={{ minWidth: 74, alignItems: 'center' }}>
            <b className="num" style={{ fontSize: 20 }}>{t.time}</b>
            <span className="muted small">{time12(t.time, lang).split(' ')[0]}</span>
            {t.id === nextId && <span className="badge">{L('അടുത്തത്', 'Next')}</span>}
          </span>
          <span className="stack grow" style={{ minWidth: 0 }}>
            <b>{tr(t, 'name', lang)}{t.number ? ` (${t.number})` : ''}</b>
            <span className="small">{tr(t, 'from', lang)} → {tr(t, 'to', lang)}</span>
            <span className="muted small">{tr(t, 'stop', lang)}{t.days ? ` · ${tr(t, 'days', lang)}` : ''}</span>
            {t.note && <span className="muted small">{tr(t, 'note', lang)}</span>}
            <span className="muted small">{L('ചേർത്തത്', 'Added by')}: {t.addedByName}</span>
            {t.addedBy !== 'builtin' && (adminVid || t.addedBy === profile?.uid) && (
              <button className="chip" style={{ color: 'var(--red)', alignSelf: 'flex-start', marginTop: 6 }} onClick={() => remove(t)}>
                <Trash2 size={14} /> {confirmDel === t.id ? L('ഉറപ്പാണോ? വീണ്ടും അമർത്തുക', 'Sure? Tap again') : L('മാറ്റുക', 'Remove')}
              </button>
            )}
          </span>
        </div>
      ))}
      {list && rows.length === 0 && (
        <Empty icon={<Ic Icon={m.Icon} color={m.color} bg={m.bg} size={26} />}
          text={mode === 'bus' ? L('ബസ് സമയം ഇതുവരെ ആരും ചേർത്തിട്ടില്ല. നിങ്ങൾക്ക് അറിയാവുന്ന ബസ് സമയം ചേർക്കൂ.', 'No bus times yet. Add a bus time you know.')
            : L('ഇതുവരെ ചേർത്തിട്ടില്ല. വാർഡ് മെമ്പർ / admin ചേർക്കും.', 'Not added yet. Your ward member / admin will add them.')} />
      )}
      {canAdd && <button className="btn block" onClick={() => nav(`/timings/new?mode=${mode}`)}><Plus size={20} /> {L(`${m.label[0]} സമയം ചേർക്കുക`, `Add ${m.label[1].toLowerCase()} time`)}</button>}
      {!canAdd && mode !== 'bus' && <p className="muted small center">{L('ട്രെയിൻ, ബോട്ട് സമയങ്ങൾ വാർഡ് മെമ്പർ / admin ആണ് ചേർക്കുന്നത്.', 'Train and boat times are added by your ward member / admin.')}</p>}
      <p className="muted small center">{L('സമയം മാറാം. യാത്രയ്ക്ക് മുമ്പ് ഉറപ്പാക്കുക.', 'Times can change. Please confirm before you travel.')}</p>
    </Screen>
  );
}

export function TimingForm() {
  const [params] = useSearchParams();
  const mode = ((TRAVEL_MODES as string[]).includes(params.get('mode') ?? '') ? params.get('mode') : 'bus') as TravelMode;
  const { api, profile, village, lang, L, pair, toast } = useApp();
  const adminVid = useAdminHere();
  const nav = useNavigate();
  const [name, setName] = useState('');
  const [number, setNumber] = useState('');
  const [stop, setStop] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [time, setTime] = useState('');
  const [days, setDays] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const m = MODE[mode];
  const ok = name.trim().length >= 2 && stop.trim() && from.trim() && to.trim() && /^\d\d:\d\d$/.test(time);

  if (!profile || !village || (mode !== 'bus' && !adminVid)) {
    return <Screen title={pair(m.label)}><div className="notice warn">{L('ട്രെയിൻ, ബോട്ട് സമയങ്ങൾ വാർഡ് മെമ്പർ / admin-ന് മാത്രമേ ചേർക്കാൻ പറ്റൂ.', 'Only a ward member / admin can add train and boat times.')}</div></Screen>;
  }

  async function save() {
    if (!profile || !village) return;
    setBusy(true);
    try {
      await api.addTiming({
        villageId: adminVid ?? village.id, mode, name: name.trim(), ...(number.trim() ? { number: number.trim() } : {}),
        stop: stop.trim(), from: from.trim(), to: to.trim(), time, ...(days.trim() ? { days: days.trim() } : {}),
        ...(note.trim() ? { note: note.trim() } : {}), addedBy: profile.uid, addedByName: profile.name, createdAt: Date.now(),
      });
      toast(L('ചേർത്തു', 'Added'));
      nav(-1);
    } catch (e) {
      console.error(e);
      toast(L('സേവ് ചെയ്യാൻ പറ്റിയില്ല', "Couldn't save"));
    } finally { setBusy(false); }
  }

  const ph: Record<TravelMode, { name: [string, string]; stop: [string, string] }> = {
    train: { name: ['ഉദാ: ആലപ്പുഴ – കൊല്ലം MEMU', 'e.g. Alappuzha – Kollam MEMU'], stop: ['ഉദാ: തകഴി റെയിൽവേ സ്റ്റേഷൻ', 'e.g. Thakazhi railway station'] },
    bus: { name: ['ഉദാ: KSRTC / ബസിന്റെ പേര്', 'e.g. KSRTC / bus name'], stop: ['ഉദാ: തകഴി ജംഗ്ഷൻ', 'e.g. Thakazhi junction'] },
    boat: { name: ['ഉദാ: SWTD ബോട്ട്', 'e.g. SWTD boat'], stop: ['ഉദാ: ബോട്ട് ജെട്ടി', 'e.g. Boat jetty'] },
  };

  return (
    <Screen title={L(`${m.label[0]} സമയം ചേർക്കുക`, `Add ${m.label[1].toLowerCase()} time`)}>
      <p className="muted small">{panchayatName(village, lang)}</p>
      <div className="field"><label htmlFor="tn">{mode === 'train' ? L('ട്രെയിനിന്റെ പേര്', 'Train name') : mode === 'bus' ? L('ബസിന്റെ പേര്', 'Bus name') : L('ബോട്ട് സർവീസ്', 'Boat service')}</label><input id="tn" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder={pair(ph[mode].name)} /></div>
      {mode === 'train' && <div className="field"><label htmlFor="tno">{L('ട്രെയിൻ നമ്പർ (വേണമെങ്കിൽ)', 'Train number (optional)')}</label><input id="tno" className="input" inputMode="numeric" value={number} onChange={(e) => setNumber(e.target.value)} maxLength={10} /></div>}
      <div className="field"><label htmlFor="ts">{L('സ്റ്റോപ്പ് (നമ്മുടെ നാട്ടിൽ)', 'Stop (in our panchayat)')}</label><input id="ts" className="input" value={stop} onChange={(e) => setStop(e.target.value)} maxLength={80} placeholder={pair(ph[mode].stop)} /></div>
      <div className="grid2">
        <div className="field"><label htmlFor="tf">{L('എവിടെ നിന്ന്', 'From')}</label><input id="tf" className="input" value={from} onChange={(e) => setFrom(e.target.value)} maxLength={60} /></div>
        <div className="field"><label htmlFor="tt">{L('എങ്ങോട്ട്', 'To')}</label><input id="tt" className="input" value={to} onChange={(e) => setTo(e.target.value)} maxLength={60} /></div>
      </div>
      <div className="field"><label htmlFor="tm">{L('ഇവിടെ എത്തുന്ന സമയം', 'Time at this stop')}</label><input id="tm" className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
      <div className="field"><label htmlFor="td">{L('ദിവസങ്ങൾ (വേണമെങ്കിൽ)', 'Days (optional)')}</label><input id="td" className="input" value={days} onChange={(e) => setDays(e.target.value)} maxLength={40} placeholder={L('ഉദാ: എല്ലാ ദിവസവും / ഞായർ ഇല്ല', 'e.g. Daily / Not on Sunday')} /></div>
      <div className="field"><label htmlFor="tnote">{L('കൂടുതൽ വിവരം (വേണമെങ്കിൽ)', 'More details (optional)')}</label><input id="tnote" className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={160} /></div>
      <div className="spacer" />
      <button className="btn block" disabled={busy || !ok} onClick={save}>{L('ചേർക്കുക', 'Add')}</button>
    </Screen>
  );
}

// ---------------------------------------------------------------- Blood donors

export function BloodDonors() {
  const { api, profile, village, viewIds, isHomeView, lang, L } = useApp();
  const nav = useNavigate();
  const [group, setGroup] = useState<BloodGroup | ''>('');
  const [ward, setWard] = useState('');
  const [list, reload, err] = useLoad(() => api.listDonors(viewIds), [viewIds.join(',')]);
  const [mine] = useLoad(() => (profile ? api.getDonor(profile.uid) : Promise.resolve(null)), [profile?.uid]);
  const wards = sortedWards(village, lang);
  const rows = useMemo(() => (list ?? [])
    .filter((d) => (!group || d.group === group) && (!ward || d.ward === ward))
    .sort((a, b) => Number(b.available) - Number(a.available) || a.group.localeCompare(b.group)), [list, group, ward]);

  return (
    <Screen title={L('രക്തദാനം', 'Blood donors')} nav>
      {village && <p className="muted small">{panchayatName(village, lang)} · <Link className="link" to="/panchayats">{L('മാറ്റുക', 'Change')}</Link></p>}
      <div className="chips">
        <button className={'chip' + (!group ? ' on' : '')} onClick={() => setGroup('')}>{L('എല്ലാം', 'All')}</button>
        {BLOOD_GROUPS.map((g) => <button key={g} className={'chip' + (group === g ? ' on' : '')} onClick={() => setGroup(g)}>{g}</button>)}
      </div>
      {wards.length > 0 && (
        <select className="input" aria-label={L('വാർഡ്', 'Ward')} value={ward} onChange={(e) => setWard(e.target.value)}>
          <option value="">{L('എല്ലാ വാർഡും', 'All wards')}</option>
          {wards.map((w) => <option key={w.no} value={String(w.no)}>{lang === 'ml' ? w.name : w.nameEn}</option>)}
        </select>
      )}
      {err && <LoadError retry={reload} />}
      {!list && !err && <Loading />}
      {rows.map((d) => (
        <div key={d.uid} className="card" style={{ opacity: d.available ? 1 : 0.6 }}>
          <span style={{ background: '#ffebee', color: '#b71c1c', minWidth: 52, height: 52, borderRadius: 14, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 17, flex: 'none' }}>{d.group}</span>
          <span className="stack grow" style={{ minWidth: 0 }}>
            <b>{d.name}</b>
            <span className="muted small">
              {d.ward ? wardLabel(village, d.ward, lang) : ''}
              {d.lastDonated ? `${d.ward ? ' · ' : ''}${L('അവസാനം നൽകിയത്', 'Last gave')}: ${d.lastDonated}` : ''}
            </span>
            {!d.available && <span className="muted small">{L('ഇപ്പോൾ പറ്റില്ല', 'Not available now')}</span>}
          </span>
          <CallButton phone={d.phone} off={!d.available} />
        </div>
      ))}
      {list && rows.length === 0 && <Empty icon={<Ic Icon={Droplet} color="#b71c1c" bg="#ffebee" size={26} />} text={L('ഈ ഗ്രൂപ്പിൽ / വാർഡിൽ ഇതുവരെ ആരും ചേർന്നിട്ടില്ല.', 'No donors yet for this group / ward.')} />}
      {profile && (mine || isHomeView) && (
        <button className="btn block" style={{ background: '#c62828' }} onClick={() => nav('/blood/me')}>
          <Droplet size={20} /> {mine ? L('എന്റെ രക്തദാന വിവരം മാറ്റുക', 'Edit my donor details') : L('ഞാൻ രക്തം ദാനം ചെയ്യാൻ തയ്യാർ', "I'm willing to donate blood")}
        </button>
      )}
      <p className="muted small center">{L('അത്യാവശ്യത്തിന് മാത്രം വിളിക്കുക. ഗ്രാമസേവയിൽ login ചെയ്തവർക്ക് മാത്രമേ ഈ ലിസ്റ്റ് കാണൂ.', 'Call only when needed. Only people logged in to Gramaseva can see this list.')}</p>
    </Screen>
  );
}

export function BloodForm() {
  const { api, profile, homeVillage, lang, L, toast } = useApp();
  const nav = useNavigate();
  const [mine] = useLoad(() => (profile ? api.getDonor(profile.uid) : Promise.resolve(null)), [profile?.uid]);
  const [group, setGroup] = useState<BloodGroup | ''>('');
  const [ward, setWard] = useState<string | null>(null);
  const [last, setLast] = useState<string | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!profile || !homeVillage || mine === undefined) return <Screen title={L('രക്തദാനം', 'Blood donation')}><Loading /></Screen>;
  const g = group || mine?.group || '';
  const w = ward ?? mine?.ward ?? profile.ward ?? '';
  const ld = last ?? mine?.lastDonated ?? '';
  const av = available ?? mine?.available ?? true;
  const wards = sortedWards(homeVillage, lang);

  async function save() {
    if (!profile || !homeVillage || !g) return;
    setBusy(true);
    try {
      const d: BloodDonor = {
        uid: profile.uid, villageId: homeVillage.id, name: profile.name, phone: profile.phone, group: g as BloodGroup,
        ...(w ? { ward: w } : {}), ...(ld ? { lastDonated: ld } : {}), available: av, createdAt: mine?.createdAt ?? Date.now(),
      };
      await api.saveDonor(d);
      toast(L('സേവ് ചെയ്തു. നന്ദി! ❤️', 'Saved. Thank you! ❤️'));
      nav('/blood', { replace: true });
    } catch (e) {
      console.error(e);
      toast(L('സേവ് ചെയ്യാൻ പറ്റിയില്ല', "Couldn't save"));
    } finally { setBusy(false); }
  }
  async function removeMe() {
    if (!profile) return;
    try { await api.deleteDonor(profile.uid); toast(L('ലിസ്റ്റിൽ നിന്ന് മാറ്റി', 'Removed from the list')); nav('/blood', { replace: true }); } catch (e) { console.error(e); toast(L('പറ്റിയില്ല', "Couldn't do that")); }
  }

  return (
    <Screen title={L('രക്തദാനത്തിന് പേര് ചേർക്കുക', 'Register as a blood donor')}>
      <p className="section">{L('രക്ത ഗ്രൂപ്പ്', 'Blood group')}</p>
      <div className="grid3" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {BLOOD_GROUPS.map((x) => <button key={x} className={'chip' + (g === x ? ' on' : '')} style={{ justifyContent: 'center', fontSize: 16, minHeight: 44 }} onClick={() => setGroup(x)}>{x}</button>)}
      </div>
      {wards.length > 0 && (
        <div className="field"><label htmlFor="bw">{L('വാർഡ്', 'Ward')}</label>
          <select id="bw" className="input" value={w} onChange={(e) => setWard(e.target.value)}>
            <option value="">{L('തിരഞ്ഞെടുക്കുക', 'Choose')}</option>
            {wards.map((x) => <option key={x.no} value={String(x.no)}>{lang === 'ml' ? x.name : x.nameEn}</option>)}
          </select>
        </div>
      )}
      <div className="field"><label htmlFor="bl">{L('അവസാനം രക്തം നൽകിയത് (വേണമെങ്കിൽ)', 'Last donated (optional)')}</label><input id="bl" className="input" type="month" value={ld} onChange={(e) => setLast(e.target.value)} /></div>
      <button className="card tap" role="switch" aria-checked={av} onClick={() => setAvailable(!av)}>
        <span className={'check' + (av ? ' on' : '')}>{av && <Check size={18} />}</span>
        <span className="grow">{L('ഇപ്പോൾ രക്തം നൽകാൻ പറ്റും', 'I can donate now')}</span>
      </button>
      {!mine && (
        <button className="card tap" role="checkbox" aria-checked={agree} onClick={() => setAgree(!agree)}>
          <span className={'check' + (agree ? ' on' : '')}>{agree && <Check size={18} />}</span>
          <span className="grow small">{L(`എന്റെ പേരും ഫോൺ നമ്പറും (${prettyPhone(profile.phone)}) രക്ത ഗ്രൂപ്പും ഗ്രാമസേവയിൽ login ചെയ്തവർക്ക് കാണിക്കാൻ ഞാൻ സമ്മതിക്കുന്നു.`, `I agree to show my name, phone number (${prettyPhone(profile.phone)}) and blood group to people logged in to Gramaseva.`)}</span>
        </button>
      )}
      <div className="spacer" />
      <button className="btn block" style={{ background: '#c62828' }} disabled={busy || !g || (!mine && !agree)} onClick={save}>{L('സേവ് ചെയ്യുക', 'Save')}</button>
      {mine && <button className="link" style={{ alignSelf: 'center', color: 'var(--red)' }} onClick={removeMe}>{L('എന്നെ ലിസ്റ്റിൽ നിന്ന് മാറ്റുക', 'Remove me from the list')}</button>}
    </Screen>
  );
}
