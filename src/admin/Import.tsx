import { useState } from 'react';
import { Download, FileSpreadsheet, Upload } from 'lucide-react';
import { useApp } from '../lib/app';
import { buildRecords, findVillage, newVillage, parseWorkbook, type Parsed, type SheetIn } from '../lib/importExcel';
import type { Village } from '../types';

/** Super admin: add a whole panchayat's data (wards, workers, drivers, shops, schools, hospitals, offices, ASHA) from the Excel template. */
export function ImportAdmin({ selectedVillageId }: { selectedVillageId: string | null }) {
  const { api, villages, refresh, L, lang, toast, profile } = useApp();
  const [file, setFile] = useState('');
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [target, setTarget] = useState<string>(''); // village id, or 'new'
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [done, setDone] = useState('');
  const vname = (v: Village) => (lang === 'ml' ? `${v.name} — ${v.district}` : `${v.nameEn} — ${v.district}`);

  async function pick(f: File | undefined) {
    if (!f) return;
    setFile(f.name); setParsed(null); setDone('');
    try {
      const { default: readXlsx } = await import('read-excel-file/browser');
      const sheets = (await readXlsx(f)) as unknown as SheetIn[];
      const p = parseWorkbook(sheets);
      setParsed(p);
      const match = findVillage(p.panchayat, villages);
      setTarget(match?.id ?? (p.panchayat ? 'new' : selectedVillageId ?? villages[0]?.id ?? ''));
    } catch (e) {
      console.error(e);
      toast(L('Excel file വായിക്കാൻ പറ്റിയില്ല (.xlsx ആണോ?)', "Couldn't read the Excel file (is it .xlsx?)"));
    }
  }

  const isNew = target === 'new';
  const p = parsed?.panchayat ?? null;
  const newProblem = isNew && (!p || !(p.name || p.nameEn) || !p.district || p.lat == null || p.lng == null)
    ? L('പുതിയ പഞ്ചായത്തിന് "1 Panchayat" sheet-ൽ ജില്ല, പേര്, Latitude, Longitude വേണം.', 'A new panchayat needs district, name, latitude and longitude in the "1 Panchayat" sheet.')
    : '';
  const total = parsed ? parsed.providers.length + parsed.contacts.length : 0;

  async function run() {
    if (!parsed || !profile || busy) return;
    setBusy(true); setDone('');
    try {
      let village: Village;
      let write: Village | null = null;
      if (isNew) {
        village = newVillage(parsed.panchayat!, parsed.wards);
        write = village;
      } else {
        const v = villages.find((x) => x.id === target);
        if (!v) throw new Error('no village');
        village = parsed.wards.length ? { ...v, wards: parsed.wards } : v;
        if (parsed.wards.length || (p?.phone && !v.panchayatPhone)) write = { ...village, ...(p?.phone && !v.panchayatPhone ? { panchayatPhone: p.phone } : {}) };
      }
      const existing = isNew ? [] : await api.listVillageProviders(village.id);
      const rec = buildRecords(parsed, village, existing, profile.uid);
      setProgress('0 / ' + total);
      await api.bulkImport(write, rec.providers, rec.contacts, (d, t) => setProgress(`${d} / ${t}`));
      await refresh();
      setDone(L(`ചേർത്തു: ${rec.providers.length} പണിക്കാർ / വാഹനങ്ങൾ / കടകൾ, ${rec.contacts.length} സ്ഥാപനങ്ങൾ / ആശാ വർക്കർ${parsed.wards.length ? `, ${parsed.wards.length} വാർഡുകൾ` : ''}.`,
        `Added: ${rec.providers.length} workers / vehicles / shops, ${rec.contacts.length} directory entries${parsed.wards.length ? `, ${parsed.wards.length} wards` : ''}.`)
        + (rec.warnings.length ? ' ' + L(`${rec.warnings.length} വാർഡ് മുന്നറിയിപ്പുകൾ (console).`, `${rec.warnings.length} ward warnings (see console).`) : ''));
      if (rec.warnings.length) console.warn(rec.warnings);
      toast(L('Import കഴിഞ്ഞു', 'Import finished'));
    } catch (e) {
      console.error(e);
      toast(L('Import പൂർത്തിയായില്ല. വീണ്ടും ശ്രമിക്കുക (വീണ്ടും ചെയ്താൽ duplicate ആകില്ല).', "Import didn't finish. Try again (re-importing doesn't duplicate)."));
    } finally { setBusy(false); setProgress(''); }
  }

  const count = (k: string) => parsed?.providers.filter((x) => x.kind === k).length ?? 0;
  const ck = (k: string) => parsed?.contacts.filter((x) => x.kind === k).length ?? 0;

  return (
    <>
      <h1 className="h1">{L('Excel വഴി data ചേർക്കുക', 'Import data from Excel')}</h1>
      <p className="muted">{L('ഒരു പഞ്ചായത്തിലെ വാർഡുകൾ, പണിക്കാർ, ഡ്രൈവർമാർ, കടകൾ, സ്കൂൾ / കോളേജ്, ആശുപത്രി, ഓഫീസ്, ആശാ വർക്കർ എന്നിവ ഒറ്റയടിക്ക് ചേർക്കാം. ഒരേ file വീണ്ടും upload ചെയ്താൽ പഴയത് update ആകും, duplicate ആകില്ല.',
        "Add a panchayat's wards, workers, drivers, shops, schools / colleges, hospitals, offices and ASHA workers in one go. Uploading the same file again updates entries instead of duplicating them.")}</p>
      <div className="panels">
        <div className="card stack-lg" style={{ display: 'block' }}>
          <h3>{L('1. Template download ചെയ്യുക', '1. Download the template')}</h3>
          <p className="muted small">{L('പഞ്ചായത്ത് ഓഫീസിനോ വാർഡ് മെമ്പർമാർക്കോ ഈ file share ചെയ്യുക. ഓരോ sheet-ലും വിവരങ്ങൾ നിറച്ച് തിരിച്ചു വാങ്ങുക.', 'Share this file with the panchayat office or ward members. They fill each sheet and send it back.')}</p>
          <a className="btn outline" href="gramaseva-data-template.xlsx" download><Download size={18} aria-hidden /> {L('ശൂന്യ template', 'Blank template')}</a>
          <div className="spacer" />
          <a className="btn outline" href="gramaseva-data-thakazhy.xlsx" download><Download size={18} aria-hidden /> {L('തകഴി template (വാർഡുകൾ നിറച്ചത്)', 'Thakazhy template (wards filled)')}</a>
        </div>
        <div className="card stack-lg" style={{ display: 'block' }}>
          <h3>{L('2. നിറച്ച Excel upload ചെയ്യുക', '2. Upload the filled Excel')}</h3>
          <label className="btn">
            <Upload size={18} aria-hidden /> {L('.xlsx file തിരഞ്ഞെടുക്കുക', 'Choose .xlsx file')}
            <input type="file" accept=".xlsx" hidden onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
          {file && <p className="small"><FileSpreadsheet size={16} aria-hidden /> {file}</p>}
        </div>
      </div>

      {parsed && (
        <div className="card" style={{ display: 'block', marginTop: 16 }}>
          <h3>{L('3. പരിശോധിച്ച് ചേർക്കുക', '3. Check and import')}</h3>
          <table className="small" style={{ borderCollapse: 'collapse', margin: '8px 0' }}>
            <tbody>
              {([
                [L('വാർഡുകൾ', 'Wards'), parsed.wards.length], [L('പണിക്കാർ', 'Workers'), count('worker')], [L('വാഹനങ്ങൾ / ഡ്രൈവർ', 'Drivers'), count('driver')],
                [L('കടകൾ', 'Shops'), count('shop')], [L('സ്കൂൾ / കോളേജ്', 'Schools / colleges'), ck('school')], [L('ആശുപത്രി', 'Hospitals'), ck('hospital')],
                [L('ഓഫീസുകൾ', 'Offices'), ck('office')], [L('ആശാ വർക്കർ', 'ASHA workers'), ck('asha')],
              ] as [string, number][]).map(([k, n]) => <tr key={k}><td style={{ padding: '2px 16px 2px 0' }}>{k}</td><td><b className="num">{n}</b></td></tr>)}
            </tbody>
          </table>

          <label htmlFor="imp-target"><b>{L('ഏത് പഞ്ചായത്തിലേക്ക്?', 'Into which panchayat?')}</b></label>
          <select id="imp-target" className="input" value={target} onChange={(e) => setTarget(e.target.value)}>
            {p && <option value="new">{L('പുതിയ പഞ്ചായത്ത്: ', 'New panchayat: ')}{p.name || p.nameEn} ({p.district})</option>}
            {villages.map((v) => <option key={v.id} value={v.id}>{vname(v)}</option>)}
          </select>
          {parsed.wards.length > 0 && !isNew && <div className="notice warn">{L('ഈ file-ലെ വാർഡ് list പഞ്ചായത്തിന്റെ ഇപ്പോഴത്തെ വാർഡ് list-ന് പകരം വരും.', "This file's ward list will replace the panchayat's current ward list.")}</div>}
          {newProblem && <div className="notice bad">{newProblem}</div>}

          {parsed.errors.length > 0 && (
            <div className="notice bad" style={{ display: 'block' }}>
              <b>{L(`${parsed.errors.length} വരികൾ ചേർക്കില്ല (തിരുത്തി വീണ്ടും upload ചെയ്യാം):`, `${parsed.errors.length} rows will be skipped (fix and upload again):`)}</b>
              <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                {parsed.errors.slice(0, 30).map((e, i) => <li key={i}>{e.sheet} — {L('വരി', 'row')} {e.row}: {e.msg}</li>)}
                {parsed.errors.length > 30 && <li>…</li>}
              </ul>
            </div>
          )}
          {parsed.warnings.length > 0 && <div className="notice warn">{parsed.warnings.slice(0, 5).map((w) => w.msg).join(' · ')}</div>}

          <button className="btn block" disabled={busy || !!newProblem || !target || (total === 0 && !parsed.wards.length)} onClick={run}>
            {busy ? L(`ചേർക്കുന്നു… ${progress}`, `Importing… ${progress}`) : L(`${total} എണ്ണം ചേർക്കുക`, `Import ${total} entries`)}
          </button>
          {done && <div className="notice">{done}</div>}
          <p className="muted small">{L('Excel വഴി ചേർത്ത പണിക്കാർക്ക് app account ഇല്ല, അതുകൊണ്ട് "Call" മാത്രം കാണിക്കും (Book ഇല്ല). അവർ സ്വന്തമായി register ചെയ്താൽ booking കിട്ടും.',
            'People added from Excel have no app account, so only "Call" is shown (no booking). Once they register themselves, they can get bookings.')}</p>
        </div>
      )}
    </>
  );
}
