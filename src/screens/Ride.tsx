import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { BadgeCheck } from 'lucide-react';
import { useApp, useLoad } from '../lib/app';
import { panchayatName } from '../lib/panchayat';
import { Avatar, CatIcon, Empty, LoadError, Loading, Screen, StarRow } from '../components/ui';
import { CAT_LABEL, isFree, rateText, rating, telHref, todayISO } from '../lib/util';
import { VEHICLE_CATS, type VehicleCategory } from '../types';
import { withReach } from './Workers';

export function Ride() {
  const { village, L, lang, pair } = useApp();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const [v, setV] = useState<VehicleCategory>((sp.get('v') as VehicleCategory) || 'auto');
  const [from, setFrom] = useState(L('വീട്', 'Home'));
  const [to, setTo] = useState('');
  const [when, setWhen] = useState<'now' | 'later'>('now');
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState('09:00');
  const only = sp.get('p') ?? '';

  const go = () => {
    const q = new URLSearchParams({ v, from, to, when, date: when === 'now' ? todayISO() : date, time: when === 'now' ? 'now' : time });
    if (only) q.set('p', only);
    nav(`/ride/drivers?${q}`);
  };

  return (
    <Screen title={L('വാഹനം ബുക്ക് ചെയ്യുക', 'Book a vehicle')}>
      <div className="map" aria-hidden>
        <div className="road" style={{ left: 0, right: 0, top: 110, height: 12 }} />
        <div className="road" style={{ left: '58%', top: 0, bottom: 0, width: 12 }} />
        <div className="road" style={{ left: 0, width: '58%', top: 40, height: 8 }} />
        <div style={{ position: 'absolute', left: '30%', top: 60, color: 'var(--green)', fontWeight: 700, fontSize: 13 }}>
          ● {village ? panchayatName(village, lang) : ''}
        </div>
      </div>
      <div className="field">
        <label htmlFor="from"><span className="dot" /> {L('എവിടെ നിന്ന്', 'From')}</label>
        <input id="from" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="to"><span className="dot red" /> {L('എങ്ങോട്ട്', 'To')}</label>
        <input id="to" className="input" value={to} onChange={(e) => setTo(e.target.value)} placeholder={L('ഉദാ: ബസ് സ്റ്റാൻഡ്, ആശുപത്രി', 'e.g. Bus stand, hospital')} />
      </div>
      <div className="grid3">
        {VEHICLE_CATS.map((c) => (
          <button key={c} className={'tile' + (v === c ? ' on' : '')} style={{ minHeight: 100, fontSize: 14 }} onClick={() => setV(c)} aria-pressed={v === c}>
            <CatIcon cat={c} size={20} />
            {pair(CAT_LABEL[c])}
          </button>
        ))}
      </div>
      <div className="chips">
        <button className={'chip' + (when === 'now' ? ' on' : '')} onClick={() => setWhen('now')}>{L('ഇപ്പോൾ', 'Now')}</button>
        <button className={'chip' + (when === 'later' ? ' on' : '')} onClick={() => setWhen('later')}>{L('പിന്നീട്', 'Later')}</button>
      </div>
      {when === 'later' && (
        <div className="row nowrap">
          <input aria-label={L('തീയതി', 'Date')} type="date" className="input" min={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} />
          <input aria-label={L('സമയം', 'Time')} type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
      )}
      <div className="spacer" />
      <button className="btn block yellow" disabled={!to.trim() || !from.trim()} onClick={go}>{L('ഡ്രൈവർമാരെ കാണുക', 'See drivers')}</button>
    </Screen>
  );
}

export function Drivers() {
  const [sp] = useSearchParams();
  const { api, profile, village, viewIds, reachIds, L, lang, pair, toast } = useApp();
  const nav = useNavigate();
  const v = (sp.get('v') as VehicleCategory) || 'auto';
  const only = sp.get('p');
  const [list, reload, err] = useLoad(() => api.listApprovedProviders(v, reachIds), [v, reachIds.join(',')]);
  const [busy, setBusy] = useState('');
  const rows = withReach(list ?? [], village, viewIds).filter(({ p }) => !only || p.uid === only);

  async function request(pid: string) {
    const p = rows.find((r) => r.p.uid === pid)?.p;
    if (!p || !profile) return;
    if (p.uid === profile.uid) { toast(L('സ്വന്തം profile ബുക്ക് ചെയ്യാൻ പറ്റില്ല', "You can't book yourself")); return; }
    setBusy(pid);
    try {
      const id = await api.createBooking({
        type: 'ride', customerId: profile.uid, customerName: profile.name, customerPhone: profile.phone,
        providerId: p.uid, providerName: p.name, providerPhone: p.phone, villageId: p.villageId,
        category: v, date: sp.get('date') ?? todayISO(), slot: sp.get('time') ?? 'now', details: '',
        from: sp.get('from') ?? '', to: sp.get('to') ?? '', status: 'requested', rated: false, createdAt: Date.now(),
      });
      nav(`/booking/${id}`, { replace: true });
    } catch {
      toast(L('Request അയയ്ക്കാൻ പറ്റിയില്ല', "Couldn't send the request"));
    } finally { setBusy(''); }
  }

  return (
    <Screen title={L(`ലഭ്യമായ ${pair(CAT_LABEL[v])}`, `Available: ${pair(CAT_LABEL[v])}`)} sub={`${sp.get('from')} → ${sp.get('to')}`}>
      {err && <LoadError retry={reload} />}
      {!list && !err && <Loading />}
      {rows.map(({ p, dist }) => {
        const free = isFree(p);
        return (
          <div key={p.uid} className="card" style={{ opacity: free || p.imported ? 1 : 0.65 }}>
            <Link to={`/provider/${p.uid}`}><Avatar name={p.name} className="auto" /></Link>
            <span className="stack grow">
              <span className="row" style={{ gap: 6 }}><b>{p.name}</b>{p.verified && <BadgeCheck size={16} color="var(--green)" aria-label="Verified" />}</span>
              <span className="muted small">{p.vehicleNo} <StarRow value={rating(p)} count={p.ratingCount} /></span>
              <span className="small" style={{ color: free ? 'var(--green-dark)' : 'var(--muted)' }}>
                <span className={'dot' + (free ? '' : ' off')} /> <span className="num">{dist} km</span> {L('അകലെ', 'away')} · {rateText(p, lang)}
              </span>
            </span>
            {p.imported
              ? <a className="btn sm yellow" href={telHref(p.phone)}>{L('വിളിക്കുക', 'Call')}</a>
              : <button className="btn sm yellow" disabled={!free || busy === p.uid} onClick={() => request(p.uid)}>{L('Request', 'Request')}</button>}
          </div>
        );
      })}
      {list && rows.length === 0 && <Empty text={L('ഇപ്പോൾ ഈ വാഹനം ലഭ്യമല്ല. മറ്റൊരു വാഹനം നോക്കുക.', 'No vehicles of this type right now. Try another type.')} />}
      <p className="muted center small">{L('കൂലി ഡ്രൈവറുമായി ഉറപ്പിക്കുക. പണം നേരിട്ട് (cash / UPI).', 'Confirm the fare with the driver. Pay directly (cash / UPI).')}</p>
    </Screen>
  );
}
