import { loginEmail } from '../lib/owner';
import { DISCLAIMER } from '../lib/store';
import { useEffect, useRef, useState } from 'react';
import { Check, Clock, Lock } from 'lucide-react';
import { useApp } from '../lib/app';
import { Logo, Screen } from '../components/ui';
import { DEMO_OTP } from '../data/demo';
import type { Place } from '../lib/geo';
import { panchayatKey, panchayatName, type Panchayat } from '../lib/panchayat';
import { PanchayatChooser } from './Panchayats';
import type { Consent, UserProfile, Village, Ward } from '../types';

export function Splash() {
  return (
    <div className="splash">
      <Logo size={112} inverse />
      <div style={{ fontSize: 34, fontWeight: 700 }}>ഗ്രാമസേവ</div>
      <div style={{ opacity: 0.9 }}>നാടിന്റെ എല്ലാ സേവനങ്ങളും ഒരിടത്ത്</div>
    </div>
  );
}

export function LanguageStep({ onDone }: { onDone: () => void }) {
  const { setLang } = useApp();
  const pick = (l: 'ml' | 'en') => { setLang(l); onDone(); };
  return (
    <main className="content" style={{ paddingTop: 48, gap: 20 }}>
      <Logo size={80} />
      <div className="stack">
        <h1 className="h1">ഭാഷ തിരഞ്ഞെടുക്കുക</h1>
        <p className="muted">Choose your language</p>
      </div>
      <button className="btn block lg" onClick={() => pick('ml')}>മലയാളം</button>
      <button className="btn block lg outline" onClick={() => pick('en')}>English</button>
    </main>
  );
}

export function LoginStep() {
  const { api, L, toast } = useApp();
  const [phone, setPhone] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [timer, setTimer] = useState(0);
  const [showPhone, setShowPhone] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const clean = phone.replace(/\D/g, '');
  const valid = /^[6-9]\d{9}$/.test(clean);

  useEffect(() => {
    if (timer <= 0) return;
    const t = setTimeout(() => setTimer(timer - 1), 1000);
    return () => clearTimeout(t);
  }, [timer]);

  async function send() {
    setBusy(true); setError('');
    try {
      await api.sendOtp('+91' + clean, 'recaptcha');
      setSent(true); setTimer(30);
      setTimeout(() => refs.current[0]?.focus(), 50);
    } catch (e) {
      console.error(e);
      const code = (e as { code?: string }).code ?? '';
      const msg: Record<string, [string, string]> = {
        'auth/too-many-requests': ['ഒരുപാട് തവണ ശ്രമിച്ചു. കുറച്ച് കഴിഞ്ഞ് വീണ്ടും ശ്രമിക്കുക.', 'Too many tries. Please wait a while and try again.'],
        'auth/quota-exceeded': ['ഇന്നത്തെ SMS പരിധി കഴിഞ്ഞു. നാളെ ശ്രമിക്കുക.', "Today's SMS limit is used up. Try again tomorrow."],
        'auth/invalid-phone-number': ['ഫോൺ നമ്പർ ശരിയല്ല.', 'That phone number is not valid.'],
        'auth/billing-not-enabled': ['SMS login ഇപ്പോൾ ലഭ്യമല്ല. മുകളിലെ Google ബട്ടൺ ഉപയോഗിക്കുക.', 'SMS login is not available yet. Please use the Google button above.'],
        'auth/operation-not-allowed': ['ഈ app-ൽ ഇപ്പോൾ SMS login ലഭ്യമല്ല. Admin-നെ അറിയിക്കുക.', 'SMS login is not available on this app right now. Please tell the admin.'],
      };
      const m = msg[code];
      setError(m ? L(m[0], m[1]) : L('OTP അയയ്ക്കാൻ പറ്റിയില്ല. നമ്പർ ശരിയാണോ എന്ന് നോക്കി വീണ്ടും ശ്രമിക്കുക.', "Couldn't send the OTP. Check the number and try again.") + (code ? ` (${code})` : ''));
    } finally { setBusy(false); }
  }

  async function verify(code: string) {
    setBusy(true); setError('');
    try {
      await api.verifyOtp(code);
      toast(L('ലോഗിൻ ചെയ്തു', 'Logged in'));
    } catch {
      setError(L('കോഡ് തെറ്റാണ്. SMS-ൽ വന്ന 6 അക്കം വീണ്ടും നൽകുക.', 'Wrong code. Enter the 6 digits from the SMS again.'));
      setDigits(['', '', '', '', '', '']);
      refs.current[0]?.focus();
    } finally { setBusy(false); }
  }

  async function google() {
    setBusy(true); setError('');
    try {
      await api.signInWithGoogle();
    } catch (e) {
      console.error(e);
      const code = (e as { code?: string }).code ?? '';
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        setError(L('Google login പൂർത്തിയായില്ല. വീണ്ടും ശ്രമിക്കുക.', "Google sign-in didn't finish. Please try again.") + (code ? ` (${code})` : ''));
      }
    } finally { setBusy(false); }
  }

  async function emailLogin() {
    setBusy(true); setError('');
    try {
      await api.signInWithEmail(loginEmail(email), password);
    } catch (e) {
      const code = (e as { code?: string }).code ?? '';
      setError(code === 'auth/too-many-requests'
        ? L('ഒരുപാട് തവണ തെറ്റി. കുറച്ച് കഴിഞ്ഞ് ശ്രമിക്കുക.', 'Too many wrong tries. Please wait a while.')
        : L('Email അല്ലെങ്കിൽ password തെറ്റാണ്.', 'Wrong email or password.'));
    } finally { setBusy(false); }
  }
  async function forgot() {
    if (!email.includes('@')) return setError(L('ആദ്യം email നൽകുക.', 'Enter your email first.'));
    try {
      await api.resetPassword(email);
      toast(L('Password മാറ്റാനുള്ള link email-ലേക്ക് അയച്ചു', 'Password reset link sent to your email'));
    } catch {
      setError(L('Link അയയ്ക്കാൻ പറ്റിയില്ല. Email ശരിയാണോ എന്ന് നോക്കുക.', "Couldn't send the link. Check the email."));
    }
  }

  function setDigit(i: number, v: string) {
    const only = v.replace(/\D/g, '');
    if (only.length > 1) { // pasted the whole code
      const arr = only.slice(0, 6).split('');
      const next = [...arr, ...Array(6 - arr.length).fill('')];
      setDigits(next);
      if (arr.length === 6) verify(arr.join(''));
      return;
    }
    const next = [...digits]; next[i] = only; setDigits(next);
    if (only && i < 5) refs.current[i + 1]?.focus();
    if (next.every(Boolean)) verify(next.join(''));
  }

  if (!sent) {
    return (
      <main className="content" style={{ paddingTop: 56, gap: 18 }}>
        <h1 className="h1">{L('സ്വാഗതം', 'Welcome')}</h1>
        <p className="muted" style={{ fontSize: 16 }}>{L('ഫോണിലെ Google account ഉപയോഗിച്ച് ഒറ്റ ടാപ്പിൽ തുടങ്ങാം.', 'Start with one tap using the Google account on your phone.')}</p>
        <button className="btn block lg outline" style={{ color: 'var(--ink)', borderColor: 'var(--line-strong)', gap: 12 }} disabled={busy} onClick={google}>
          <svg width="24" height="24" viewBox="0 0 48 48" aria-hidden><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
          {busy ? L('തുറക്കുന്നു…', 'Opening…') : L('Google ഉപയോഗിച്ച് തുടരുക', 'Continue with Google')}
        </button>
        {error && <div className="notice bad">{error}</div>}
        <p className="muted center small">{L('Password വേണ്ട. നിങ്ങളുടെ Google password ഞങ്ങൾ കാണില്ല.', 'No password needed. We never see your Google password.')}</p>
        <p className="muted center small" style={{ fontSize: 11.5 }}>{L(...DISCLAIMER)}</p>
        {showEmail ? (
          <>
            <p className="section">{L('Admin login', 'Admin login')}</p>
            <input id="email" className="input" type="text" autoCapitalize="none" autoComplete="username" placeholder={L('Email / username', 'Email / username')} value={email} onChange={(e) => setEmail(e.target.value)} />
            <input id="password" className="input" type="password" autoComplete="current-password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') emailLogin(); }} />
            <button className="btn block" disabled={busy || email.trim().length < 3 || password.length < 6} onClick={emailLogin}>{L('Login ചെയ്യുക', 'Log in')}</button>
            <button className="link" style={{ alignSelf: 'center' }} onClick={forgot}>{L('Password മറന്നോ?', 'Forgot password?')}</button>
          </>
        ) : !showPhone ? (
          <div className="stack" style={{ alignItems: 'center', gap: 14 }}>
            <button className="link" onClick={() => setShowPhone(true)}>{L('ഫോൺ നമ്പർ + OTP ഉപയോഗിക്കുക', 'Use phone number + OTP instead')}</button>
            <button className="link" style={{ color: 'var(--muted)', fontWeight: 600 }} onClick={() => setShowEmail(true)}>{L('Admin login (email + password)', 'Admin login (email + password)')}</button>
          </div>
        ) : (
          <>
            <p className="section">{L('ഫോൺ നമ്പർ + OTP', 'Phone number + OTP')}</p>
            <label className="input phone-input" htmlFor="phone">
              <b>+91</b>
              <input id="phone" inputMode="numeric" autoComplete="tel-national" maxLength={11} value={phone}
                onChange={(e) => setPhone(e.target.value)} placeholder="98765 43210"
                style={{ border: 0, outline: 0, fontSize: 18, flex: 1, minWidth: 0, background: 'transparent' }} />
            </label>
            <button className="btn block" disabled={!valid || busy} onClick={send}>
              {busy ? L('അയയ്ക്കുന്നു…', 'Sending…') : L('OTP അയയ്ക്കുക', 'Send OTP')}
            </button>
          </>
        )}
        {api.mode === 'demo' && showPhone && <div className="notice warn">{L(`Demo: ഏത് 10 അക്ക നമ്പറും നൽകാം. OTP: ${DEMO_OTP}`, `Demo: any 10-digit number works. OTP: ${DEMO_OTP}`)}</div>}
      </main>
    );
  }

  return (
    <>
      <main className="content" style={{ gap: 18, paddingTop: 28 }}>
        <button className="link" style={{ alignSelf: 'flex-start' }} onClick={() => { setSent(false); setDigits(['', '', '', '', '', '']); }}>← {L('നമ്പർ മാറ്റുക', 'Change number')}</button>
        <h1 className="h1">{L('OTP നൽകുക', 'Enter OTP')}</h1>
        <p className="muted" style={{ fontSize: 16 }}>
          {L(`+91 ${clean} എന്ന നമ്പറിലേക്ക് 6 അക്ക കോഡ് അയച്ചു`, `We sent a 6-digit code to +91 ${clean}`)}
        </p>
        <div className="otp">
          {digits.map((d, i) => (
            <input key={i} ref={(el) => { refs.current[i] = el; }} id={`otp-${i}`} inputMode="numeric" autoComplete={i === 0 ? 'one-time-code' : 'off'}
              aria-label={`OTP ${i + 1}`} value={d} onChange={(e) => setDigit(i, e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Backspace' && !d && i > 0) refs.current[i - 1]?.focus(); }} />
          ))}
        </div>
        {error && <div className="notice bad">{error}</div>}
        <button className="btn block" disabled={busy || !digits.every(Boolean)} onClick={() => verify(digits.join(''))}>
          {busy ? L('പരിശോധിക്കുന്നു…', 'Checking…') : L('തുടരുക', 'Continue')}
        </button>
        <p className="muted center">
          {L('കോഡ് കിട്ടിയില്ലേ? ', "Didn't get it? ")}
          {timer > 0
            ? <span><Clock size={14} style={{ verticalAlign: -2 }} /> {timer}s</span>
            : <button className="link" onClick={send}>{L('വീണ്ടും അയയ്ക്കുക', 'Resend')}</button>}
        </p>
        {api.mode === 'demo' && <div className="notice warn">Demo OTP: <b>{DEMO_OTP}</b></div>}
      </main>
    </>
  );
}

export function ConsentStep({ initial, onDone, back }: { initial?: Consent; onDone: (c: Consent) => void; back?: boolean }) {
  const { L } = useApp();
  const [c, setC] = useState<Consent>(initial ?? { showContact: true, showPhoto: true, notify: true, at: 0 });
  const items: [keyof Omit<Consent, 'at'>, string][] = [
    ['showContact', L('എന്റെ പേരും ഫോൺ നമ്പറും, ഞാൻ ബുക്ക് ചെയ്യുന്ന പണിക്കാർക്കും ഡ്രൈവർമാർക്കും കാണിക്കാം', 'Show my name and phone number to the workers and drivers I book')],
    ['showPhoto', L('എന്റെ ഫോട്ടോ profile-ൽ കാണിക്കാം', 'Show my photo on my profile')],
    ['notify', L('പ്രധാന അറിയിപ്പുകൾ notification ആയി അയയ്ക്കാം', 'Send me important notices as notifications')],
  ];
  return (
    <Screen title={L('നിങ്ങളുടെ സ്വകാര്യത', 'Your privacy')} back={back ?? false}>
      <div className="row" style={{ justifyContent: 'center' }}>
        <span style={{ width: 80, height: 80, borderRadius: 40, background: 'var(--green-soft)', display: 'grid', placeItems: 'center', color: 'var(--green)' }}>
          <Lock size={36} aria-hidden />
        </span>
      </div>
      <p className="title" style={{ fontSize: 17 }}>{L('നിങ്ങളുടെ വിവരങ്ങൾ എങ്ങനെ ഉപയോഗിക്കണം എന്ന് നിങ്ങൾ തീരുമാനിക്കുക.', 'You decide how your information is used.')}</p>
      {items.map(([k, label]) => (
        <button key={k} className="card tap" onClick={() => setC({ ...c, [k]: !c[k] })} role="checkbox" aria-checked={c[k]}>
          <span className={'check' + (c[k] ? ' on' : '')}>{c[k] && <Check size={18} />}</span>
          <span className="grow" style={{ fontSize: 15 }}>{label}</span>
        </button>
      ))}
      <div className="notice">
        <span>
          {L('ഞങ്ങൾ Aadhaar നമ്പർ ചോദിക്കില്ല. നിങ്ങളുടെ നമ്പർ മറ്റാർക്കും വിൽക്കില്ല. എപ്പോൾ വേണമെങ്കിലും Profile-ൽ നിന്ന് ഇത് മാറ്റാം, നിങ്ങളുടെ data delete ചെയ്യാം.',
            'We never ask for Aadhaar and never sell your number. Change these any time in Profile, or delete your data.')}
        </span>
      </div>
      <div className="spacer" />
      <button className="btn block" onClick={() => onDone({ ...c, at: Date.now() })}>{L('സമ്മതിക്കുന്നു, തുടരുക', 'Agree and continue')}</button>
    </Screen>
  );
}

export function VillageStep({ current, onDone, back }: { current?: string; onDone: (v: Village | null) => void; back?: boolean }) {
  const { api, authUser, villages, panchayats, refresh, L, toast } = useApp();
  const cur = villages.find((v) => v.id === current);
  const [sel, setSel] = useState<Panchayat | null>(cur ? panchayats.find((p) => p.ids.includes(cur.id)) ?? null : null);
  const [place, setPlace] = useState<Place | null>(null); // new panchayat form, filled from location
  const [saving, setSaving] = useState(false);

  async function addVillage() {
    if (!place || !authUser) return;
    // Already on Gramaseva under the same district + panchayat name? Use that instead of making a duplicate.
    const same = panchayats.find((p) => p.key === panchayatKey({ district: place.district.trim(), panchayat: place.panchayat.trim() }));
    if (same) { onDone(same.main); return; }
    setSaving(true);
    try {
      const name = (place.panchayat.trim().replace(/\s*(ഗ്രാമ\s*)?പഞ്ചായത്ത്$/, '') || place.village.trim());
      const v = await api.addVillage({
        name, nameEn: (place.panchayatEn.replace(/\s*(grama\s*)?panchayath?$/i, '').trim() || place.villageEn || name).trim(),
        panchayat: place.panchayat.trim(), district: place.district.trim(),
        status: 'live', lat: place.lat, lng: place.lng, createdBy: authUser.uid,
      });
      await refresh();
      toast(L(`${v.panchayat} ചേർത്തു`, `${v.nameEn} added`));
      onDone(v);
    } catch (e) {
      console.error(e);
      toast(L('ചേർക്കാൻ പറ്റിയില്ല. വീണ്ടും ശ്രമിക്കുക.', "Couldn't add it. Please try again."));
    } finally { setSaving(false); }
  }

  const setP = (k: keyof Place, val: string) => place && setPlace({ ...place, [k]: val });

  return (
    <Screen title={L('നിങ്ങളുടെ പഞ്ചായത്ത്', 'Your panchayat')} back={back ?? false}>
      <p className="muted" style={{ fontSize: 15 }}>{L('നിങ്ങളുടെ സ്വന്തം (home) പഞ്ചായത്ത് തിരഞ്ഞെടുക്കുക. മറ്റ് പഞ്ചായത്തുകളിലെ ആളുകളെയും പിന്നീട് എപ്പോൾ വേണമെങ്കിലും കാണാം.', 'Choose your own (home) panchayat. You can look at other panchayats any time later.')}</p>

      {place ? (
        <div className="card col" style={{ gap: 10, outline: '2px solid var(--green)' }}>
          <b>{L('ഈ സ്ഥലം ഗ്രാമസേവയിൽ ഇതുവരെ ഇല്ല', "This place isn't on Gramaseva yet")}</b>
          <p className="muted small">{L('ഗ്രാമ പഞ്ചായത്തിന്റെ പേര് ശരിയാണോ എന്ന് നോക്കുക (ബ്ലോക്ക് പഞ്ചായത്ത് അല്ല); വേണമെങ്കിൽ തിരുത്താം.', 'Check the grama panchayat name (not the block panchayat) and correct it if needed.')}</p>
          <div className="field"><label htmlFor="pp">{L('ഗ്രാമ പഞ്ചായത്ത് / മുനിസിപ്പാലിറ്റി', 'Grama panchayat / municipality')}</label><input id="pp" className="input" value={place.panchayat} onChange={(e) => setP('panchayat', e.target.value)} placeholder={L('ഉദാ: തകഴി ഗ്രാമപഞ്ചായത്ത്', 'e.g. Thakazhy Grama Panchayat')} /></div>
          <div className="field"><label htmlFor="pd">{L('ജില്ല', 'District')}</label><input id="pd" className="input" value={place.district} onChange={(e) => setP('district', e.target.value)} /></div>
          <div className="field"><label htmlFor="pv">{L('സ്ഥലം (വേണമെങ്കിൽ)', 'Place (optional)')}</label><input id="pv" className="input" value={place.village} onChange={(e) => setP('village', e.target.value)} /></div>
          <button className="btn block" disabled={saving || !place.panchayat.trim() || !place.district.trim()} onClick={addVillage}>
            {saving ? L('ചേർക്കുന്നു…', 'Adding…') : L('ഈ പഞ്ചായത്ത് ചേർത്ത് തുടരുക', 'Add this panchayat and continue')}
          </button>
          <button className="link" style={{ alignSelf: 'center' }} onClick={() => setPlace(null)}>{L('ലിസ്റ്റിലേക്ക് തിരികെ', 'Back to the list')}</button>
        </div>
      ) : (
        <PanchayatChooser selected={sel?.key} onPick={setSel} onNotFound={setPlace} />
      )}

      {!place && (
        <button className="link" style={{ alignSelf: 'center' }} onClick={() => setPlace({ lat: 0, lng: 0, district: '', districtEn: '', panchayat: '', panchayatEn: '', village: '', villageEn: '' })}>
          {L('എന്റെ പഞ്ചായത്ത് ലിസ്റ്റിൽ ഇല്ല', 'My panchayat is not listed')}
        </button>
      )}
      <div className="spacer" />
      {!place && <button className="btn block" disabled={!sel} onClick={() => sel && onDone(sel.main)}>
        {sel ? L(`തുടരുക — ${panchayatName(sel.main, 'ml')}`, `Continue — ${panchayatName(sel.main, 'en')}`) : L('തുടരുക', 'Continue')}
      </button>}
      {!place && back && <button className="link" style={{ alignSelf: 'center' }} onClick={() => onDone(null)}>{L('മാറ്റമില്ലാതെ തിരികെ', 'Go back without changing')}</button>}
    </Screen>
  );
}

export function ProfileStep({ draft, needPhone, wards, onDone }: { draft: Partial<UserProfile>; needPhone?: boolean; wards?: Ward[]; onDone: (name: string, ward: string, wantsProvider: boolean, phone: string) => void }) {
  const { L, lang } = useApp();
  const [name, setName] = useState(draft.name ?? '');
  const [ph, setPh] = useState('');
  const phDigits = ph.replace(/\D/g, '').slice(-10);
  const phOk = !needPhone || /^[6-9]\d{9}$/.test(phDigits);
  const [ward, setWard] = useState(draft.ward ?? '');
  const [prov, setProv] = useState(false);
  return (
    <Screen title={L('നിങ്ങളെക്കുറിച്ച്', 'About you')} back={false}>
      <div className="field">
        <label htmlFor="name">{L('പേര്', 'Name')}</label>
        <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={L('ഉദാ: രാജൻ കെ.', 'e.g. Rajan K.')} autoComplete="name" />
      </div>
      {needPhone && (
        <div className="field">
          <label htmlFor="myphone">{L('നിങ്ങളുടെ ഫോൺ നമ്പർ', 'Your phone number')}</label>
          <label className="input phone-input" htmlFor="myphone"><b>+91</b>
            <input id="myphone" inputMode="numeric" autoComplete="tel-national" maxLength={11} value={ph} onChange={(e) => setPh(e.target.value)} placeholder="98765 43210"
              style={{ border: 0, outline: 0, fontSize: 18, flex: 1, minWidth: 0, background: 'transparent' }} />
          </label>
          <span className="muted small">{L('പണിക്കാർക്കും ഡ്രൈവർമാർക്കും നിങ്ങളെ വിളിക്കാൻ.', 'So workers and drivers can call you.')}</span>
        </div>
      )}
      <div className="field">
        <label htmlFor="ward">{wards?.length ? L('നിങ്ങളുടെ വാർഡ്', 'Your ward') : L('വാർഡ് നമ്പർ (വേണമെങ്കിൽ)', 'Ward number (optional)')}</label>
        {wards?.length ? (
          <select id="ward" className="input" value={ward} onChange={(e) => setWard(e.target.value)}>
            <option value="">{L('തിരഞ്ഞെടുക്കുക', 'Choose')}</option>
            {[...wards].sort((a, b) => (lang === 'ml' ? a.name.localeCompare(b.name, 'ml') : a.nameEn.localeCompare(b.nameEn))).map((w) => <option key={w.no} value={String(w.no)}>{lang === 'ml' ? w.name : w.nameEn} — {w.member}</option>)}
          </select>
        ) : <input id="ward" className="input" inputMode="numeric" value={ward} onChange={(e) => setWard(e.target.value)} placeholder="7" />}
      </div>
      <button className="card tap" onClick={() => setProv(!prov)} role="checkbox" aria-checked={prov} style={{ outline: '2px solid var(--yellow)' }}>
        <span className={'check' + (prov ? ' on' : '')}>{prov && <Check size={18} />}</span>
        <span className="stack grow">
          <b>{L('ഞാൻ ഒരു സേവനദാതാവാണ്', 'I provide a service')}</b>
          <span className="muted small">{L('പണിക്കാരൻ / ഡ്രൈവർ ആണെങ്കിൽ ടിക്ക് ചെയ്യുക', 'Tick if you are a worker or driver')}</span>
        </span>
      </button>
      <div className="spacer" />
      <button className="btn block" disabled={name.trim().length < 2 || !phOk} onClick={() => onDone(name.trim(), ward.trim(), prov, needPhone ? '+91' + phDigits : '')}>{L('സേവ് ചെയ്യുക', 'Save')}</button>
    </Screen>
  );
}
