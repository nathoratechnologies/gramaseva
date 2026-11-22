import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Home as HomeIcon, MapPin, Navigation, Search, Users } from 'lucide-react';
import { useApp, useLoad } from '../lib/app';
import { getPosition, reverseGeocode, type Place } from '../lib/geo';
import { panchayatKey, panchayatName, roleLabel, sortedWards, wardLabel, type Panchayat } from '../lib/panchayat';
import { km, mapsEmbed, mapsLink } from '../lib/util';
import { Avatar, CallButton, CatIcon, Empty, Loading, Screen } from '../components/ui';
import { CAT_LABEL, isFree } from '../lib/util';
import { SHOP_CATS, VEHICLE_CATS, WORK_CATS, type Category, type Provider } from '../types';

/** Find the panchayat the phone is in: by the name from the map, else the nearest one within 6 km. */
export async function locatePanchayat(panchayats: Panchayat[]): Promise<{ found: Panchayat | null; place: Place | null }> {
  const here = await getPosition();
  const place = await reverseGeocode(here.lat, here.lng).catch(() => null);
  if (place?.panchayat && place.district) {
    const k = panchayatKey({ district: place.district, panchayat: place.panchayat });
    const byName = panchayats.find((p) => p.key === k);
    if (byName) return { found: byName, place };
  }
  const near = panchayats
    .filter((p) => p.main.status === 'live')
    .map((p) => ({ p, d: km(here, p.main) }))
    .sort((a, b) => a.d - b.d)[0];
  if (near && near.d <= 6) return { found: near.p, place };
  return { found: null, place: place ?? { lat: here.lat, lng: here.lng, district: '', districtEn: '', panchayat: '', panchayatEn: '', village: '', villageEn: '' } };
}

/** Search + district filter + location, used both to browse and to set the home panchayat. */
export function PanchayatChooser({ selected, onPick, onNotFound }: { selected?: string | null; onPick: (p: Panchayat) => void; onNotFound?: (place: Place) => void }) {
  const { panchayats, lang, L, toast } = useApp();
  const [q, setQ] = useState('');
  const [district, setDistrict] = useState('all');
  const [locating, setLocating] = useState(false);
  const districts = [...new Set(panchayats.map((p) => p.district))];
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return panchayats.filter((p) => (district === 'all' || p.district === district)
      && (!t || [p.main.name, p.main.nameEn, p.main.panchayat, p.district].some((s) => s?.toLowerCase().includes(t))));
  }, [panchayats, q, district]);

  async function locate() {
    setLocating(true);
    try {
      const { found, place } = await locatePanchayat(panchayats);
      if (found) {
        toast(L(`നിങ്ങൾ ഇപ്പോൾ: ${panchayatName(found.main, 'ml')}`, `You are in: ${panchayatName(found.main, 'en')}`));
        onPick(found);
      } else if (place && onNotFound) onNotFound(place);
      else toast(L('ഈ സ്ഥലത്തെ പഞ്ചായത്ത് ഇതുവരെ ഗ്രാമസേവയിൽ ഇല്ല. ലിസ്റ്റിൽ നിന്ന് തിരഞ്ഞെടുക്കുക.', "This place's panchayat isn't on Gramaseva yet. Choose from the list."));
    } catch {
      toast(L('Location കിട്ടിയില്ല. ഫോണിൽ Location on ആണോ എന്നും ഈ site-ന് അനുവാദം കൊടുത്തോ എന്നും നോക്കുക.', "Couldn't get your location. Check that Location is on and this site is allowed to use it."));
    } finally { setLocating(false); }
  }

  return (
    <>
      <button className="btn block outline" onClick={locate} disabled={locating}>
        <Navigation size={20} aria-hidden />{locating ? L('സ്ഥലം കണ്ടെത്തുന്നു…', 'Finding your place…') : L('ഞാൻ ഇപ്പോൾ ഉള്ള പഞ്ചായത്ത് (location)', 'The panchayat I am in now (location)')}
      </button>
      <label className="input row nowrap" htmlFor="psearch" style={{ minHeight: 50, gap: 10 }}>
        <Search size={20} color="var(--grey)" aria-hidden />
        <input id="psearch" value={q} onChange={(e) => setQ(e.target.value)} placeholder={L('പഞ്ചായത്ത് / ജില്ല തിരയുക', 'Search panchayat / district')}
          style={{ border: 0, outline: 0, flex: 1, minWidth: 0, fontSize: 16, background: 'transparent' }} />
      </label>
      {districts.length > 1 && (
        <div className="chips">
          <button className={'chip' + (district === 'all' ? ' on' : '')} onClick={() => setDistrict('all')}>{L('എല്ലാ ജില്ലയും', 'All districts')}</button>
          {districts.map((d) => <button key={d} className={'chip' + (district === d ? ' on' : '')} onClick={() => setDistrict(d)}>{d}</button>)}
        </div>
      )}
      {list.map((p) => (
        <button key={p.key} className="card tap" disabled={p.main.status !== 'live'} onClick={() => onPick(p)}
          style={{ outline: selected === p.key ? '2px solid var(--green)' : undefined, opacity: p.main.status === 'live' ? 1 : 0.6 }}>
          <MapPin size={22} color={p.main.status === 'live' ? 'var(--green)' : 'var(--grey)'} aria-hidden />
          <span className="stack grow" style={{ textAlign: 'left' }}>
            <b>{panchayatName(p.main, lang)}</b>
            <span className="muted small">{p.district}{p.main.wards?.length ? ` · ${p.main.wards.length} ${L('വാർഡുകൾ', 'wards')}` : ''}</span>
          </span>
          {p.main.status === 'live' ? <span className="badge">{L('ലഭ്യം', 'Live')}</span> : <span className="badge grey">{L('ഉടൻ വരുന്നു', 'Coming soon')}</span>}
        </button>
      ))}
      {list.length === 0 && <p className="muted center">{L('ഒന്നും കിട്ടിയില്ല.', 'Nothing found.')}</p>}
    </>
  );
}

/** Browse any panchayat (does not change the person's home panchayat). */
export function PanchayatPicker() {
  const { view, homeVillage, setView, lang, L } = useApp();
  const nav = useNavigate();
  return (
    <Screen title={L('പഞ്ചായത്ത് തിരഞ്ഞെടുക്കുക', 'Choose a panchayat')}>
      <p className="muted" style={{ fontSize: 15 }}>{L('ഏത് പഞ്ചായത്തിലെയും പണിക്കാരെയും ഡ്രൈവർമാരെയും വാർത്തകളും കാണാം. നിങ്ങളുടെ സ്വന്തം പഞ്ചായത്ത് മാറില്ല.', "See workers, drivers and news of any panchayat. Your own home panchayat doesn't change.")}</p>
      {homeVillage && (
        <button className="card tap" onClick={() => { setView(null); nav('/'); }}>
          <HomeIcon size={22} color="var(--green)" aria-hidden />
          <span className="stack grow" style={{ textAlign: 'left' }}><span className="muted small">{L('എന്റെ പഞ്ചായത്ത്', 'My home panchayat')}</span><b>{panchayatName(homeVillage, lang)}</b></span>
        </button>
      )}
      <PanchayatChooser selected={view?.key} onPick={(p) => { setView(p.key); nav('/'); }} />
      <Link to="/profile/village" className="link" style={{ alignSelf: 'center' }}>{L('എന്റെ സ്വന്തം പഞ്ചായത്ത് മാറ്റാൻ →', 'Change my home panchayat →')}</Link>
    </Screen>
  );
}

/** Everyone who works in the panchayat being viewed, grouped by work; ward filter when wards are known. */
export function PanchayatPeople() {
  const { api, village, viewIds, lang, L, pair } = useApp();
  const [ward, setWard] = useState('');
  const cats = [...WORK_CATS, ...VEHICLE_CATS, ...SHOP_CATS] as Category[];
  const [all] = useLoad(async () => {
    return api.listApprovedProviders(null, viewIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewIds.join(',')]);
  const rows = (all ?? []).filter((p) => !ward || p.ward === ward);
  const byCat = cats.map((c) => [c, rows.filter((p) => p.category === c).sort((a, b) => Number(isFree(b)) - Number(isFree(a)))] as [Category, Provider[]]).filter(([, l]) => l.length);
  const wards = sortedWards(village, lang);

  return (
    <Screen title={village ? `${panchayatName(village, lang)}` : L('ആളുകൾ', 'People')} nav>
      <p className="muted">{L('ഈ പഞ്ചായത്തിലെ എല്ലാ പണിക്കാരും ഡ്രൈവർമാരും കടകളും. ആർക്കും നേരിട്ട് വിളിക്കാം.', 'All workers, drivers and shops in this panchayat. Anyone can call them directly.')}</p>
      {wards.length > 0 && (
        <select className="input" aria-label={L('വാർഡ്', 'Ward')} value={ward} onChange={(e) => setWard(e.target.value)}>
          <option value="">{L('എല്ലാ വാർഡും', 'All wards')}</option>
          {wards.map((w) => <option key={w.no} value={String(w.no)}>{lang === 'ml' ? w.name : w.nameEn}</option>)}
        </select>
      )}
      {!all && <Loading />}
      {byCat.map(([c, list]) => (
        <div key={c} className="col" style={{ gap: 8 }}>
          <p className="section row" style={{ gap: 8 }}><CatIcon cat={c} size={20} />{pair(CAT_LABEL[c])} ({list.length})</p>
          {list.map((p) => (
            <Link key={p.uid} to={`/provider/${p.uid}`} className="card">
              <Avatar name={p.name} />
              <span className="stack grow">
                <b>{p.name}</b>
                <span className="muted small">
                  <span className={'dot' + (isFree(p) ? '' : ' off')} /> {isFree(p) ? L('ഇപ്പോൾ ഫ്രീ', 'Free now') : L('തിരക്കിലാണ്', 'Busy')}
                  {p.category === 'other' && p.jobTitle ? ` · ${p.jobTitle}` : ''}{p.ward ? ` · ${wardLabel(village, p.ward, lang)}` : ''}
                </span>
              </span>
              <CallButton phone={p.phone} />
            </Link>
          ))}
        </div>
      ))}
      {all && byCat.length === 0 && (
        <Empty icon={<Users size={40} />} text={L('ഈ പഞ്ചായത്തിൽ ഇതുവരെ ആരും ചേർന്നിട്ടില്ല. പണിക്കാരോട് ഗ്രാമസേവയിൽ ചേരാൻ പറയൂ.', 'No one has joined in this panchayat yet. Ask workers to join Gramaseva.')} />
      )}
    </Screen>
  );
}

/** Ward list with the elected members. */
export function WardList() {
  const { village, lang, L } = useApp();
  const wards = sortedWards(village, lang);
  const [sel, setSel] = useState<number | null>(null);
  const area = village ? `${village.nameEn || village.name}, ${village.district}, Kerala` : '';
  const wardQ = (w: { nameEn: string }) => `${w.nameEn}, ${area}`;
  const cur = wards.find((w) => w.no === sel);
  const q = cur ? wardQ(cur) : village ? `${panchayatName(village, 'en')}, ${village.district}, Kerala` : '';
  return (
    <Screen title={L('വാർഡുകളും മെമ്പർമാരും', 'Wards and members')}>
      {village && <p className="muted">{panchayatName(village, lang)} · {village.district}</p>}
      {village && (
        <div className="stack" style={{ gap: 6 }}>
          <iframe key={q} title="map" src={mapsEmbed(q)} loading="lazy" referrerPolicy="no-referrer-when-downgrade"
            style={{ width: '100%', height: 250, border: 0, borderRadius: 14, background: 'var(--green-soft)' }} />
          <a className="link small" href={mapsLink(q)} target="_blank" rel="noreferrer">
            <MapPin size={14} /> {L('Google Maps-ൽ തുറക്കുക', 'Open in Google Maps')} · {cur ? (lang === 'ml' ? cur.name : cur.nameEn) : panchayatName(village, lang)}
          </a>
        </div>
      )}
      {wards.map((w) => (
        <div key={w.no} className="card" onClick={() => setSel(w.no)} style={{ cursor: 'pointer', outline: sel === w.no ? '2px solid var(--green)' : undefined }}>
          <span className="avatar" style={{ background: 'var(--green-soft)', color: 'var(--green-dark)', fontWeight: 700 }}>{(lang === 'ml' ? w.name : w.nameEn).slice(0, 1)}</span>
          <span className="stack grow">
            <b>{lang === 'ml' ? w.name : w.nameEn}</b>
            <span className="muted small">{w.member}{w.role !== 'Member' ? ` · ${roleLabel(w.role, lang)}` : ''}</span>
          </span>
          <MapPin size={20} color="var(--green)" aria-label={L('മാപ്പിൽ കാണുക', 'Show on map')} />
        </div>
      ))}
      {wards.length === 0 && <Empty text={L('ഈ പഞ്ചായത്തിന്റെ വാർഡ് ലിസ്റ്റ് ഇതുവരെ ചേർത്തിട്ടില്ല.', "This panchayat's ward list hasn't been added yet.")} />}
    </Screen>
  );
}
