import { Link, useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import { BadgeCheck, Clock, MapPin, Store } from 'lucide-react';
import { useApp, useLoad } from '../lib/app';
import { CallButton, CatIcon, Empty, LoadError, Loading, Screen } from '../components/ui';
import { panchayatName, sortedWards, wardLabel } from '../lib/panchayat';
import { CAT_LABEL, jobName, mapsLink } from '../lib/util';
import { isPlayApp } from '../lib/store';
import { usePay } from './Market';
import { SHOP_CATS, isShop, type Category } from '../types';

/** All shops / businesses of the panchayat being viewed, with category and ward filters. */
export function Shops() {
  const { cat } = useParams();
  const nav = useNavigate();
  const { api, village, viewIds, villages, lang, L, pair } = useApp();
  const [ward, setWard] = useState('');
  const pay = usePay();
  const [all, reload, err] = useLoad(async () => (await api.listApprovedProviders(null, viewIds)).filter((p) => isShop(p.category)), [viewIds.join(',')]);
  const sel = (SHOP_CATS as string[]).includes(cat ?? '') ? (cat as Category) : null;
  const rows = (all ?? []).filter((p) => (!sel || p.category === sel) && (!ward || p.ward === ward));
  const count = (c: Category) => (all ?? []).filter((p) => p.category === c).length;
  const wards = sortedWards(village, lang);

  return (
    <Screen title={L('കടകൾ / സ്ഥാപനങ്ങൾ', 'Shops & businesses')} nav
      right={<Link to="/work/register" className="iconbtn" aria-label={L('എന്റെ കട ചേർക്കുക', 'Add my shop')}><Store size={22} /></Link>}>
      {village && <p className="muted small">{panchayatName(village, lang)} · <Link className="link" to="/panchayats">{L('മാറ്റുക', 'Change')}</Link></p>}
      <div className="chips">
        <button className={'chip' + (!sel ? ' on' : '')} onClick={() => nav('/shops', { replace: true })}>{L('എല്ലാം', 'All')}{all ? ` (${all.length})` : ''}</button>
        {SHOP_CATS.map((c) => (
          <button key={c} className={'chip' + (sel === c ? ' on' : '')} onClick={() => nav(`/shops/${c}`, { replace: true })}>{pair(CAT_LABEL[c])}{all && count(c) ? ` (${count(c)})` : ''}</button>
        ))}
      </div>
      {wards.length > 0 && (
        <select className="input" aria-label={L('വാർഡ്', 'Ward')} value={ward} onChange={(e) => setWard(e.target.value)}>
          <option value="">{L('എല്ലാ വാർഡും', 'All wards')}</option>
          {wards.map((w) => <option key={w.no} value={String(w.no)}>{lang === 'ml' ? w.name : w.nameEn}</option>)}
        </select>
      )}
      {err && <LoadError retry={reload} />}
      {!all && !err && <Loading />}
      {rows.map((p) => (
        <Link key={p.uid} to={`/provider/${p.uid}`} className="card" style={{ alignItems: 'flex-start' }}>
          <CatIcon cat={p.category} size={22} />
          <span className="stack grow" style={{ minWidth: 0 }}>
            <span className="row" style={{ gap: 6 }}>
              <b style={{ fontSize: 16 }}>{p.shopName || p.name}</b>
              {p.verified && <span className="badge"><BadgeCheck size={13} aria-hidden />Verified</span>}
            </span>
            <span className="muted small">{jobName(p, pair)}{p.ward ? ` · ${wardLabel(villages.find((v) => v.id === p.villageId), p.ward, lang)}` : ''}</span>
            {p.address && <span className="small"><MapPin size={12} aria-hidden /> {p.address}</span>}
            {p.openHours && <span className="small muted"><Clock size={12} aria-hidden /> {p.openHours}</span>}
            <a className="link small" href={mapsLink(`${p.shopName ?? ''} ${p.address ?? ''}, ${village ? (village.nameEn || village.name) : ''}, Kerala`)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>{L('മാപ്പിൽ', 'Map')}</a>
          </span>
          <CallButton phone={p.phone} />
        </Link>
      ))}
      <Link to="/ads/new" className="notice" style={{ textDecoration: 'none' }}>📣 {isPlayApp() ? L('കടയുടെ പരസ്യം എല്ലാവരുടെയും home screen-ൽ. ഇവിടെ അമർത്തുക.', "Advertise your shop on everyone's home screen. Tap here.") : L(`കടയുടെ പരസ്യം എല്ലാവരുടെയും home screen-ൽ — ആഴ്ചയിൽ ₹${pay.adFee}. ഇവിടെ അമർത്തുക.`, `Advertise your shop on everyone's home screen — ₹${pay.adFee} a week. Tap here.`)}</Link>
      {all && rows.length === 0 && (
        <Empty icon={<Store size={28} />} text={L('ഈ വിഭാഗത്തിൽ ഇതുവരെ കടകൾ ചേർന്നിട്ടില്ല. നിങ്ങൾക്ക് കടയുണ്ടെങ്കിൽ ചേർക്കൂ.', 'No shops listed here yet. If you own a shop, add it.')}>
          <Link to="/work/register" className="btn">{L('എന്റെ കട ചേർക്കുക', 'Add my shop')}</Link>
        </Empty>
      )}
    </Screen>
  );
}
