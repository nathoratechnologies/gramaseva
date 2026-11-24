// The customer's home on a map: GPS for a start, then drag / tap the pin to the exact house.
import { useState } from 'react';
import { MapPin } from 'lucide-react';
import { useApp } from '../lib/app';
import { getPosition } from '../lib/geo';
import { myPoint } from '../lib/pincode';
import { PickMap } from './LazyMap';

type LL = { lat: number; lng: number };

export function HomeLocation({ loc, setLoc }: { loc: LL | null; setLoc: (p: LL) => void }) {
  const { profile, homeVillage, L, toast } = useApp();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  async function gps() {
    setBusy(true);
    try { setLoc(await getPosition()); setOpen(true); toast(L('Location ചേർത്തു. വീട് കൃത്യമല്ലെങ്കിൽ pin നീക്കുക.', 'Location added. Move the pin if it is not exactly your house.')); }
    catch { toast(L('Location കിട്ടിയില്ല. Phone-ലെ location ഓൺ ആക്കുക, അല്ലെങ്കിൽ map-ൽ തൊട്ട് വീട് കാണിക്കുക.', "Couldn't get location. Turn it on, or tap your house on the map.")); setOpen(true); }
    finally { setBusy(false); }
  }
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="row nowrap" style={{ gap: 8 }}>
        <button type="button" className="btn outline grow" disabled={busy} onClick={gps}>
          <MapPin size={16} aria-hidden /> {loc ? L('വീടിന്റെ location ഉണ്ട് ✓ (GPS വീണ്ടും)', 'Home location set ✓ (GPS again)') : L('📍 എന്റെ വീടിന്റെ location (GPS)', '📍 My home location (GPS)')}
        </button>
        <button type="button" className="btn outline" onClick={() => setOpen(!open)}>{open ? L('Map മറയ്ക്കുക', 'Hide map') : L('Map', 'Map')}</button>
      </div>
      {open && (<>
        <PickMap value={loc} center={myPoint(profile, homeVillage)} onChange={setLoc} />
        <span className="muted small">{L('Map-ൽ നിങ്ങളുടെ വീടിന് മുകളിൽ തൊടുക, അല്ലെങ്കിൽ 🏠 pin വലിച്ച് നീക്കുക. ഡെലിവറി ബോയ് ഇവിടേക്കാണ് വരിക.', 'Tap your house on the map or drag the 🏠 pin. The delivery person comes here.')}</span>
      </>)}
    </div>
  );
}
