// Reviews after an order: the customer rates the shop / seller and the delivery person.
import { useState } from 'react';
import { Star } from 'lucide-react';
import { useApp, useLoad } from '../lib/app';
import { timeAgo } from '../lib/util';
import type { Delivery, Enquiry, OrderReviewKind } from '../types';

/** The shop can be rated once the order is done or delivered; the delivery person once something was delivered. */
export const canRateShop = (e: Enquiry, d?: Delivery) => e.status === 'done' || d?.status === 'delivered' || (d?.deliveredCount ?? 0) > 0;
export const canRateDelivery = (d?: Delivery) => !!d && !!d.deliveryUid && (d.status === 'delivered' || d.deliveredCount > 0);
export const reviewId = (kind: OrderReviewKind, enquiryId: string) => `${kind}_${enquiryId}`;

function StarPicker({ value, set, size = 34 }: { value: number; set: (n: number) => void; size?: number }) {
  return (
    <span className="stars row nowrap" role="radiogroup" aria-label="stars" style={{ gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => set(n)} role="radio" aria-checked={value === n} aria-label={`${n}`} style={{ padding: 2 }}>
          <Star size={size} fill={n <= value ? '#f9a825' : 'none'} color={n <= value ? '#f9a825' : 'var(--line-strong)'} />
        </button>
      ))}
    </span>
  );
}

/** One rating box (shop or delivery person) for an order. */
function RateBox({ kind, e, targetUid, targetName, done, onDone }: { kind: OrderReviewKind; e: Enquiry; targetUid: string; targetName: string; done?: number; onDone: () => void }) {
  const { api, profile, L, toast } = useApp();
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  if (!profile) return null;
  const title = kind === 'shop'
    ? L(`${targetName} — കട / വിൽപ്പനക്കാരൻ എങ്ങനെ?`, `How was ${targetName} (shop / seller)?`)
    : L(`${targetName} — ഡെലിവറി എങ്ങനെ?`, `How was the delivery by ${targetName}?`);
  if (done) {
    return <div className="small" style={{ marginTop: 6 }}>✓ {kind === 'shop' ? L('കടയ്ക്ക്', 'Shop') : L('ഡെലിവറിക്ക്', 'Delivery')}: <b style={{ color: '#f9a825' }}>{'★'.repeat(done)}</b><span style={{ color: 'var(--line-strong)' }}>{'★'.repeat(5 - done)}</span> {L('നൽകി', 'given')}</div>;
  }
  async function save() {
    if (!profile || !stars || busy) return;
    setBusy(true);
    try {
      await api.addOrderReview({ kind, enquiryId: e.id, targetUid, targetName, fromUid: profile.uid, fromName: profile.name, stars, comment: comment.trim().slice(0, 300) });
      toast(L('നന്ദി! റിവ്യൂ സേവ് ചെയ്തു', 'Thanks! Review saved'));
      onDone();
    } catch (err) {
      console.error(err);
      toast(L('സേവ് ചെയ്യാൻ പറ്റിയില്ല', "Couldn't save"));
    } finally { setBusy(false); }
  }
  return (
    <div style={{ marginTop: 8, padding: 10, borderRadius: 12, background: '#fffbea', border: '1px solid #f5e3a3' }}>
      <b className="small">{title}</b>
      <StarPicker value={stars} set={setStars} />
      {stars > 0 && (<>
        <input className="input" style={{ minHeight: 40, marginTop: 6 }} maxLength={300} value={comment} onChange={(ev) => setComment(ev.target.value)}
          placeholder={L('അഭിപ്രായം (വേണമെങ്കിൽ)', 'Comment (optional)')} aria-label={L('അഭിപ്രായം', 'Comment')} />
        <button className="btn sm block" style={{ marginTop: 6 }} disabled={busy} onClick={save}>{busy ? L('സേവ് ചെയ്യുന്നു…', 'Saving…') : L('റിവ്യൂ നൽകുക', 'Submit review')}</button>
      </>)}
    </div>
  );
}

/** Customer side of an order: rate the shop and the delivery person when the order is finished. */
export function RateOrder({ e, d, given, onDone }: { e: Enquiry; d?: Delivery; given: Map<string, number>; onDone: () => void }) {
  const shop = canRateShop(e, d);
  const del = canRateDelivery(d);
  if (!shop && !del) return null;
  return (
    <>
      {shop && <RateBox kind="shop" e={e} targetUid={e.toUid} targetName={e.toName} done={given.get(reviewId('shop', e.id))} onDone={onDone} />}
      {del && d && <RateBox kind="delivery" e={e} targetUid={d.deliveryUid} targetName={d.deliveryName} done={given.get(reviewId('delivery', e.id))} onDone={onDone} />}
    </>
  );
}

/** Latest reviews of a shop / seller or delivery person. */
export function ReviewList({ kind, uid, max = 5 }: { kind: OrderReviewKind; uid: string; max?: number }) {
  const { api, lang, L } = useApp();
  const [list] = useLoad(() => api.listOrderReviews(kind, uid), [kind, uid]);
  if (!list) return null;
  if (!list.length) return <p className="muted small">{L('ഇതുവരെ റിവ്യൂകൾ ഇല്ല.', 'No reviews yet.')}</p>;
  return (
    <div className="stack" style={{ gap: 6, marginTop: 6 }}>
      {list.slice(0, max).map((r) => (
        <div key={r.id} className="card col" style={{ gap: 4 }}>
          <span className="row"><b style={{ color: '#f9a825' }}>{'★'.repeat(r.stars)}<span style={{ color: 'var(--line-strong)' }}>{'★'.repeat(5 - r.stars)}</span></b><b>{r.fromName}</b><span className="muted small">{timeAgo(r.createdAt, lang)}</span></span>
          {r.comment && <span className="muted">{r.comment}</span>}
        </div>
      ))}
    </div>
  );
}
