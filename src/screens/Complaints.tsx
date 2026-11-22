import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Camera, MessageSquareWarning, Plus, Send, X } from 'lucide-react';
import { useApp, useLoad } from '../lib/app';
import { CallButton, Empty, LoadError, Loading, Screen } from '../components/ui';
import { panchayatName, sortedWards, wardLabel } from '../lib/panchayat';
import { compressImage, prettyPhone, timeAgo } from '../lib/util';
import { useAdminHere } from './Local';
import type { Complaint } from '../types';

function StatusBadge({ s }: { s: Complaint['status'] }) {
  const { L } = useApp();
  if (s === 'open') return <span className="badge warn">{L('മറുപടി കാത്തിരിക്കുന്നു', 'Waiting for reply')}</span>;
  if (s === 'replied') return <span className="badge">{L('മറുപടി ലഭിച്ചു', 'Replied')}</span>;
  return <span className="badge grey">{L('പരിഹരിച്ചു', 'Resolved')}</span>;
}

function Photo({ src }: { src: string }) {
  const [big, setBig] = useState(false);
  return <img src={src} alt="" onClick={() => setBig(!big)} style={{ width: big ? '100%' : 120, maxHeight: big ? undefined : 120, objectFit: 'cover', borderRadius: 10, cursor: 'zoom-in', alignSelf: 'flex-start' }} />;
}

/** Resident view: my messages + inbox for ward members / president. */
export function Complaints() {
  const { api, profile, L } = useApp();
  const adminVid = useAdminHere();
  const [tab, setTab] = useState<'mine' | 'inbox'>(adminVid ? 'inbox' : 'mine');
  const [mine, reload, err] = useLoad(() => (profile ? api.listMyComplaints(profile.uid) : Promise.resolve([] as Complaint[])), [profile?.uid]);
  return (
    <Screen title={L('പരാതി / സന്ദേശം', 'Complaints & messages')} nav
      right={<Link to="/complaints/new" className="iconbtn" aria-label={L('പുതിയത്', 'New')}><Plus size={24} /></Link>}>
      {adminVid && (
        <div className="chips">
          <button className={'chip' + (tab === 'inbox' ? ' on' : '')} onClick={() => setTab('inbox')}>{L('ലഭിച്ചവ (വാർഡ് മെമ്പർ)', 'Received (ward member)')}</button>
          <button className={'chip' + (tab === 'mine' ? ' on' : '')} onClick={() => setTab('mine')}>{L('ഞാൻ അയച്ചവ', 'My messages')}</button>
        </div>
      )}
      {tab === 'inbox' && adminVid ? <ComplaintInbox villageId={adminVid} /> : (
        <>
          {err && <LoadError retry={reload} />}
          {!mine && !err && <Loading />}
          {(mine ?? []).map((c) => (
            <div key={c.id} className="card" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
              <span className="row" style={{ justifyContent: 'space-between' }}><StatusBadge s={c.status} /><span className="muted small">{timeAgo(c.createdAt, 'ml')}</span></span>
              <span>{c.text}</span>
              {c.photo && <Photo src={c.photo} />}
              {c.reply && (
                <div className="notice" style={{ margin: 0 }}>
                  <b>{c.repliedByName || L('വാർഡ് മെമ്പർ', 'Ward member')}:</b> {c.reply}
                </div>
              )}
            </div>
          ))}
          {mine && mine.length === 0 && (
            <Empty icon={<MessageSquareWarning size={28} />} text={L('നിങ്ങളുടെ വാർഡ് മെമ്പർക്ക് പരാതിയോ സന്ദേശമോ ഫോട്ടോ സഹിതം അയക്കാം.', 'Send a complaint or message, with a photo, to your ward member.')}>
              <Link to="/complaints/new" className="btn"><Plus size={20} /> {L('പുതിയ സന്ദേശം', 'New message')}</Link>
            </Empty>
          )}
        </>
      )}
    </Screen>
  );
}

export function ComplaintForm() {
  const { api, profile, village, lang, L, toast } = useApp();
  const nav = useNavigate();
  const [ward, setWard] = useState(profile?.ward ?? '');
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState('');
  const [busy, setBusy] = useState(false);
  if (!profile || !village) return <Screen title=""><Loading /></Screen>;
  const wards = sortedWards(village, lang);

  async function pick(f: File | undefined) {
    if (!f) return;
    try { setPhoto(await compressImage(f)); } catch { toast(L('ഫോട്ടോ എടുക്കാൻ പറ്റിയില്ല', "Couldn't read the photo")); }
  }
  async function send() {
    if (!profile || !village || !text.trim()) return;
    setBusy(true);
    try {
      await api.createComplaint({
        villageId: village.id, ...(ward ? { ward } : {}), fromUid: profile.uid, fromName: profile.name, fromPhone: profile.phone,
        text: text.trim().slice(0, 1500), ...(photo ? { photo } : {}), status: 'open', createdAt: Date.now(),
      });
      toast(L('അയച്ചു. വാർഡ് മെമ്പർ കാണും.', 'Sent. Your ward member will see it.'));
      nav('/complaints', { replace: true });
    } catch (e) { console.error(e); toast(L('അയക്കാൻ പറ്റിയില്ല', "Couldn't send")); } finally { setBusy(false); }
  }
  return (
    <Screen title={L('പുതിയ പരാതി / സന്ദേശം', 'New complaint / message')}>
      <p className="muted small">{panchayatName(village, lang)} · {L('വാർഡ് മെമ്പറും പഞ്ചായത്ത് പ്രസിഡന്റും മാത്രമേ ഇത് കാണൂ.', 'Only your ward member and the panchayat president can see this.')}</p>
      {wards.length > 0 && (
        <label className="stack">{L('ഏത് വാർഡ്?', 'Which ward?')}
          <select className="input" value={ward} onChange={(e) => setWard(e.target.value)}>
            <option value="">{L('വാർഡ് തിരഞ്ഞെടുക്കുക', 'Choose ward')}</option>
            {wards.map((w) => <option key={w.no} value={String(w.no)}>{lang === 'ml' ? w.name : w.nameEn}</option>)}
          </select>
        </label>
      )}
      <label className="stack">{L('പരാതി / സന്ദേശം', 'Your message')}
        <textarea className="input" rows={5} maxLength={1500} value={text} onChange={(e) => setText(e.target.value)} placeholder={L('ഉദാ: ഞങ്ങളുടെ റോഡിൽ തെരുവുവിളക്ക് കത്തുന്നില്ല…', 'e.g. The street light on our road is not working…')} />
      </label>
      {photo ? (
        <div className="stack">
          <img src={photo} alt="" style={{ width: '100%', borderRadius: 12 }} />
          <button className="chip" style={{ alignSelf: 'flex-start' }} onClick={() => setPhoto('')}><X size={14} /> {L('ഫോട്ടോ മാറ്റുക', 'Remove photo')}</button>
        </div>
      ) : (
        <label className="btn outline block" style={{ cursor: 'pointer' }}>
          <Camera size={20} /> {L('ഫോട്ടോ ചേർക്കുക', 'Add a photo')}
          <input type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
        </label>
      )}
      <button className="btn block" disabled={busy || !text.trim() || (wards.length > 0 && !ward)} onClick={send}><Send size={20} /> {L('അയക്കുക', 'Send')}</button>
    </Screen>
  );
}

/** Ward member / president: all messages of the panchayat, filtered by ward, with reply. Also used in the admin panel. */
export function ComplaintInbox({ villageId }: { villageId: string }) {
  const { api, profile, village, villages, lang, L, toast } = useApp();
  const v = villages.find((x) => x.id === villageId) ?? village ?? undefined;
  const [list, reload, err] = useLoad(() => api.listComplaints(villageId), [villageId]);
  const [ward, setWard] = useState('');
  const [show, setShow] = useState<'open' | 'all'>('open');
  const [draft, setDraft] = useState<Record<string, string>>({});
  const wards = sortedWards(v, lang);
  const rows = (list ?? []).filter((c) => (!ward || c.ward === ward) && (show === 'all' || c.status !== 'resolved'));
  const counts = new Map<string, number>();
  (list ?? []).filter((c) => c.status === 'open').forEach((c) => counts.set(c.ward ?? '', (counts.get(c.ward ?? '') ?? 0) + 1));

  async function reply(c: Complaint, resolved: boolean) {
    const r = (draft[c.id] ?? '').trim();
    if (!r && !resolved) return;
    try {
      await api.replyComplaint(c.id, r || c.reply || (lang === 'ml' ? 'പരിഹരിച്ചു.' : 'Resolved.'), profile?.name ?? '', resolved);
      toast(L('മറുപടി അയച്ചു', 'Reply sent'));
      setDraft((d) => ({ ...d, [c.id]: '' }));
      reload();
    } catch (e) { console.error(e); toast(L('പറ്റിയില്ല', "Couldn't do that")); }
  }
  return (
    <>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <select className="input" style={{ flex: 1, minWidth: 160 }} aria-label={L('വാർഡ്', 'Ward')} value={ward} onChange={(e) => setWard(e.target.value)}>
          <option value="">{L('എല്ലാ വാർഡും', 'All wards')}</option>
          {wards.map((w) => <option key={w.no} value={String(w.no)}>{(lang === 'ml' ? w.name : w.nameEn) + (counts.get(String(w.no)) ? ` (${counts.get(String(w.no))})` : '')}</option>)}
        </select>
        <select className="input" style={{ flex: 1, minWidth: 130 }} value={show} onChange={(e) => setShow(e.target.value as 'open' | 'all')}>
          <option value="open">{L('തീർപ്പാകാത്തവ', 'Not resolved')}</option>
          <option value="all">{L('എല്ലാം', 'All')}</option>
        </select>
      </div>
      {err && <LoadError retry={reload} />}
      {!list && !err && <Loading />}
      {rows.map((c) => (
        <div key={c.id} className="card" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
          <span className="row" style={{ justifyContent: 'space-between' }}>
            <StatusBadge s={c.status} />
            <span className="muted small">{timeAgo(c.createdAt, lang)}{c.ward ? ` · ${wardLabel(v, c.ward, lang)}` : ''}</span>
          </span>
          <b>{c.fromName} <span className="muted small num">{prettyPhone(c.fromPhone)}</span></b>
          <span>{c.text}</span>
          {c.photo && <Photo src={c.photo} />}
          {c.reply && <div className="notice" style={{ margin: 0 }}><b>{c.repliedByName}:</b> {c.reply}</div>}
          {c.status !== 'resolved' && (
            <>
              <textarea className="input" rows={2} value={draft[c.id] ?? ''} onChange={(e) => setDraft((d) => ({ ...d, [c.id]: e.target.value }))} placeholder={L('മറുപടി എഴുതുക…', 'Write a reply…')} />
              <span className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                <button className="btn sm" disabled={!(draft[c.id] ?? '').trim()} onClick={() => reply(c, false)}><Send size={16} /> {L('മറുപടി', 'Reply')}</button>
                <button className="btn sm outline" onClick={() => reply(c, true)}>{L('പരിഹരിച്ചു', 'Mark resolved')}</button>
                <CallButton phone={c.fromPhone} />
              </span>
            </>
          )}
        </div>
      ))}
      {list && rows.length === 0 && <Empty text={L('സന്ദേശങ്ങളൊന്നുമില്ല.', 'No messages.')} />}
    </>
  );
}
