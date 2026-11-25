import { loginEmail } from '../lib/owner';
import { DISCLAIMER } from '../lib/store';
import { useEffect, useRef, useState } from 'react';
import { Check, Clock, Delete, Lock, MessageCircle } from 'lucide-react';
import type { WaLogin } from '../data/api';
import { useApp } from '../lib/app';
import { Hills, Logo, Screen } from '../components/ui';
import { DEMO_OTP } from '../data/demo';
import type { Place } from '../lib/geo';
import { panchayatKey, panchayatName, type Panchayat } from '../lib/panchayat';
import { PanchayatChooser } from './Panchayats';
import type { Consent, UserProfile, Village, Ward } from '../types';
import { PIN_RE, cleanPin, lookupPincode, pinFields, type PinInfo } from '../lib/pincode';

/** PIN code of the person's home, after the check. */
export type PinValue = Pick<UserProfile, 'pincode' | 'pinLat' | 'pinLng' | 'pinPlace'>;

/** 6-digit PIN code input that checks the PIN with India Post. onChange(null) while it is not a good PIN. */
export function PincodeField({ initial, onChange }: { initial?: string; onChange: (v: PinValue | null) => void }) {
  const { L } = useApp();
  const [pin, setPin] = useState(initial ?? '');
  const [state, setState] = useState<{ s: 'idle' | 'checking' | 'ok' | 'bad' | 'offline'; info?: PinInfo | null }>({ s: 'idle' });
  useEffect(() => {
    if (!PIN_RE.test(pin)) { setState({ s: 'idle' }); onChange(null); return; }
    let alive = true;
    setState({ s: 'checking' }); onChange(null);
    lookupPincode(pin).then((info) => {
      if (!alive) return;
      if (info) { setState({ s: 'ok', info }); onChange(pinFields(pin, info)); } else { setState({ s: 'bad' }); onChange(null); }
    }).catch(() => {
      // India Post not reachable: accept the PIN as typed.
      if (!alive) return;
      setState({ s: 'offline' }); onChange(pinFields(pin, null));
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);
  return (
    <div className="field">
      <label htmlFor="pin">{L('പിൻകോഡ് (നിർബന്ധം)', 'PIN code (required)')}</label>
      <input id="pin" className="input" inputMode="numeric" autoComplete="postal-code" maxLength={6} value={pin} placeholder="688562"
        onChange={(e) => setPin(cleanPin(e.target.value))} style={{ fontSize: 18, letterSpacing: 2 }} />
      {state.s === 'checking' && <span className="muted small">{L('പരിശോധിക്കുന്നു…', 'Checking…')}</span>}
      {state.s === 'ok' && state.info && <span className="small" style={{ color: 'var(--green-dark)' }}>✓ {state.info.places.slice(0, 3).join(', ')}{state.info.places.length > 3 ? '…' : ''} · {state.info.district}, {state.info.state}</span>}
      {state.s === 'bad' && <span className="small" style={{ color: '#c62828' }}>{L('ഈ പിൻകോഡ് കണ്ടെത്താനായില്ല. ശരിയാണോ എന്ന് നോക്കുക.', "This PIN code wasn't found. Please check it.")}</span>}
      {state.s === 'offline' && <span className="muted small">{L('ഇപ്പോൾ പരിശോധിക്കാൻ പറ്റിയില്ല; ടൈപ്പ് ചെയ്തത് പോലെ സേവ് ചെയ്യും.', "Couldn't check it right now; it will be saved as typed.")}</span>}
      {state.s === 'idle' && <span className="muted small">{L('നിങ്ങളുടെ അടുത്തുള്ള കടകളും സാധനങ്ങളും പണിക്കാരെയും ആദ്യം കാണിക്കാൻ.', 'Used to show shops, items and workers near you first.')}</span>}
    </div>
  );
}

/** Asks for the PIN code: for people who joined before it was required, and to change it from Profile. */
export function PincodeStep({ back, onDone }: { back?: boolean; onDone?: () => void }) {
  const { api, profile, refresh, L, toast } = useApp();
  const [v, setV] = useState<PinValue | null>(null);
  const [busy, setBusy] = useState(false);
  if (!profile) return null;
  async function save() {
    if (!profile || !v) return;
    setBusy(true);
    try {
      const { pinLat: _a, pinLng: _b, pinPlace: _c, ...rest } = profile; void _a; void _b; void _c;
      await api.saveProfile({ ...rest, ...v });
      await refresh();
      toast(L('സേവ് ചെയ്തു', 'Saved'));
      onDone?.();
    } catch (e) {
      console.error(e);
      toast(L('സേവ് ചെയ്യാൻ പറ്റിയില്ല. Internet നോക്കി വീണ്ടും ശ്രമിക്കുക.', "Couldn't save. Check your internet and try again."));
    } finally { setBusy(false); }
  }
  return (
    <Screen title={L('നിങ്ങളുടെ പിൻകോഡ്', 'Your PIN code')} back={back ?? false}>
      {!back && <p className="muted" style={{ fontSize: 15 }}>{L('തുടരാൻ നിങ്ങളുടെ വീടിന്റെ പിൻകോഡ് നൽകുക. അടുത്തുള്ള കടകളും സാധനങ്ങളും ആദ്യം കാണിക്കാൻ ഇത് ഉപയോഗിക്കും.', 'Enter the PIN code of your home to continue. It is used to show nearby shops and items first.')}</p>}
      <PincodeField initial={back ? profile.pincode : ''} onChange={setV} />
      <div className="spacer" />
      <button className="btn block" disabled={busy || !v} onClick={save}>{busy ? L('സേവ് ചെയ്യുന്നു…', 'Saving…') : L('സേവ് ചെയ്യുക', 'Save')}</button>
    </Screen>
  );
}

export function Splash() {
  return (
    <div className="splash2">
      <div className="rings">
        <span /><span /><span />
        <div className="logo anim-pop"><Logo size={112} inverse /></div>
      </div>
      <div className="anim-up d1" style={{ fontSize: 38, fontWeight: 800 }}>ഗ്രാമസേവ</div>
      <div className="anim-up d2" style={{ opacity: 0.92 }}>നാടിന്റെ എല്ലാ സേവനങ്ങളും ഒരിടത്ത്</div>
      <div className="loaddots" role="status" aria-label="Loading"><span /><span /><span /></div>
      <Hills />
      <div className="paddy" aria-hidden>
        {[34, 44, 30, 48, 36, 42, 32, 46, 38, 44, 30, 40].map((h, i) => <span key={i} style={{ height: h, animationDelay: `${(i * 37) % 45 / 100}s` }} />)}
      </div>
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

/**
 * Firebase SMS OTP needs the Blaze (billing) plan. Until that is on, the option stays hidden in the real app
 * (it only showed an error). Turn it back on with VITE_PHONE_OTP=1 in .env. The demo always shows it.
 */
const PHONE_OTP_ON = import.meta.env.VITE_PHONE_OTP === '1' || !import.meta.env.VITE_FIREBASE_API_KEY || import.meta.env.VITE_DEMO === '1';

/** Free login: mobile number + own 6-digit PIN (no SMS). New users register; returning users log in. */
function MobilePinForm() {
  const { api, L, toast } = useApp();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const ten = phone.replace(/\D/g, '').slice(-10);
  const phoneOk = /^[6-9]\d{9}$/.test(ten);
  const pinOk = /^\d{6}$/.test(pin);
  const weak = /^(\d)\1{5}$/.test(pin) || ['123456', '654321', '012345', '123123'].includes(pin);
  const ok = phoneOk && pinOk && (mode === 'login' || !weak);
  const press = (k: string) => { setError(''); setPin((p) => (k === 'back' ? p.slice(0, -1) : p.length < 6 ? p + k : p)); };
  const switchTo = (m: 'login' | 'register') => { setMode(m); setError(''); setPin(''); };

  async function go() {
    if (!ok || busy) return;
    setBusy(true); setError('');
    try {
      if (mode === 'login') await api.signInWithMobilePin(ten, pin);
      else await api.registerMobilePin(ten, pin);
      toast(L('ലോഗിൻ ചെയ്തു', 'Logged in'));
    } catch (e) {
      const code = (e as { code?: string }).code ?? '';
      console.error(e);
      if (code === 'auth/email-already-in-use') { setMode('login'); setError(L('ഈ നമ്പറിൽ ഇതിനകം account ഉണ്ട്. നിങ്ങളുടെ PIN നൽകി Login ചെയ്യുക.', 'This number already has an account. Enter your PIN and log in.')); }
      else if (code === 'auth/too-many-requests') setError(L('ഒരുപാട് തവണ തെറ്റി. കുറച്ച് കഴിഞ്ഞ് ശ്രമിക്കുക.', 'Too many wrong tries. Please wait a while.'));
      else if (code === 'auth/network-request-failed') setError(L('Internet ഇല്ല. Connection നോക്കി വീണ്ടും ശ്രമിക്കുക.', 'No internet. Check your connection and try again.'));
      else if (mode === 'login') setError(L('നമ്പർ അല്ലെങ്കിൽ PIN തെറ്റാണ്. പുതിയ ആളാണെങ്കിൽ താഴെ "പുതിയ account" അമർത്തുക.', 'Wrong number or PIN. New here? Tap "New account" below.'));
      else setError(L('Account ഉണ്ടാക്കാൻ പറ്റിയില്ല. വീണ്ടും ശ്രമിക്കുക.', "Couldn't create the account. Please try again.") + (code ? ` (${code})` : ''));
    } finally { setBusy(false); }
  }

  // A computer keyboard works too: digits, Backspace and Enter (except while typing the phone number).
  const onKey = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).id === 'mphone') { if (e.key === 'Enter') document.getElementById('pinpad')?.focus(); return; }
    if (/^\d$/.test(e.key)) { e.preventDefault(); press(e.key); }
    else if (e.key === 'Backspace') { e.preventDefault(); press('back'); }
    else if (e.key === 'Enter' && ok) { e.preventDefault(); void go(); }
  };
  // A new PIN is shown as digits (typed once, so a mistake is easy to see); a login PIN as dots.
  const shown = mode === 'register';

  return (
    <div className="logincard anim-slide" onKeyDown={onKey}>
      <div className="seg" role="tablist">
        <button role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'on' : ''} onClick={() => switchTo('login')}>Login</button>
        <button role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? 'on' : ''} onClick={() => switchTo('register')}>{L('പുതിയ account', 'New account')}</button>
      </div>
      <label className="field2" htmlFor="mphone">
        <b style={{ fontSize: 17 }}>+91</b>
        <input id="mphone" inputMode="numeric" autoComplete="tel-national" maxLength={11} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={L('മൊബൈൽ നമ്പർ', 'Mobile number')} />
      </label>
      <div className="stack" style={{ alignItems: 'center', gap: 8 }}>
        <span className="muted small">{mode === 'login' ? L('നിങ്ങളുടെ 6 അക്ക PIN', 'Your 6-digit PIN') : L('ഒരു 6 അക്ക PIN ഉണ്ടാക്കുക', 'Make a 6-digit PIN')}</span>
        <div id="pinpad" tabIndex={0} className={'pindots' + (shown ? ' shown' : '')} role="status" aria-label={L(`PIN: ${pin.length} / 6`, `PIN: ${pin.length} of 6`)}>
          {[0, 1, 2, 3, 4, 5].map((i) => <span key={i} className={i < pin.length ? 'on' : ''}>{shown ? pin[i] ?? '' : ''}</span>)}
        </div>
      </div>
      <div className="keypad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'].map((k, i) => (
          k === '' ? <button key={i} className="blank" tabIndex={-1} aria-hidden /> :
          <button key={i} type="button" onClick={() => press(k)} aria-label={k === 'back' ? L('മായ്ക്കുക', 'Delete') : k}>{k === 'back' ? <Delete size={24} aria-hidden /> : k}</button>
        ))}
      </div>
      {mode === 'register' && pinOk && weak && <span className="small center" style={{ color: '#c62828' }}>{L('ഈ PIN എളുപ്പം ഊഹിക്കാം. വേറെ ഒന്ന് നൽകുക.', 'This PIN is easy to guess. Choose another.')}</span>}
      {mode === 'register' && !(pinOk && weak) && <span className="muted small center">{L('ഈ PIN ഓർത്ത് വെക്കുക. Logout ചെയ്യുന്നത് വരെ വീണ്ടും ചോദിക്കില്ല.', "Remember this PIN. It isn't asked again until you log out.")}</span>}
      {error && <div className="notice bad">{error}</div>}
      <button className="btn block lg cta" disabled={!ok || busy} onClick={go}>
        {busy ? L('കാത്തിരിക്കുക…', 'Please wait…') : mode === 'login' ? L('Login ചെയ്യുക', 'Log in') : L('Account ഉണ്ടാക്കുക', 'Create account')}
      </button>
      <span className="muted small center">{L('SMS / OTP ഇല്ല, പൂർണ്ണമായും free. PIN മറന്നാൽ admin-നെ ബന്ധപ്പെടുക.', 'No SMS / OTP, completely free. Forgot your PIN? Contact the admin.')}</span>
    </div>
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
  const [wa, setWa] = useState<WaLogin | null>(null);

  // WhatsApp login: keep checking until the person's message reaches the login server (and on coming back to the app).
  useEffect(() => {
    if (!wa) return;
    let stop = false;
    let inFlight = false;
    let t = 0;
    const tick = async () => {
      if (stop || inFlight) return;
      inFlight = true;
      try {
        if (await api.checkWaLogin(wa.session)) { stop = true; toast(L('ലോഗിൻ ചെയ്തു', 'Logged in')); return; }
      } catch (e) {
        if ((e as { code?: string }).code === 'wa/expired') {
          stop = true; setWa(null);
          setError(L('സമയം കഴിഞ്ഞു. വീണ്ടും "WhatsApp വഴി login" അമർത്തുക.', 'Time ran out. Tap "Log in with WhatsApp" again.'));
          return;
        }
        console.error(e); // network hiccup: keep trying
      } finally { inFlight = false; }
      if (!stop) t = window.setTimeout(tick, 2500);
    };
    t = window.setTimeout(tick, 2500);
    const onVisible = () => { if (document.visibilityState === 'visible') { window.clearTimeout(t); void tick(); } };
    document.addEventListener('visibilitychange', onVisible);
    return () => { stop = true; window.clearTimeout(t); document.removeEventListener('visibilitychange', onVisible); };
  }, [wa, api, toast, L]);

  async function startWa() {
    setBusy(true); setError('');
    try {
      setWa(await api.startWaLogin());
    } catch (e) {
      console.error(e);
      setError(L('WhatsApp login ഇപ്പോൾ തുടങ്ങാൻ പറ്റിയില്ല. Internet നോക്കി വീണ്ടും ശ്രമിക്കുക, അല്ലെങ്കിൽ Google ഉപയോഗിക്കുക.', "Couldn't start WhatsApp login. Check your internet and try again, or use Google."));
    } finally { setBusy(false); }
  }

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

  if (wa) {
    const link = `https://wa.me/${wa.waNumber}?text=${encodeURIComponent(wa.text)}`;
    return (
      <main className="content" style={{ paddingTop: 36, gap: 16 }}>
        <button className="link" style={{ alignSelf: 'flex-start' }} onClick={() => setWa(null)}>← {L('തിരികെ', 'Back')}</button>
        <h1 className="h1">{L('WhatsApp വഴി login', 'Log in with WhatsApp')}</h1>
        <ol style={{ margin: 0, paddingLeft: 22, fontSize: 16, lineHeight: 1.6 }}>
          <li>{L('താഴെയുള്ള പച്ച ബട്ടൺ അമർത്തുക. WhatsApp തുറക്കും, മെസേജ് തയ്യാറായിരിക്കും.', 'Tap the green button. WhatsApp opens with the message ready.')}</li>
          <li>{L('WhatsApp-ൽ Send (➤) അമർത്തുക.', 'Press Send (➤) in WhatsApp.')}</li>
          <li>{L('ഈ app-ലേക്ക് തിരിച്ചു വരിക — തനിയെ login ആകും.', 'Come back to this app — you will be logged in automatically.')}</li>
        </ol>
        <a className="btn block lg wa" href={link} target="_blank" rel="noreferrer">
          <MessageCircle size={22} aria-hidden /> {L('WhatsApp തുറക്കുക', 'Open WhatsApp')}
        </a>
        <div className="card col" style={{ gap: 4, alignItems: 'center' }}>
          <span className="muted small">{L('നിങ്ങളുടെ കോഡ്', 'Your code')}</span>
          <b className="num" style={{ fontSize: 28, letterSpacing: 4 }}>{wa.code}</b>
          <span className="muted small center">{L(`WhatsApp തുറന്നില്ലെങ്കിൽ, +${wa.waNumber} എന്ന നമ്പറിലേക്ക് "${wa.text}" എന്ന് WhatsApp ചെയ്യുക.`, `If WhatsApp didn't open, send "${wa.text}" to +${wa.waNumber} on WhatsApp.`)}</span>
        </div>
        <p className="muted center"><Clock size={14} style={{ verticalAlign: -2 }} /> {L('നിങ്ങളുടെ മെസേജിനായി കാത്തിരിക്കുന്നു…', 'Waiting for your message…')}</p>
        {error && <div className="notice bad">{error}</div>}
        <p className="muted small center">{L('ഏത് നമ്പറിൽ നിന്നാണോ WhatsApp അയയ്ക്കുന്നത്, അതാണ് നിങ്ങളുടെ login നമ്പർ. ഇത് പൂർണ്ണമായും free ആണ്.', 'The number you send the WhatsApp from becomes your login number. This is completely free.')}</p>
        {api.mode === 'demo' && <div className="notice warn">{L('Demo: 4 സെക്കൻഡ് കഴിഞ്ഞ് തനിയെ login ആകും.', 'Demo: you will be logged in after 4 seconds.')}</div>}
      </main>
    );
  }

  if (!sent) {
    return (
      <main className="loginpage">
        <header className="loginhero">
          <span className="sun" aria-hidden />
          <Hills />
          <div className="brand">
            <div className="logo anim-pop"><Logo size={76} inverse /></div>
            <h1 className="anim-up d1">ഗ്രാമസേവ</h1>
            <p className="anim-up d2" style={{ color: '#e6f4ea', fontSize: 15 }}>{L('നാടിന്റെ എല്ലാ സേവനങ്ങളും ഒരിടത്ത്', 'Your village, all in one place')}</p>
          </div>
        </header>
        {api.waLoginEnabled ? (
          <div className="logincard anim-slide">
            <b style={{ fontSize: 17 }}>{L('സ്വാഗതം 👋', 'Welcome 👋')}</b>
            <p className="muted" style={{ fontSize: 15 }}>{L('നിങ്ങളുടെ മൊബൈൽ നമ്പർ ഉപയോഗിച്ച് WhatsApp വഴി free ആയി login ചെയ്യാം. SMS / OTP വേണ്ട.', 'Log in free with your mobile number through WhatsApp. No SMS / OTP needed.')}</p>
            <button className="btn block lg wa cta" style={{ gap: 12 }} disabled={busy} onClick={startWa}>
              <MessageCircle size={24} aria-hidden /> {busy ? L('തുറക്കുന്നു…', 'Opening…') : L('WhatsApp വഴി login (free)', 'Log in with WhatsApp (free)')}
            </button>
          </div>
        ) : <MobilePinForm />}
        <div className="loginrest anim-up d3">
        <div className="orline">{L('അല്ലെങ്കിൽ', 'or')}</div>
        <button className="btn block outline cta" style={{ color: 'var(--ink)', borderColor: 'var(--line-strong)', gap: 12, boxShadow: 'none' }} disabled={busy} onClick={google}>
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
            {PHONE_OTP_ON && <button className="link" onClick={() => setShowPhone(true)}>{L('ഫോൺ നമ്പർ + OTP ഉപയോഗിക്കുക', 'Use phone number + OTP instead')}</button>}
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
        </div>
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

export function ProfileStep({ draft, needPhone, wards, onDone }: { draft: Partial<UserProfile>; needPhone?: boolean; wards?: Ward[]; onDone: (name: string, ward: string, wantsProvider: boolean, phone: string, pin: PinValue) => void }) {
  const { L, lang } = useApp();
  const [name, setName] = useState(draft.name ?? '');
  const [ph, setPh] = useState('');
  const phDigits = ph.replace(/\D/g, '').slice(-10);
  const phOk = !needPhone || /^[6-9]\d{9}$/.test(phDigits);
  const [ward, setWard] = useState(draft.ward ?? '');
  const [prov, setProv] = useState(false);
  const [pin, setPin] = useState<PinValue | null>(null);
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
      <PincodeField onChange={setPin} />
      <button className="card tap" onClick={() => setProv(!prov)} role="checkbox" aria-checked={prov} style={{ outline: '2px solid var(--yellow)' }}>
        <span className={'check' + (prov ? ' on' : '')}>{prov && <Check size={18} />}</span>
        <span className="stack grow">
          <b>{L('ഞാൻ ഒരു സേവനദാതാവാണ്', 'I provide a service')}</b>
          <span className="muted small">{L('പണിക്കാരൻ / ഡ്രൈവർ ആണെങ്കിൽ ടിക്ക് ചെയ്യുക', 'Tick if you are a worker or driver')}</span>
        </span>
      </button>
      <div className="spacer" />
      <button className="btn block" disabled={name.trim().length < 2 || !phOk || !pin} onClick={() => pin && onDone(name.trim(), ward.trim(), prov, needPhone ? '+91' + phDigits : '', pin)}>{L('സേവ് ചെയ്യുക', 'Save')}</button>
    </Screen>
  );
}
