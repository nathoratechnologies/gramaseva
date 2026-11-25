import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, Clock, Navigation, Pencil, ShieldCheck, X } from 'lucide-react';
import { useApp, useLoad } from '../lib/app';
import { Avatar, CallButton, Empty, Loading, Screen } from '../components/ui';
import { ALL_JOBS, CAT_LABEL, canonJob, isFree, rating, timeAgo, todayISO } from '../lib/util';
import { WORK_CATS, VEHICLE_CATS, SHOP_CATS, isVehicle, isShop, type Category, type Provider } from '../types';
import { statusBadge, whenText } from './Bookings';
import { useShareLocation } from './Delivery';
import { directions, latLng } from './Ride';

const DAY = 24 * 3600_000;

export function ProviderDashboard() {
  const { api, provider, refresh, L, lang, pair, toast } = useApp();
  const [list, reload] = useLoad(() => (provider ? api.listProviderBookings(provider.uid) : Promise.resolve([])), [provider?.uid]);
  const [busy, setBusy] = useState(false);
  // Rides for today that I accepted: send my phone's position so the customer can follow the vehicle.
  const liveRides = (list ?? []).filter((b) => b.type === 'ride' && b.status === 'accepted' && b.date <= todayISO()).map((b) => b.id);
  const share = useShareLocation(liveRides, 'ride');
  if (!provider) {
    return (
      <Screen title={L('എന്റെ പണി', 'My work')}>
        <Empty text={L('നിങ്ങൾ ഇതുവരെ സേവനദാതാവായി ചേർന്നിട്ടില്ല.', "You haven't joined as a service provider yet.")}>
          <Link to="/work/register" className="btn">{L('സേവനദാതാവായി ചേരുക', 'Join as a provider')}</Link>
        </Empty>
      </Screen>
    );
  }
  const free = isFree(provider);
  const requests = (list ?? []).filter((b) => b.status === 'requested');
  const accepted = (list ?? []).filter((b) => b.status === 'accepted');
  const weekDone = (list ?? []).filter((b) => b.status === 'done' && Date.now() - b.createdAt < 7 * DAY).length;
  const hoursLeft = Math.max(0, Math.round((provider.availableUntil - Date.now()) / 3600_000));

  async function toggle() {
    setBusy(true);
    try {
      await api.setAvailability(provider!.uid, free ? 0 : Date.now() + DAY);
      await refresh();
      toast(free ? L('തിരക്കിലാണ് എന്ന് കാണിക്കും', 'Shown as busy') : L('24 മണിക്കൂർ ഫ്രീ ആയി കാണിക്കും', 'Shown as free for 24 hours'));
    } finally { setBusy(false); }
  }
  async function answer(id: string, s: 'accepted' | 'rejected' | 'done') {
    await api.updateBookingStatus(id, s);
    reload();
  }

  if (isShop(provider.category)) {
    return (
      <Screen title={L('എന്റെ കട', 'My shop')} right={<Link to="/work/register" className="iconbtn" aria-label={L('മാറ്റുക', 'Edit')}><Pencil size={20} /></Link>}>
        <Link to="/orders" className="btn block">🛒 {L('ഓർഡറുകൾ / അന്വേഷണങ്ങൾ കാണുക', 'See orders & enquiries')}</Link>
        <Link to="/ads/new" className="btn block outline">📣 {L('കടയുടെ പരസ്യം നൽകുക', 'Advertise my shop')}</Link>
        {(provider.status === 'rejected' || provider.status === 'blocked') && (
          <div className="notice bad">{L('നിങ്ങളുടെ കട വാർഡ് മെമ്പർ / പഞ്ചായത്ത് ഓഫീസ് തടഞ്ഞിരിക്കുകയാണ് (Block). ബന്ധപ്പെടുക.', 'Your shop is blocked right now. Please contact the ward member / panchayat office.')}</div>
        )}
        <div className="card col" style={{ gap: 4 }}>
          <b className="h2">{provider.shopName}</b>
          <span className="muted">{pair(CAT_LABEL[provider.category])}{provider.category === 'shopother' && provider.jobTitle ? ` · ${provider.jobTitle}` : ''}</span>
          {provider.address && <span>{provider.address}</span>}
          {provider.openHours && <span className="muted small">{provider.openHours}</span>}
        </div>
        <p className="muted">{L('നിങ്ങളുടെ കട "കടകൾ" പേജിൽ എല്ലാവർക്കും കാണാം, നേരിട്ട് വിളിക്കാം.', 'Your shop is listed under "Shops" for everyone to see and call.')}</p>
        <Link to={`/provider/${provider.uid}`} className="btn block">{L('എന്റെ കട എങ്ങനെ കാണുന്നു', 'See how my shop looks')}</Link>
        <Link to="/shops" className="btn block outline">{L('എല്ലാ കടകളും', 'All shops')}</Link>
      </Screen>
    );
  }
  return (
    <Screen title={L('എന്റെ പണി', 'My work')} right={<Link to="/work/register" className="iconbtn" aria-label={L('Profile മാറ്റുക', 'Edit profile')}><Pencil size={20} /></Link>}>
      {provider.status === 'pending' && (
        <div className="notice warn"><ShieldCheck size={20} style={{ flex: 'none' }} />
          {L('നിങ്ങളുടെ profile Village Coordinator പരിശോധിക്കുകയാണ്. Approve ആയാൽ ആളുകൾക്ക് നിങ്ങളെ കാണാം.', 'The village coordinator is checking your profile. People can see you once it is approved.')}
        </div>
      )}
      {(provider.status === 'rejected' || provider.status === 'blocked') && (
        <div className="notice bad">{L('നിങ്ങളുടെ profile വാർഡ് മെമ്പർ / പഞ്ചായത്ത് ഓഫീസ് തടഞ്ഞിരിക്കുകയാണ് (Block). ബന്ധപ്പെടുക.', 'Your profile is not shown right now. Please contact the village coordinator.')}</div>
      )}
      <div className="card" style={{ background: free ? 'var(--green)' : 'var(--surface)', color: free ? '#fff' : undefined, padding: 18 }}>
        <span className="stack grow">
          <b style={{ fontSize: 20 }}>{free ? L('ഇപ്പോൾ ഫ്രീ ആണ്', 'Free now') : L('തിരക്കിലാണ്', 'Busy')}</b>
          <span className="small" style={{ opacity: 0.9 }}>{free ? L('ആളുകൾക്ക് നിങ്ങളെ വിളിക്കാം', 'People can call you') : L('ഫ്രീ ആകുമ്പോൾ ഓൺ ആക്കുക', 'Switch on when you are free')}</span>
        </span>
        <button className={'switch' + (free ? ' on' : '')} disabled={busy} onClick={toggle} role="switch" aria-checked={free} aria-label={L('ഫ്രീ / തിരക്ക്', 'Free / busy')} />
      </div>
      {free && <p className="muted small row"><Clock size={14} aria-hidden />{L(`${hoursLeft} മണിക്കൂർ കഴിഞ്ഞാൽ "ഫ്രീ" തനിയെ off ആകും`, `"Free" switches off by itself in ${hoursLeft} h`)}</p>}
      <div className="grid2">
        <div className="card col" style={{ gap: 0 }}><b className="h2 num">{weekDone}</b><span className="muted small">{L('ഈ ആഴ്ച തീർത്ത പണി', 'Jobs done this week')}</span></div>
        <div className="card col" style={{ gap: 0 }}><b className="h2 num">{provider.ratingCount ? `${rating(provider).toFixed(1)} ★` : '—'}</b><span className="muted small">{L('റേറ്റിംഗ്', 'Rating')} ({provider.ratingCount})</span></div>
      </div>
      <p className="section">{L('പുതിയ requests', 'New requests')} ({requests.length})</p>
      {!list && <Loading />}
      {requests.map((b) => (
        <div key={b.id} className="card col" style={{ gap: 8 }}>
          <span className="row"><Avatar name={b.customerName} /><span className="stack grow"><b>{b.customerName}</b><span className="muted small">{whenText(b, lang)}</span></span></span>
          <span style={{ whiteSpace: 'pre-wrap' }}>{b.type === 'ride' ? `${b.from} → ${b.to}` : b.details}</span>
          <span className="row nowrap">
            <button className="btn sm grow" onClick={() => answer(b.id, 'accepted')}><Check size={18} />{L('സ്വീകരിക്കുക', 'Accept')}</button>
            <button className="btn sm outline grow" onClick={() => answer(b.id, 'rejected')}><X size={18} />{L('വേണ്ട', 'Decline')}</button>
            <CallButton phone={b.customerPhone} />
          </span>
        </div>
      ))}
      {list && requests.length === 0 && <p className="muted">{L('ഇപ്പോൾ പുതിയ requests ഇല്ല.', 'No new requests right now.')}</p>}
      {accepted.length > 0 && <p className="section">{L('സ്വീകരിച്ച പണികൾ', 'Accepted jobs')}</p>}
      {liveRides.length > 0 && (
        <div className={'notice ' + (share.error ? 'bad' : '')} style={{ display: 'block' }}>
          {share.error === 'denied'
            ? <b>{L('Location അനുമതി ഇല്ല. Phone settings-ൽ ഈ app-ന് location അനുവദിക്കുക — യാത്രക്കാരന് നിങ്ങളെ map-ൽ കാണാൻ.', 'Location permission is off. Allow location for this app so the passenger can see you on the map.')}</b>
            : share.error === 'gps'
              ? <b>{L('GPS കിട്ടുന്നില്ല. Phone-ലെ location ഓൺ ആക്കുക.', "Can't get GPS. Turn on location on your phone.")}</b>
              : <><b>📍 {L('Live location അയയ്ക്കുന്നു', 'Sharing live location')}</b>{share.at ? <span className="small"> · {timeAgo(share.at, lang)}</span> : null}</>}
          <div className="small">{L('യാത്ര കഴിയുന്നത് വരെ ഈ screen തുറന്ന് വെക്കുക. App അടച്ചാൽ location പോകില്ല.', 'Keep this screen open until the trip is over. Location stops if the app is closed.')}</div>
        </div>
      )}
      {accepted.map((b) => {
        const ride = b.type === 'ride';
        const pickup = latLng(b.fromLat, b.fromLng), drop = latLng(b.toLat, b.toLng);
        const next = b.startedAt ? drop : pickup;
        return (
          <div key={b.id} className="card col" style={{ gap: 8 }}>
            <span className="row nowrap">
              <span className="stack grow">
                <b>{b.customerName} · {pair(CAT_LABEL[b.category])}</b>
                <span className="muted small">{whenText(b, lang)}</span>
                {statusBadge(b.status, L)}
              </span>
              <CallButton phone={b.customerPhone} />
            </span>
            {ride && (<>
              <span className="small"><span className="dot" /> {b.from}</span>
              <span className="small"><span className="dot red" /> {b.to}</span>
              {b.startedAt && <span className="badge" style={{ alignSelf: 'flex-start' }}>{L('യാത്രയിൽ', 'On the trip')}</span>}
              {next && (
                <a className="btn sm outline" href={directions(next)} target="_blank" rel="noreferrer">
                  <Navigation size={16} aria-hidden /> {b.startedAt ? L('ഇറങ്ങുന്ന സ്ഥലത്തേക്ക് വഴി', 'Directions to drop') : L('കയറുന്ന സ്ഥലത്തേക്ക് വഴി', 'Directions to pick-up')}
                </a>
              )}
            </>)}
            <span className="row nowrap">
              {ride && !b.startedAt && (
                <button className="btn sm grow" onClick={async () => { await api.startRide(b.id); toast(L('യാത്ര തുടങ്ങി', 'Trip started')); reload(); }}>
                  {L('യാത്രക്കാരൻ കയറി — തുടങ്ങുക', 'Passenger is in — start')}
                </button>
              )}
              <button className={'btn sm grow' + (ride && !b.startedAt ? ' outline' : '')} onClick={() => answer(b.id, 'done')}>{ride ? L('യാത്ര കഴിഞ്ഞു', 'Trip done') : L('കഴിഞ്ഞു', 'Done')}</button>
            </span>
          </div>
        );
      })}
    </Screen>
  );
}

export function ProviderRegister() {
  const { api, profile, provider, homeVillage: village, refresh, L, pair, toast } = useApp();
  const nav = useNavigate();
  const p0 = provider;
  const [cat, setCat] = useState<Category>(p0?.category ?? 'plumbing');
  const [rate, setRate] = useState(String(p0?.rate ?? ''));
  const [radius, setRadius] = useState(p0?.radiusKm ?? 5);
  const [years, setYears] = useState(String(p0?.experienceYears ?? ''));
  const [vehicleNo, setVehicleNo] = useState(p0?.vehicleNo ?? '');
  const [about, setAbout] = useState(p0?.about ?? '');
  const [job, setJob] = useState(p0?.jobTitle ?? '');
  const [shopName, setShopName] = useState(p0?.shopName ?? '');
  const [address, setAddress] = useState(p0?.address ?? '');
  const [hours, setHours] = useState(p0?.openHours ?? '');
  const [agree, setAgree] = useState(!!p0);
  const [busy, setBusy] = useState(false);
  const vehicle = isVehicle(cat);
  const shop = isShop(cat);
  const kind: 'work' | 'vehicle' | 'shop' = shop ? 'shop' : vehicle ? 'vehicle' : 'work';
  const pickKind = (k: 'work' | 'vehicle' | 'shop') => { if (k !== kind) setCat(k === 'work' ? 'plumbing' : k === 'vehicle' ? 'auto' : 'bakery'); };
  const unit: Provider['rateUnit'] = vehicle ? 'km' : cat === 'coconut' ? 'job' : 'day';
  const unitLabel = unit === 'km' ? L('ഒരു km-ന്', 'per km') : unit === 'job' ? L('ഒരു തെങ്ങിന്', 'per tree') : L('ഒരു ദിവസത്തിന്', 'per day');

  if (!profile || !village) return <Screen title=""><Loading /></Screen>;

  async function save() {
    if (!profile || !village) return;
    setBusy(true);
    try {
      const p: Provider = {
        uid: profile.uid, name: profile.name, phone: profile.phone, villageId: village.id, ...(profile.ward ? { ward: profile.ward } : {}), category: cat,
        rate: shop ? 0 : Number(rate), rateUnit: unit, radiusKm: shop ? 5 : radius, lat: p0?.lat ?? profile.pinLat ?? village.lat, lng: p0?.lng ?? profile.pinLng ?? village.lng,
        ...(profile.pincode ? { pincode: profile.pincode } : {}),
        availableUntil: p0?.availableUntil ?? 0, status: p0?.status ?? 'approved', verified: p0?.verified ?? false,
        ratingSum: p0?.ratingSum ?? 0, ratingCount: p0?.ratingCount ?? 0, createdAt: p0?.createdAt ?? Date.now(),
        ...(years ? { experienceYears: Number(years) } : {}),
        ...(vehicle && vehicleNo.trim() ? { vehicleNo: vehicleNo.trim().toUpperCase() } : {}),
        ...(about.trim() ? { about: about.trim() } : {}),
        ...(shop ? { shopName: shopName.trim().slice(0, 60), ...(address.trim() ? { address: address.trim().slice(0, 150) } : {}), ...(hours.trim() ? { openHours: hours.trim().slice(0, 60) } : {}) } : {}),
        ...((cat === 'other' || cat === 'shopother') && job.trim() ? { jobTitle: canonJob(job).slice(0, 40) } : {}),
      };
      await api.saveProvider(p);
      await refresh();
      toast(p0 ? L('സേവ് ചെയ്തു', 'Saved') : L('Register ചെയ്തു! ഇനി എല്ലാവർക്കും നിങ്ങളെ കാണാം.', 'Registered! Everyone can see you now.'));
      nav('/work', { replace: true });
    } catch (e) {
      console.error(e);
      toast(L('സേവ് ചെയ്യാൻ പറ്റിയില്ല', "Couldn't save"));
    } finally { setBusy(false); }
  }

  return (
    <Screen title={p0 ? L('Profile മാറ്റുക', 'Edit profile') : L('സേവനദാതാവായി ചേരുക', 'Join as a provider')}>
      <p className="section">{L('ഞാൻ ആരാണ്?', 'What do you offer?')}</p>
      <div className="chips">
        <button className={'chip' + (kind === 'work' ? ' on' : '')} onClick={() => pickKind('work')}>{L('പണിക്കാരൻ', 'Worker')}</button>
        <button className={'chip' + (kind === 'vehicle' ? ' on' : '')} onClick={() => pickKind('vehicle')}>{L('വാഹനം / ഡ്രൈവർ', 'Vehicle / driver')}</button>
        <button className={'chip' + (kind === 'shop' ? ' on' : '')} onClick={() => pickKind('shop')}>{L('കട / സ്ഥാപനം', 'Shop / business')}</button>
      </div>
      <p className="section">{kind === 'shop' ? L('ഏത് കട?', 'What kind of shop?') : kind === 'vehicle' ? L('ഏത് വാഹനം?', 'Which vehicle?') : L('ഏത് പണി?', 'Which work?')}</p>
      <div className="row">{(kind === 'shop' ? SHOP_CATS : kind === 'vehicle' ? VEHICLE_CATS : WORK_CATS).map((c) => <button key={c} className={'chip' + (cat === c ? ' on' : '')} onClick={() => setCat(c)}>{pair(CAT_LABEL[c])}</button>)}</div>
      {shop && (
        <>
          <div className="field"><label htmlFor="shopn">{L('കടയുടെ പേര്', 'Shop name')}</label><input id="shopn" className="input" value={shopName} onChange={(e) => setShopName(e.target.value)} maxLength={60} placeholder={L('ഉദാ: ശ്രീ ബേക്കറി', 'e.g. Sree Bakery')} /></div>
          {cat === 'shopother' && (
            <div className="field"><label htmlFor="job">{L('ഏതുതരം കട?', 'Type of shop')}</label><input id="job" className="input" value={job} onChange={(e) => setJob(e.target.value)} maxLength={40} placeholder={L('ഉദാ: പൂക്കട', 'e.g. Flower shop')} /></div>
          )}
          <div className="field"><label htmlFor="addr">{L('കടയുടെ സ്ഥലം / വിലാസം', 'Shop address / landmark')}</label><input id="addr" className="input" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={150} placeholder={L('ഉദാ: തകഴി ജംഗ്ഷൻ, ബസ് സ്റ്റോപ്പിനടുത്ത്', 'e.g. Thakazhy junction, near bus stop')} /></div>
          <div className="field"><label htmlFor="hrs">{L('തുറക്കുന്ന സമയം', 'Opening hours')}</label><input id="hrs" className="input" value={hours} onChange={(e) => setHours(e.target.value)} maxLength={60} placeholder={L('ഉദാ: രാവിലെ 8 മുതൽ രാത്രി 9 വരെ', 'e.g. 8 am – 9 pm')} /></div>
        </>
      )}
      {cat === 'other' && (
        <div className="field">
          <label htmlFor="job">{L('നിങ്ങളുടെ തൊഴിൽ (ലിസ്റ്റിൽ ഇല്ലാത്തത്)', 'Your work (not in the list)')}</label>
          <input id="job" className="input" value={job} onChange={(e) => setJob(e.target.value)} maxLength={40} placeholder={L('ഉദാ: സ്റ്റേജ് ഡെക്കറേഷൻ', 'e.g. Stage decoration')} />
          <div className="chips">{ALL_JOBS.map((j) => <button key={j[1]} className={'chip' + (canonJob(job) === j[0] ? ' on' : '')} onClick={() => setJob(pair(j))}>{pair(j)}</button>)}</div>
          <span className="muted small">{L('ഇവിടെ എഴുതുന്ന തൊഴിൽ എല്ലാവർക്കും "പണിക്കാരെ വിളിക്കാം" പേജിൽ ഒരു പുതിയ വിഭാഗമായി കാണാം.', 'The work you type here shows to everyone as a new section on the "Call a worker" page.')}</span>
        </div>
      )}
      {!shop && <div className="field">
        <label htmlFor="rate" className="section" style={{ color: 'var(--ink)' }}>{L('നിരക്ക്', 'Rate')} ({unitLabel})</label>
        <label className="input phone-input" htmlFor="rate"><b>₹</b>
          <input id="rate" inputMode="numeric" value={rate} onChange={(e) => setRate(e.target.value.replace(/\D/g, ''))} style={{ border: 0, outline: 0, flex: 1, fontSize: 18, background: 'transparent', minWidth: 0 }} />
        </label>
      </div>}
      {vehicle && (
        <div className="field"><label htmlFor="veh">{L('വാഹന നമ്പർ', 'Vehicle number')}</label><input id="veh" className="input" value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} placeholder="KL 08 AB 1234" /></div>
      )}
      {!shop && <><div className="field"><label htmlFor="yrs">{L('എത്ര വർഷത്തെ പരിചയം', 'Years of experience')}</label><input id="yrs" className="input" inputMode="numeric" value={years} onChange={(e) => setYears(e.target.value.replace(/\D/g, ''))} /></div>
      <div className="row between"><label htmlFor="radius" className="section">{L('എത്ര ദൂരം വരെ പോകും?', 'How far will you travel?')}</label><span className="badge num">{radius} km</span></div>
      <input id="radius" className="slider" type="range" min={1} max={20} value={radius} onChange={(e) => setRadius(Number(e.target.value))} />
      <p className="muted small">{L('ഈ ദൂരത്തിനുള്ളിലെ അടുത്ത വില്ലേജുകളിലെ ആൾക്കാർക്കും നിങ്ങളെ കാണാം.', 'People in nearby villages within this distance can also find you.')}</p></>}
      <div className="field"><label htmlFor="about">{shop ? L('കടയെക്കുറിച്ച് (വേണമെങ്കിൽ)', 'About the shop (optional)') : L('നിങ്ങളെക്കുറിച്ച് (വേണമെങ്കിൽ)', 'About you (optional)')}</label><textarea id="about" className="input" rows={3} value={about} onChange={(e) => setAbout(e.target.value)} maxLength={300} placeholder={L('ഉദാ: പൈപ്പ്, ടാങ്ക്, മോട്ടോർ ഫിറ്റിംഗ്', 'e.g. Pipes, tanks, motor fitting')} /></div>
      {!p0 && (
        <button className="card tap" onClick={() => setAgree(!agree)} role="checkbox" aria-checked={agree}>
          <span className={'check' + (agree ? ' on' : '')}>{agree && <Check size={18} />}</span>
          <span className="grow small">{L(`എന്റെ പേരും ഫോൺ നമ്പറും (${profile.phone}) ഗ്രാമസേവയിൽ എല്ലാവർക്കും കാണിക്കാൻ ഞാൻ സമ്മതിക്കുന്നു.`, `I agree to show my name and phone number (${profile.phone}) to everyone on Gramaseva.`)}</span>
        </button>
      )}
      <div className="notice"><ShieldCheck size={20} style={{ flex: 'none' }} />{L('Village Coordinator / വാർഡ് മെമ്പർ പരിശോധിച്ചാൽ Verified badge കിട്ടും.', 'You get a Verified badge after the village coordinator or ward member checks you.')}</div>
      <button className="btn block" disabled={busy || (!shop && !rate) || !agree || (vehicle && !vehicleNo.trim()) || ((cat === 'other' || cat === 'shopother') && job.trim().length < 2) || (shop && shopName.trim().length < 2)} onClick={save}>{p0 ? L('സേവ് ചെയ്യുക', 'Save') : L('Register ചെയ്യുക', 'Register')}</button>
    </Screen>
  );
}
