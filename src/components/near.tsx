// "Near me" (by the person's PIN code) and order-review stars, shared by the shop, market and delivery lists.
import { useApp } from '../lib/app';
import { myPoint } from '../lib/pincode';
import { statAvg, type RatingStat } from '../types';
import { StarRow } from './ui';

/** My PIN code and the point distances are measured from. */
export function useNear() {
  const { profile, homeVillage } = useApp();
  return { pin: profile?.pincode, point: myPoint(profile, homeVillage) };
}

/** Chip: show only what is in my PIN code. */
export function PinOnlyChip({ on, set }: { on: boolean; set: (v: boolean) => void }) {
  const { L } = useApp();
  const { pin } = useNear();
  if (!pin) return null;
  return (
    <button className={'chip' + (on ? ' on' : '')} onClick={() => set(!on)} aria-pressed={on}>
      📍 {L(`എന്റെ പിൻകോഡ് മാത്രം (${pin})`, `My PIN code only (${pin})`)}
    </button>
  );
}

/** "Your PIN code" or "2.4 km" next to an item. */
export function NearTag({ same, d }: { same: boolean; d: number | null }) {
  const { L } = useApp();
  if (same) return <span className="badge">📍 {L('നിങ്ങളുടെ പിൻകോഡ്', 'Your PIN code')}</span>;
  if (d == null) return null;
  return <span className="muted small num">📍 {d} km</span>;
}

/** Average stars from order reviews (nothing when there are none yet). */
export function StatStars({ s }: { s?: RatingStat }) {
  return <StarRow value={statAvg(s)} count={s?.count} />;
}
