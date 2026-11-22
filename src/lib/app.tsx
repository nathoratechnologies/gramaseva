import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Api, AuthUser } from '../data/api';
import type { Lang, Provider, UserProfile, Village } from '../types';
import { withBuiltin } from '../data/builtin';
import { km } from './util';
import { OWNER_EMAILS } from './owner';
import { groupPanchayats, panchayatKey, type Panchayat } from './panchayat';

interface AppState {
  api: Api;
  lang: Lang;
  setLang: (l: Lang) => void;
  authUser: AuthUser | null;
  authReady: boolean;
  profile: UserProfile | null;
  provider: Provider | null;
  villages: Village[];
  /** All panchayats (duplicates merged). */
  panchayats: Panchayat[];
  /** The panchayat being looked at now (home by default; anyone can switch to any panchayat). */
  view: Panchayat | null;
  /** Main record of the panchayat being looked at. */
  village: Village | null;
  /** Every village id in the panchayat being looked at. */
  viewIds: string[];
  /** viewIds plus villages within 20 km (for workers who travel from nearby panchayats). */
  reachIds: string[];
  /** The person's own (home) village. */
  homeVillage: Village | null;
  isHomeView: boolean;
  setView: (key: string | null) => void;
  refresh: () => Promise<void>;
  L: (ml: string, en: string) => string;
  pair: (p: [string, string]) => string;
  toast: (msg: string) => void;
  toastMsg: string | null;
}

const Ctx = createContext<AppState | null>(null);

const readLang = (): Lang | null => {
  try {
    const v = localStorage.getItem('gramaseva-lang');
    return v === 'ml' || v === 'en' ? v : null;
  } catch {
    return null;
  }
};

export function AppProvider({ api, children }: { api: Api; children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readLang() ?? 'ml');
  const [authUser, setAuthUser] = useState<AppState['authUser']>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [provider, setProvider] = useState<Provider | null>(null);
  const [villages, setVillages] = useState<Village[]>([]);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [viewKey, setViewKey] = useState<string | null>(() => { try { return localStorage.getItem('gs-view'); } catch { return null; } });
  const setView = useCallback((k: string | null) => {
    setViewKey(k);
    try { if (k) localStorage.setItem('gs-view', k); else localStorage.removeItem('gs-view'); } catch { /* ignore */ }
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem('gramaseva-lang', l); } catch { /* ignore */ }
  }, []);

  const loadFor = useCallback(async (u: AppState['authUser']) => {
    const [vs, p, pr] = await Promise.all([
      api.listVillages().catch(() => [] as Village[]).then(withBuiltin),
      u ? api.getProfile(u.uid) : Promise.resolve(null),
      u ? api.getProvider(u.uid).catch(() => null) : Promise.resolve(null),
    ]);
    setVillages(vs);
    // The app owner's login always works as super admin (full control).
    const owner = !!u?.email && OWNER_EMAILS.includes(u.email.toLowerCase());
    setProfile(p && owner && p.role !== 'superadmin' ? { ...p, role: 'superadmin', coordinatorOf: null } : p);
    setProvider(pr);
    if (p?.lang) setLang(p.lang);
  }, [api, setLang]);

  useEffect(() => api.onAuth(async (u) => {
    setAuthUser(u);
    try { await loadFor(u); } finally { setAuthReady(true); }
  }), [api, loadFor]);

  const refresh = useCallback(() => loadFor(authUser), [loadFor, authUser]);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => setToastMsg((m) => (m === msg ? null : m)), 2600);
  }, []);

  const panchayats = useMemo(() => groupPanchayats(villages), [villages]);
  const homeVillage = villages.find((v) => v.id === profile?.villageId) ?? null;
  const homeKey = homeVillage ? panchayatKey(homeVillage) : null;
  const view = panchayats.find((p) => p.key === viewKey) ?? panchayats.find((p) => p.key === homeKey) ?? null;
  const reachIds = useMemo(() => {
    if (!view) return [];
    const near = villages
      .filter((v) => !view.ids.includes(v.id) && v.status === 'live' && km(view.main, v) <= 20)
      .sort((a, b) => km(view.main, a) - km(view.main, b))
      .slice(0, 50)
      .map((v) => v.id);
    return [...view.ids, ...near];
  }, [view, villages]);

  const value = useMemo<AppState>(() => ({
    api, lang, setLang, authUser, authReady, profile, provider, villages,
    panchayats, view, village: view?.main ?? null, viewIds: view?.ids ?? [], reachIds, homeVillage,
    isHomeView: !!view && view.key === homeKey, setView,
    refresh,
    L: (ml, en) => (lang === 'ml' ? ml : en),
    pair: (p) => (lang === 'ml' ? p[0] : p[1]),
    toast, toastMsg,
  }), [api, lang, setLang, authUser, authReady, profile, provider, villages, panchayats, view, reachIds, homeVillage, homeKey, setView, refresh, toast, toastMsg]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp outside AppProvider');
  return v;
}

/** Load async data for a screen; returns [data, reload]. */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[]): [T | undefined, () => void, boolean] {
  const [data, setData] = useState<T>();
  const [error, setError] = useState(false);
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true;
    setError(false);
    fn().then((d) => alive && setData(d)).catch((e) => {
      console.error(e);
      if (alive) setError(true);
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, n]);
  return [data, () => setN((x) => x + 1), error];
}
