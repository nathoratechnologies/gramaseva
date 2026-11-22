import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Plus, Share2 } from 'lucide-react';
import { useApp, useLoad } from '../lib/app';
import { Empty, LoadError, Loading, NEWS_ICON, Screen } from '../components/ui';
import { NEWS_LABEL, timeAgo } from '../lib/util';
import { NEWS_CATS, type NewsCat } from '../types';
import { inWard, listPanchayatNews, panchayatName, sortedWards, wardLabel } from '../lib/panchayat';
import { useAdminHere } from './Local';

export function NewsList() {
  const { api, profile, village, viewIds, isHomeView, L, lang, pair } = useApp();
  const [cat, setCat] = useState<NewsCat | 'all'>('all');
  const [ward, setWard] = useState(isHomeView ? profile?.ward ?? '' : '');
  const [news, reload, err] = useLoad(() => listPanchayatNews(api, viewIds), [viewIds.join(',')]);
  const list = (news ?? []).filter((n) => (cat === 'all' || n.category === cat) && inWard(n, ward));
  const wards = sortedWards(village, lang);

  return (
    <Screen title={L('ഗ്രാമവാർത്ത', 'Village news')} back={false} nav
      right={<Link to="/news/suggest" className="iconbtn" aria-label={L('വാർത്ത നിർദ്ദേശിക്കുക', 'Suggest news')}><Plus size={24} /></Link>}>
      {village && <p className="muted small">{panchayatName(village, lang)} · <Link className="link" to="/panchayats">{L('മാറ്റുക', 'Change')}</Link></p>}
      {wards.length > 0 && (
        <select className="input" aria-label={L('വാർഡ്', 'Ward')} value={ward} onChange={(e) => setWard(e.target.value)}>
          <option value="">{L('എല്ലാ വാർഡും (പഞ്ചായത്ത് മുഴുവൻ)', 'All wards (whole panchayat)')}</option>
          {wards.map((w) => <option key={w.no} value={String(w.no)}>{lang === 'ml' ? w.name : w.nameEn}</option>)}
        </select>
      )}
      <div className="chips" role="tablist">
        <button className={'chip' + (cat === 'all' ? ' on' : '')} onClick={() => setCat('all')}>{L('എല്ലാം', 'All')}</button>
        {NEWS_CATS.map((c) => <button key={c} className={'chip' + (cat === c ? ' on' : '')} onClick={() => setCat(c)}>{pair(NEWS_LABEL[c])}</button>)}
      </div>
      {err && <LoadError retry={reload} />}
      {!news && !err && <Loading />}
      {list.map((n, i) => {
        const { Icon, bg } = NEWS_ICON[n.category];
        if (i === 0 && cat === 'all') {
          return (
            <Link key={n.id} to={`/news/${n.id}`} className="card col" style={{ padding: 0, overflow: 'hidden', gap: 0 }}>
              <div className="newsimg" style={{ background: bg }}><Icon size={52} aria-hidden /></div>
              <div className="stack" style={{ padding: 14, gap: 6 }}>
                <span className="row"><span className="badge">{pair(NEWS_LABEL[n.category])}</span>{n.ward && <span className="badge grey">{wardLabel(village, n.ward, lang)}</span>}{n.important && <span className="badge bad">{L('പ്രധാനം', 'Important')}</span>}</span>
                <b style={{ fontSize: 18 }}>{n.title}</b>
                <span className="muted small">{n.postedByName} · {timeAgo(n.createdAt, lang)}</span>
              </div>
            </Link>
          );
        }
        return (
          <Link key={n.id} to={`/news/${n.id}`} className="card">
            <span style={{ width: 44, height: 44, borderRadius: 12, background: bg, color: '#fff', display: 'grid', placeItems: 'center', flex: 'none' }}><Icon size={22} aria-hidden /></span>
            <span className="stack grow">
              <span className="row"><span className="badge">{pair(NEWS_LABEL[n.category])}</span>{n.ward && <span className="badge grey">{wardLabel(village, n.ward, lang)}</span>}{n.important && <span className="badge bad">{L('പ്രധാനം', 'Important')}</span>}</span>
              <b>{n.title}</b>
              <span className="muted small">{timeAgo(n.createdAt, lang)}</span>
            </span>
          </Link>
        );
      })}
      {news && list.length === 0 && <Empty text={L('ഈ വിഭാഗത്തിൽ വാർത്തകളില്ല.', 'No news in this section.')} />}
    </Screen>
  );
}

export function NewsDetail() {
  const { id = '' } = useParams();
  const { api, L, lang, pair, toast } = useApp();
  const [n] = useLoad(() => api.getNews(id), [id]);
  if (n === undefined) return <Screen title=""><Loading /></Screen>;
  if (n === null) return <Screen title=""><Empty text={L('ഈ വാർത്ത കണ്ടെത്താനായില്ല.', 'This news item was not found.')} /></Screen>;
  const { Icon, bg } = NEWS_ICON[n.category];
  const text = `${n.title}\n\n${n.body}\n\n— ഗ്രാമസേവ`;

  async function share() {
    try {
      if (navigator.share) await navigator.share({ title: n!.title, text });
      else { await navigator.clipboard.writeText(text); toast(L('Copy ചെയ്തു', 'Copied')); }
    } catch { /* cancelled */ }
  }

  return (
    <Screen title="" right={<button className="iconbtn" onClick={share} aria-label="Share"><Share2 size={22} /></button>}>
      <div className="newsimg" style={{ background: bg, margin: '0 -16px', height: 180 }}><Icon size={72} aria-hidden /></div>
      <span className="row"><span className="badge">{pair(NEWS_LABEL[n.category])}</span>{n.important && <span className="badge bad">{L('പ്രധാനം', 'Important')}</span>}</span>
      <h1 className="h2">{n.title}</h1>
      <p className="muted">{n.postedByName} · {timeAgo(n.createdAt, lang)}</p>
      <p style={{ fontSize: 17, lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{n.body}</p>
      <div className="spacer" />
      <a className="btn block wa" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">
        {L('WhatsApp-ൽ share ചെയ്യുക', 'Share on WhatsApp')}
      </a>
    </Screen>
  );
}

export function SuggestNews() {
  const { api, profile, village, L, lang, pair, toast } = useApp();
  const nav = useNavigate();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [cat, setCat] = useState<NewsCat>('panchayat');
  const [ward, setWard] = useState(profile?.ward ?? '');
  const [busy, setBusy] = useState(false);
  const wards = sortedWards(village, lang);
  // A ward member / president of this panchayat publishes directly, under the village record they moderate.
  const adminVid = useAdminHere();
  const isAdmin = !!adminVid;

  async function submit() {
    if (!profile || !village) return;
    setBusy(true);
    try {
      await api.createNews({
        villageId: adminVid ?? village.id, title: title.trim(), body: body.trim(), category: cat, ...(ward ? { ward } : {}), important: false,
        status: isAdmin ? 'published' : 'pending', postedBy: profile.uid, postedByName: profile.name, createdAt: Date.now(),
      });
      toast(isAdmin ? L('വാർത്ത പ്രസിദ്ധീകരിച്ചു', 'News published') : L('അയച്ചു. Coordinator approve ചെയ്താൽ എല്ലാവർക്കും കാണാം.', 'Sent. Everyone will see it after the coordinator approves.'));
      nav('/news');
    } catch {
      toast(L('അയയ്ക്കാൻ പറ്റിയില്ല', "Couldn't send"));
    } finally { setBusy(false); }
  }

  return (
    <Screen title={L('വാർത്ത നിർദ്ദേശിക്കുക', 'Suggest news')}>
      {!isAdmin && <div className="notice">{L('നിങ്ങൾ അയയ്ക്കുന്ന വാർത്ത coordinator പരിശോധിച്ച ശേഷമേ എല്ലാവർക്കും കാണിക്കൂ.', 'Your news is shown to everyone only after the coordinator checks it.')}</div>}
      <div className="chips">{NEWS_CATS.map((c) => <button key={c} className={'chip' + (cat === c ? ' on' : '')} onClick={() => setCat(c)}>{pair(NEWS_LABEL[c])}</button>)}</div>
      {wards.length > 0 && (
        <div className="field"><label htmlFor="nw">{L('ഏത് വാർഡിന്', 'For which ward')}</label>
          <select id="nw" className="input" value={ward} onChange={(e) => setWard(e.target.value)}>
            <option value="">{L('പഞ്ചായത്ത് മുഴുവൻ', 'Whole panchayat')}</option>
            {wards.map((w) => <option key={w.no} value={String(w.no)}>{lang === 'ml' ? w.name : w.nameEn}</option>)}
          </select>
        </div>
      )}
      <div className="field"><label htmlFor="nt">{L('തലക്കെട്ട്', 'Headline')}</label><input id="nt" className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} /></div>
      <div className="field"><label htmlFor="nb">{L('വിവരം', 'Details')}</label><textarea id="nb" className="input" rows={6} value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} /></div>
      <div className="spacer" />
      {!village && (
        <div className="notice warn">
          <span>{L('വാർത്ത അയയ്ക്കാൻ ആദ്യം നിങ്ങളുടെ വില്ലേജ് തിരഞ്ഞെടുക്കുക. ', 'Choose your village first to send news. ')}<Link className="link" to="/profile/village">{L('വില്ലേജ് →', 'Village →')}</Link></span>
        </div>
      )}
      {village && (title.trim().length < 3 || body.trim().length < 3) && (
        <p className="muted small center">{L('തലക്കെട്ടും വിവരവും കുറഞ്ഞത് 3 അക്ഷരം വീതം വേണം.', 'Headline and details need at least 3 letters each.')}</p>
      )}
      <button className="btn block" disabled={busy || !village || title.trim().length < 3 || body.trim().length < 3} onClick={submit}>{L('അയയ്ക്കുക', 'Send')}</button>
    </Screen>
  );
}
