import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, Clock, Star, XCircle } from 'lucide-react';
import { useApp, useLoad } from '../lib/app';
import { Avatar, CallButton, CatIcon, Empty, LoadError, Loading, Screen } from '../components/ui';
import { CAT_LABEL, SLOTS, prettyDate, prettyPhone } from '../lib/util';
import type { Booking, BookingStatus, Lang } from '../types';

export function statusBadge(s: BookingStatus, L: (a: string, b: string) => string) {
  const m: Record<BookingStatus, [string, string]> = {
    requested: ['badge warn', L('മറുപടി കാത്തിരിക്കുന്നു', 'Waiting for reply')],
    accepted: ['badge', L('സ്വീകരിച്ചു', 'Accepted')],
    rejected: ['badge bad', L('നിരസിച്ചു', 'Declined')],
    done: ['badge grey', L('കഴിഞ്ഞു', 'Done')],
    cancelled: ['badge grey', L('റദ്ദാക്കി', 'Cancelled')],
  };
  return <span className={m[s][0]}>{m[s][1]}</span>;
}

export const whenText = (b: Booking, lang: Lang) =>
  `${prettyDate(b.date, lang)} · ${SLOTS[b.slot] ? (lang === 'ml' ? SLOTS[b.slot][0] : SLOTS[b.slot][1]) : b.slot}`;

export function BookingStatusScreen() {
  const { id = '' } = useParams();
  const { api, L, lang, pair, toast } = useApp();
  const [b, reload] = useLoad(() => api.getBooking(id), [id]);

  // Poll while waiting for the provider's answer.
  useEffect(() => {
    if (b?.status !== 'requested') return;
    const t = setInterval(reload, 3000);
    return () => clearInterval(t);
  }, [b?.status, reload]);

  if (b === undefined) return <Screen title=""><Loading /></Screen>;
  if (b === null) return <Screen title=""><Empty text={L('ബുക്കിംഗ് കണ്ടെത്താനായില്ല.', 'Booking not found.')} /></Screen>;

  const head: Record<BookingStatus, [JSX.Element, string, string]> = {
    requested: [<Clock size={48} />, L(`${b.providerName}-ന്റെ മറുപടി കാത്തിരിക്കുന്നു`, `Waiting for ${b.providerName}`), L('മറുപടി വൈകിയാൽ നേരിട്ട് വിളിക്കാം.', 'If there is no reply soon, call them directly.')],
    accepted: [<CheckCircle2 size={48} />, b.type === 'ride' ? L(`${b.providerName} വരുന്നുണ്ട്!`, `${b.providerName} is coming!`) : L(`${b.providerName} സ്വീകരിച്ചു!`, `${b.providerName} accepted!`), whenText(b, lang)],
    rejected: [<XCircle size={48} />, L(`${b.providerName} ഇപ്പോൾ ലഭ്യമല്ല`, `${b.providerName} is not available`), L('മറ്റൊരാളെ നോക്കുക.', 'Please try someone else.')],
    done: [<CheckCircle2 size={48} />, L('പണി കഴിഞ്ഞു', 'Completed'), whenText(b, lang)],
    cancelled: [<XCircle size={48} />, L('ബുക്കിംഗ് റദ്ദാക്കി', 'Booking cancelled'), ''],
  };
  const [icon, title, sub] = head[b.status];
  const good = b.status === 'accepted' || b.status === 'done';

  async function set(s: BookingStatus) {
    await api.updateBookingStatus(b!.id, s);
    toast(s === 'cancelled' ? L('റദ്ദാക്കി', 'Cancelled') : L('സേവ് ചെയ്തു', 'Saved'));
    reload();
  }

  return (
    <Screen title="" back="/bookings">
      <div className="stack" style={{ alignItems: 'center', textAlign: 'center', gap: 10 }}>
        <span style={{ width: 96, height: 96, borderRadius: 48, display: 'grid', placeItems: 'center', background: good ? 'var(--green-soft)' : 'var(--yellow-soft)', color: good ? 'var(--green)' : 'var(--orange-ink)' }}>{icon}</span>
        <h1 className="h2">{title}</h1>
        {sub && <p className="muted" style={{ fontSize: 16 }}>{sub}</p>}
      </div>
      <div className="card">
        <Avatar name={b.providerName} className={b.type === 'ride' ? 'auto' : ''} />
        <span className="stack grow">
          <b>{b.providerName}</b>
          <span className="muted small">{pair(CAT_LABEL[b.category])}</span>
          <span className="muted small num" style={{ userSelect: 'all' }}>{prettyPhone(b.providerPhone)}</span>
        </span>
        <CallButton phone={b.providerPhone} />
      </div>
      <div className="card col" style={{ gap: 8 }}>
        {b.type === 'ride' ? (
          <>
            <span><span className="dot" /> {b.from}</span>
            <span><span className="dot red" /> {b.to}</span>
          </>
        ) : <span style={{ whiteSpace: 'pre-wrap' }}>{b.details}</span>}
        <span className="muted small">{whenText(b, lang)} · {L('പണം നേരിട്ട് (cash / UPI)', 'Pay directly (cash / UPI)')}</span>
      </div>
      <div className="spacer" />
      {b.status === 'accepted' && <button className="btn block" onClick={() => set('done')}>{L('പണി കഴിഞ്ഞു', 'Mark as done')}</button>}
      {b.status === 'done' && !b.rated && <Link className="btn block yellow" to={`/rate/${b.id}`}><Star size={20} />{L('റേറ്റിംഗ് നൽകുക', 'Give a rating')}</Link>}
      {(b.status === 'requested' || b.status === 'accepted') && <button className="btn block danger" onClick={() => set('cancelled')}>{L('റദ്ദാക്കുക', 'Cancel booking')}</button>}
    </Screen>
  );
}

export function MyBookings() {
  const { api, profile, L, lang, pair } = useApp();
  const [tab, setTab] = useState<'up' | 'past'>('up');
  const [list, reload, err] = useLoad(() => (profile ? api.listMyBookings(profile.uid) : Promise.resolve([])), [profile?.uid]);
  const up = (list ?? []).filter((b) => b.status === 'requested' || b.status === 'accepted');
  const past = (list ?? []).filter((b) => !(b.status === 'requested' || b.status === 'accepted'));
  const show = tab === 'up' ? up : past;
  const toRate = past.filter((b) => b.status === 'done' && !b.rated);

  return (
    <Screen title={L('എന്റെ ബുക്കിംഗുകൾ', 'My bookings')} back={false} nav>
      <div className="tabs">
        <button className={tab === 'up' ? 'on' : ''} onClick={() => setTab('up')}>{L('വരാനിരിക്കുന്നവ', 'Upcoming')} ({up.length})</button>
        <button className={tab === 'past' ? 'on' : ''} onClick={() => setTab('past')}>{L('കഴിഞ്ഞവ', 'Past')}</button>
      </div>
      {err && <LoadError retry={reload} />}
      {!list && !err && <Loading />}
      {tab === 'up' && toRate.length > 0 && (
        <Link to={`/rate/${toRate[0].id}`} className="notice warn"><Star size={18} />{L(`${toRate[0].providerName}-ന് റേറ്റിംഗ് നൽകുക`, `Rate ${toRate[0].providerName}`)}</Link>
      )}
      {show.map((b) => (
        <Link key={b.id} to={`/booking/${b.id}`} className="card">
          <CatIcon cat={b.category} size={20} />
          <span className="stack grow">
            <b>{b.providerName} — {pair(CAT_LABEL[b.category])}</b>
            <span className="muted small">{whenText(b, lang)}</span>
            <span>{statusBadge(b.status, L)}</span>
          </span>
          {(b.status === 'requested' || b.status === 'accepted') && <CallButton phone={b.providerPhone} />}
        </Link>
      ))}
      {list && show.length === 0 && (
        <Empty text={tab === 'up' ? L('ഇപ്പോൾ ബുക്കിംഗുകളൊന്നുമില്ല.', 'No bookings right now.') : L('കഴിഞ്ഞ ബുക്കിംഗുകളൊന്നുമില്ല.', 'No past bookings.')}>
          {tab === 'up' && <Link to="/services" className="btn sm outline">{L('പണിക്കാരെ നോക്കുക', 'Find a worker')}</Link>}
        </Empty>
      )}
    </Screen>
  );
}

export function RateBooking() {
  const { id = '' } = useParams();
  const { api, profile, L, toast } = useApp();
  const [b] = useLoad(() => api.getBooking(id), [id]);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  if (!b || !profile) return <Screen title=""><Loading /></Screen>;
  async function send() {
    setBusy(true);
    try {
      await api.addReview(b!, stars, comment.trim(), profile!.name);
      setDone(true);
      toast(L('നന്ദി! റേറ്റിംഗ് സേവ് ചെയ്തു', 'Thanks! Rating saved'));
    } catch (e) {
      console.error(e);
      toast(L('സേവ് ചെയ്യാൻ പറ്റിയില്ല', "Couldn't save"));
    } finally { setBusy(false); }
  }
  if (done || b.rated) {
    return <Screen title={L('റേറ്റിംഗ്', 'Rating')} back="/bookings"><Empty icon={<CheckCircle2 size={48} color="var(--green)" />} text={L('റേറ്റിംഗ് നൽകിയതിന് നന്ദി.', 'Thanks for your rating.')} /></Screen>;
  }
  return (
    <Screen title={L('റേറ്റിംഗ് നൽകുക', 'Give a rating')} sub={b.providerName}>
      <div className="stars" style={{ justifyContent: 'center', display: 'flex' }} role="radiogroup" aria-label="stars">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => setStars(n)} role="radio" aria-checked={stars === n} aria-label={`${n}`}>
            <Star size={44} fill={n <= stars ? '#f9a825' : 'none'} />
          </button>
        ))}
      </div>
      <div className="field"><label htmlFor="cm">{L('അഭിപ്രായം (വേണമെങ്കിൽ)', 'Comment (optional)')}</label><textarea id="cm" className="input" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={300} /></div>
      <div className="spacer" />
      <button className="btn block" disabled={!stars || busy} onClick={send}>{L('സേവ് ചെയ്യുക', 'Save')}</button>
    </Screen>
  );
}
