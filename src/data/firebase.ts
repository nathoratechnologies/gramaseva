// Real backend: Firebase Authentication (phone OTP) + Cloud Firestore.
import { initializeApp, deleteApp } from 'firebase/app';
import {
  getAuth, onAuthStateChanged, RecaptchaVerifier, signInWithPhoneNumber, signOut,
  GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
  signInWithEmailAndPassword, sendPasswordResetEmail, createUserWithEmailAndPassword, updatePassword, signInWithCustomToken,
  type ConfirmationResult,
} from 'firebase/auth';
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, query, where,
  getDocs, getCountFromServer, writeBatch, increment, documentId, arrayUnion, type QueryConstraint,
} from 'firebase/firestore';
import type { Api } from './api';
import { byNewest } from './api';
import type {
  Booking, News, Provider, Report, Review, RoleRequest, UserProfile, Village, Contact, Timing, BloodDonor, Complaint,
  Listing, Seller, Ad, Payment, PaySettings, Enquiry, DeliveryBoy, Delivery, OrderReview, RatingStat,
} from '../types';
import { DEFAULT_PAY, WEEK } from '../types';
import { loginEmail } from '../lib/owner';

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
};

/** Free WhatsApp login server (Cloudflare Worker in whatsapp-login/). Empty = the WhatsApp button is hidden. */
const WA_LOGIN_URL = ((import.meta.env.VITE_WA_LOGIN_URL as string | undefined) ?? '').replace(/\/+$/, '');

export function createFirebaseApi(): Api {
  // Google sign-in by redirect fails on browsers that block third-party storage when authDomain differs from the
  // site's own domain. Firebase Hosting serves /__/auth/handler on both of its domains, so use the one the app is on.
  const host = typeof location !== 'undefined' ? location.hostname : '';
  const ownDomain = host.endsWith('.web.app') || host.endsWith('.firebaseapp.com');
  const app = initializeApp({ ...firebaseConfig, ...(ownDomain ? { authDomain: host } : {}) });
  const auth = getAuth(app);
  auth.languageCode = 'ml';
  getRedirectResult(auth).catch((e) => console.error('Google redirect sign-in failed', e));
  const db = getFirestore(app);

  let confirmation: ConfirmationResult | null = null;
  let verifier: RecaptchaVerifier | null = null;
  let box: HTMLDivElement | null = null;

  const one = async <T>(path: string, id: string): Promise<T | null> => {
    const s = await getDoc(doc(db, path, id));
    return s.exists() ? ({ ...(s.data() as object), id: s.id } as T) : null;
  };
  const many = async <T>(path: string, ...c: QueryConstraint[]): Promise<T[]> => {
    const s = await getDocs(query(collection(db, path), ...c));
    return s.docs.map((d) => ({ ...(d.data() as object), id: d.id }) as T);
  };
  const chunk30 = (ids: string[]) => {
    const u = [...new Set(ids)];
    const out: string[][] = [];
    for (let i = 0; i < u.length; i += 30) out.push(u.slice(i, i + 30));
    return out;
  };
  const strip = <T extends object>(o: T) => {
    const { id: _id, ...rest } = o as T & { id?: string };
    void _id;
    return rest;
  };

  const api: Api = {
    mode: 'firebase',

    onAuth(cb) {
      return onAuthStateChanged(auth, async (u) => {
        if (!u) return cb(null);
        let phone = u.phoneNumber ?? '';
        // WhatsApp logins: the verified number comes in the login token (phone_number claim).
        if (!phone) {
          try {
            const c = (await u.getIdTokenResult()).claims;
            const p = c.phone_number ?? c.wa_phone;
            if (typeof p === 'string') phone = p;
          } catch { /* offline */ }
        }
        cb({ uid: u.uid, phone, email: u.email ?? '' });
      });
    },
    waLoginEnabled: !!WA_LOGIN_URL,
    async startWaLogin() {
      const r = await fetch(WA_LOGIN_URL + '/start', { method: 'POST' });
      if (!r.ok) throw new Error('wa-start ' + r.status);
      return r.json();
    },
    async checkWaLogin(session) {
      const r = await fetch(WA_LOGIN_URL + '/check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session }) });
      if (!r.ok) throw new Error('wa-check ' + r.status);
      const j = (await r.json()) as { status: 'waiting' | 'expired' | 'ok'; token?: string };
      if (j.status === 'expired') throw Object.assign(new Error('expired'), { code: 'wa/expired' });
      if (j.status !== 'ok' || !j.token) return false;
      await signInWithCustomToken(auth, j.token);
      return true;
    },
    async signInWithGoogle() {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      try {
        await signInWithPopup(auth, provider);
      } catch (e) {
        const code = (e as { code?: string }).code;
        // Installed apps and some phones block popups: fall back to a full-page redirect.
        if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
          await signInWithRedirect(auth, provider);
          return;
        }
        throw e;
      }
    },
    async signInWithEmail(email, password) {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    },
    async resetPassword(email) {
      await sendPasswordResetEmail(auth, email.trim());
    },
    async sendOtp(phone, containerId) {
      // Each attempt gets its own fresh element: a reCAPTCHA can't be rendered twice in one element.
      if (!verifier) {
        box?.remove();
        box = document.createElement('div');
        document.getElementById(containerId)?.appendChild(box);
        verifier = new RecaptchaVerifier(auth, box, { size: 'invisible' });
      }
      try {
        confirmation = await signInWithPhoneNumber(auth, phone, verifier);
      } catch (e) {
        try { verifier.clear(); } catch { /* already gone */ }
        verifier = null;
        box?.remove();
        box = null;
        throw e;
      }
    },
    async verifyOtp(code) {
      if (!confirmation) throw new Error('no-otp');
      await confirmation.confirm(code);
    },
    async signOut() {
      await signOut(auth);
    },

    async getProfile(uid) {
      const p = await one<UserProfile & { id: string }>('users', uid);
      return p ? { ...strip(p), uid } : null;
    },
    async saveProfile(p) {
      await setDoc(doc(db, 'users', p.uid), p);
    },
    async deleteMyData(uid) {
      await deleteDoc(doc(db, 'providers', uid)).catch(() => undefined);
      // The phone number must not stay in the blood-donor list or the ASHA directory after the person leaves.
      await deleteDoc(doc(db, 'bloodDonors', uid)).catch(() => undefined);
      await deleteDoc(doc(db, 'contacts', 'asha_' + uid)).catch(() => undefined);
      await deleteDoc(doc(db, 'users', uid));
      await auth.currentUser?.delete().catch(() => signOut(auth));
    },
    async findUserByPhone(phone) {
      const r = await many<UserProfile & { id: string }>('users', where('phone', '==', phone));
      return r[0] ? { ...strip(r[0]), uid: r[0].id } : null;
    },
    async findUserByEmail(email) {
      const r = await many<UserProfile & { id: string }>('users', where('email', '==', email.trim().toLowerCase()));
      return r[0] ? { ...strip(r[0]), uid: r[0].id } : null;
    },
    async getMyRoleRequest(uid) {
      const r = await one<RoleRequest & { id: string }>('roleRequests', uid);
      return r ? { ...strip(r), uid } : null;
    },
    async requestRole(r) {
      await setDoc(doc(db, 'roleRequests', r.uid), r);
    },
    async listRoleRequests(villageId) {
      const r = await many<RoleRequest & { id: string }>('roleRequests', where('status', '==', 'pending'), ...(villageId ? [where('villageId', '==', villageId)] : []));
      return r.map((x) => ({ ...strip(x), uid: x.id })).sort(byNewest);
    },
    async decideRoleRequest(r, approve) {
      const batch = writeBatch(db);
      batch.update(doc(db, 'roleRequests', r.uid), { status: approve ? 'approved' : 'rejected' });
      if (approve) batch.update(doc(db, 'users', r.uid), { role: 'coordinator', coordinatorOf: r.villageId, position: 'member' });
      await batch.commit();
    },
    async listCoordinators(villageId) {
      const r = villageId
        ? (await many<UserProfile & { id: string }>('users', where('coordinatorOf', '==', villageId))).filter((u) => u.role === 'coordinator')
        : await many<UserProfile & { id: string }>('users', where('role', '==', 'coordinator'));
      return r.map((u) => ({ ...strip(u), uid: u.id }));
    },
    async setRole(uid, role, coordinatorOf, position) {
      await updateDoc(doc(db, 'users', uid), { role, coordinatorOf, ...(position !== undefined ? { position } : {}) });
    },
    async listUsers() {
      const r = await many<UserProfile & { id: string }>('users');
      return r.map((u) => ({ ...strip(u), uid: u.id })).sort((a, b) => b.createdAt - a.createdAt);
    },
    async createStaffLogin(s) {
      // A second Firebase app makes the new login without signing the super admin out.
      const sec = initializeApp(firebaseConfig, 'staff-' + Date.now());
      const secAuth = getAuth(sec);
      try {
        const email = loginEmail(s.username);
        const cred = await createUserWithEmailAndPassword(secAuth, email, s.password);
        const now = Date.now();
        const p: UserProfile = {
          uid: cred.user.uid, name: s.name.trim(), phone: s.phone, villageId: s.villageId, ...(s.ward ? { ward: s.ward } : {}),
          lang: 'ml', role: 'coordinator', coordinatorOf: s.villageId, position: s.position, email,
          consent: { showContact: true, showPhoto: false, notify: true, at: now }, createdAt: now,
        };
        const { uid: _u, ...rest } = p; void _u;
        await setDoc(doc(db, 'users', p.uid), rest);
        return p;
      } finally {
        await signOut(secAuth).catch(() => undefined);
        await deleteApp(sec).catch(() => undefined);
      }
    },
    async changePassword(pw) {
      if (!auth.currentUser) throw new Error('not signed in');
      await updatePassword(auth.currentUser, pw);
    },

    async listVillages() {
      return many<Village>('villages');
    },
    async addVillage(v) {
      const r = await addDoc(collection(db, 'villages'), v);
      return { ...v, id: r.id };
    },
    async saveVillage(v) {
      await setDoc(doc(db, 'villages', v.id), strip(v));
    },

    async listApprovedProviders(category, villageIds) {
      // Only the asked-for villages are read (Firestore allows 30 values per 'in').
      const ids = [...new Set(villageIds)];
      const chunks: string[][] = [];
      for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30));
      const parts = await Promise.all(chunks.map((c) => many<Provider & { id: string }>('providers',
        where('villageId', 'in', c), where('status', '==', 'approved'), ...(category ? [where('category', '==', category)] : []))));
      return parts.flat().map((p) => ({ ...strip(p), uid: p.id }));
    },
    async listVillageProviders(villageId, status) {
      const c = [where('villageId', '==', villageId)];
      if (status) c.push(where('status', '==', status));
      const r = await many<Provider & { id: string }>('providers', ...c);
      return r.map((p) => ({ ...strip(p), uid: p.id })).sort(byNewest);
    },
    async getProvider(uid) {
      const p = await one<Provider & { id: string }>('providers', uid);
      return p ? { ...strip(p), uid } : null;
    },
    async saveProvider(p) {
      const ref = doc(db, 'providers', p.uid);
      const existing = await getDoc(ref);
      if (existing.exists()) {
        // Owners may not change status, verification or ratings.
        const { status: _s, verified: _v, ratingSum: _rs, ratingCount: _rc, lastReviewId: _l, uid: _u, ...editable } = p;
        void _s; void _v; void _rs; void _rc; void _l; void _u;
        await updateDoc(ref, editable);
      } else {
        const { uid: _u, ...rest } = p;
        void _u;
        await setDoc(ref, { ...rest, status: 'approved', verified: false, ratingSum: 0, ratingCount: 0 });
      }
    },
    async setAvailability(uid, until) {
      await updateDoc(doc(db, 'providers', uid), { availableUntil: until });
    },
    async reviewProvider(uid, status, verified) {
      await updateDoc(doc(db, 'providers', uid), { status, verified });
    },

    async listNews(villageId, opts) {
      const published = await many<News>('news', where('villageId', '==', villageId), where('status', '==', 'published'));
      const pending = opts?.includePending
        ? await many<News>('news', where('villageId', '==', villageId), where('status', '==', 'pending'))
        : [];
      return [...published, ...pending].sort(byNewest);
    },
    async getNews(id) {
      return one<News>('news', id);
    },
    async createNews(n) {
      await addDoc(collection(db, 'news'), n);
    },
    async setNewsStatus(id, status) {
      await updateDoc(doc(db, 'news', id), { status });
    },

    async createBooking(b) {
      const r = await addDoc(collection(db, 'bookings'), b);
      return r.id;
    },
    async getBooking(id) {
      return one<Booking>('bookings', id);
    },
    async listMyBookings(uid) {
      return (await many<Booking>('bookings', where('customerId', '==', uid))).sort(byNewest);
    },
    async listProviderBookings(uid) {
      return (await many<Booking>('bookings', where('providerId', '==', uid))).sort(byNewest);
    },
    async updateBookingStatus(id, status) {
      await updateDoc(doc(db, 'bookings', id), { status });
    },

    async addReview(booking, stars, comment, customerName) {
      // One review per booking (review id = booking id). Rules check the booking belongs to this customer.
      const batch = writeBatch(db);
      const review: Omit<Review, 'id'> = {
        providerId: booking.providerId, customerId: booking.customerId, customerName, stars, comment, createdAt: Date.now(),
      };
      batch.set(doc(db, 'reviews', booking.id), review);
      batch.update(doc(db, 'providers', booking.providerId), {
        ratingSum: increment(stars), ratingCount: increment(1), lastReviewId: booking.id,
      });
      batch.update(doc(db, 'bookings', booking.id), { rated: true });
      await batch.commit();
    },
    async listReviews(providerId) {
      return (await many<Review>('reviews', where('providerId', '==', providerId))).sort(byNewest);
    },
    async addOrderReview(r) {
      // One review per order and kind; the person's running total goes up in the same write (rules check both).
      const id = `${r.kind}_${r.enquiryId}`;
      const batch = writeBatch(db);
      batch.set(doc(db, 'orderReviews', id), { ...r, createdAt: Date.now() });
      batch.set(doc(db, 'ratingStats', `${r.kind}_${r.targetUid}`), { sum: increment(r.stars), count: increment(1), lastReviewId: id }, { merge: true });
      await batch.commit();
    },
    async listOrderReviews(kind, targetUid) {
      return (await many<OrderReview>('orderReviews', where('targetUid', '==', targetUid), where('kind', '==', kind))).sort(byNewest);
    },
    async listMyOrderReviews(uid) {
      return many<OrderReview>('orderReviews', where('fromUid', '==', uid));
    },
    async getRatingStats(kind, uids) {
      const ids = uids.filter(Boolean).map((u) => `${kind}_${u}`);
      if (!ids.length) return {};
      const parts = await Promise.all(chunk30(ids).map((c) => many<RatingStat & { id: string }>('ratingStats', where(documentId(), 'in', c))));
      const out: Record<string, RatingStat> = {};
      for (const s of parts.flat()) out[s.id.slice(kind.length + 1)] = { sum: s.sum, count: s.count };
      return out;
    },

    async createReport(r) {
      await addDoc(collection(db, 'reports'), r);
    },
    async listReports(villageId) {
      return (await many<Report>('reports', where('villageId', '==', villageId))).sort(byNewest);
    },
    async resolveReport(id) {
      await updateDoc(doc(db, 'reports', id), { status: 'resolved' });
    },

    async createComplaint(c) {
      await addDoc(collection(db, 'complaints'), strip(c));
    },
    async listMyComplaints(uid) {
      return (await many<Complaint>('complaints', where('fromUid', '==', uid))).sort(byNewest);
    },
    async listComplaints(villageId) {
      return (await many<Complaint>('complaints', where('villageId', '==', villageId))).sort(byNewest);
    },
    async replyComplaint(id, reply, byName, resolved) {
      await updateDoc(doc(db, 'complaints', id), { reply, repliedByName: byName, repliedAt: Date.now(), status: resolved ? 'resolved' : 'replied' });
    },
    async setComplaintStatus(id, status) {
      await updateDoc(doc(db, 'complaints', id), { status });
    },

    async villageStats(villageId) {
      const count = async (path: string, ...c: QueryConstraint[]) =>
        (await getCountFromServer(query(collection(db, path), ...c))).data().count;
      const [users, providers, bookings, pp, pn, pr] = await Promise.all([
        count('users', where('villageId', '==', villageId)),
        count('providers', where('villageId', '==', villageId), where('status', '==', 'approved')),
        count('bookings', where('villageId', '==', villageId)),
        count('providers', where('villageId', '==', villageId), where('status', '==', 'pending')),
        count('news', where('villageId', '==', villageId), where('status', '==', 'pending')),
        count('reports', where('villageId', '==', villageId), where('status', '==', 'open')),
      ]);
      return { users, providers, bookings, pending: pp + pn + pr };
    },

    // ---------- Directory, timings, blood donors ----------
    async listContacts(kind, villageIds, status = 'approved') {
      // A single village uses '==' so the security rules can check a village admin's pending list.
      const parts = await Promise.all(chunk30(villageIds).map((c) => many<Contact>('contacts',
        c.length === 1 ? where('villageId', '==', c[0]) : where('villageId', 'in', c), where('kind', '==', kind), where('status', '==', status))));
      return parts.flat().sort((a, b) => a.name.localeCompare(b.name));
    },
    async saveContact(c) {
      const { id, ...rest } = c;
      if (id) await setDoc(doc(db, 'contacts', id), rest);
      else await addDoc(collection(db, 'contacts'), rest);
    },
    async getContact(id) {
      return one<Contact>('contacts', id);
    },
    async deleteContact(id) {
      await deleteDoc(doc(db, 'contacts', id));
    },
    async listTimings(villageIds) {
      const parts = await Promise.all(chunk30(villageIds).map((c) => many<Timing>('timings', where('villageId', 'in', c))));
      return parts.flat().sort((a, b) => a.time.localeCompare(b.time));
    },
    async addTiming(t) {
      await addDoc(collection(db, 'timings'), t);
    },
    async deleteTiming(id) {
      await deleteDoc(doc(db, 'timings', id));
    },
    async listDonors(villageIds) {
      const parts = await Promise.all(chunk30(villageIds).map((c) => many<BloodDonor & { id: string }>('bloodDonors', where('villageId', 'in', c))));
      return parts.flat().map((d) => ({ ...strip(d), uid: d.id }));
    },
    async getDonor(uid) {
      const d = await one<BloodDonor & { id: string }>('bloodDonors', uid);
      return d ? { ...strip(d), uid } : null;
    },
    async saveDonor(d) {
      const { uid, ...rest } = d;
      await setDoc(doc(db, 'bloodDonors', uid), rest);
    },
    async deleteDonor(uid) {
      await deleteDoc(doc(db, 'bloodDonors', uid));
    },

    // ---------- Market, ads, payments ----------
    async getPaySettings() {
      const s = await one<PaySettings>('settings', 'pay');
      return { ...DEFAULT_PAY, ...(s ? strip(s) : {}) };
    },
    async savePaySettings(s) {
      await setDoc(doc(db, 'settings', 'pay'), s);
    },
    async getSeller(uid) {
      const s = await one<Seller & { id: string }>('sellers', uid);
      return s ? { ...strip(s), uid } : null;
    },
    async createSeller(s) {
      const { uid, ...rest } = s;
      await setDoc(doc(db, 'sellers', uid), rest);
    },
    async listSellers(uids) {
      const fix = (r: (Seller & { id: string })[]) => r.map((s) => ({ ...strip(s), uid: s.id }));
      if (!uids) return fix(await many<Seller & { id: string }>('sellers'));
      if (!uids.length) return [];
      const parts = await Promise.all(chunk30(uids).map((c) => many<Seller & { id: string }>('sellers', where(documentId(), 'in', c))));
      return fix(parts.flat());
    },
    async listListings(villageIds) {
      if (!villageIds) return (await many<Listing>('listings')).sort(byNewest);
      const parts = await Promise.all(chunk30(villageIds).map((c) => many<Listing>('listings', where('villageId', 'in', c), where('active', '==', true))));
      return parts.flat().sort(byNewest);
    },
    async listMyListings(uid) {
      return (await many<Listing>('listings', where('sellerUid', '==', uid))).sort(byNewest);
    },
    async saveListing(l) {
      const { id, ...rest } = l;
      if (id) await setDoc(doc(db, 'listings', id), rest);
      else await addDoc(collection(db, 'listings'), rest);
    },
    async deleteListing(id) {
      await deleteDoc(doc(db, 'listings', id));
    },
    async listLiveAds(villageIds) {
      const parts = await Promise.all(chunk30(villageIds).map((c) => many<Ad>('ads', where('villageId', 'in', c), where('status', '==', 'live'))));
      return parts.flat().filter((a) => a.until > Date.now()).sort(byNewest);
    },
    async listMyAds(uid) {
      return (await many<Ad>('ads', where('uid', '==', uid))).sort(byNewest);
    },
    async listAllAds() {
      return (await many<Ad>('ads')).sort(byNewest);
    },
    async createAd(a) {
      const r = await addDoc(collection(db, 'ads'), a);
      return r.id;
    },
    async deleteAd(id) {
      await deleteDoc(doc(db, 'ads', id));
    },
    async setAdStatus(id, status, until) {
      await updateDoc(doc(db, 'ads', id), { status, until });
    },
    async createPayment(p) {
      await addDoc(collection(db, 'payments'), p);
    },
    async listMyPayments(uid) {
      return (await many<Payment>('payments', where('uid', '==', uid))).sort(byNewest);
    },
    async listPayments() {
      return (await many<Payment>('payments')).sort(byNewest);
    },
    async decidePayment(p, approve, byName) {
      const now = Date.now();
      const batch = writeBatch(db);
      batch.update(doc(db, 'payments', p.id), { status: approve ? 'approved' : 'rejected', decidedBy: byName, decidedAt: now });
      if (approve && p.purpose === 'seller') {
        const s = await one<Seller>('sellers', p.uid);
        const from = Math.max(now, s?.paidUntil ?? 0, s?.freeUntil ?? 0);
        if (s) batch.update(doc(db, 'sellers', p.uid), { paidUntil: from + p.weeks * WEEK });
      }
      if (approve && p.purpose === 'delivery') {
        const b = await one<DeliveryBoy>('deliveryBoys', p.uid);
        const from = Math.max(now, b?.paidUntil ?? 0, b?.freeUntil ?? 0);
        if (b) batch.update(doc(db, 'deliveryBoys', p.uid), { paidUntil: from + p.weeks * WEEK });
      }
      if (p.purpose === 'ad' && p.adId) {
        const a = await one<Ad>('ads', p.adId);
        if (a) batch.update(doc(db, 'ads', p.adId), approve
          ? { status: 'live', until: Math.max(now, a.status === 'live' ? a.until : 0) + p.weeks * WEEK }
          : { status: a.status === 'live' ? 'live' : 'rejected' });
      }
      await batch.commit();
    },

    async getDeliveryBoy(uid) {
      const b = await one<DeliveryBoy & { id: string }>('deliveryBoys', uid);
      return b ? { ...strip(b), uid } : null;
    },
    async joinDelivery(b) {
      const { uid, ...rest } = b;
      await setDoc(doc(db, 'deliveryBoys', uid), rest);
    },
    async saveDeliveryBoy(uid, patch) {
      const { uid: _u, ...rest } = patch; void _u;
      await updateDoc(doc(db, 'deliveryBoys', uid), rest);
    },
    async listDeliveryBoys(villageIds) {
      const fix = (r: (DeliveryBoy & { id: string })[]) => r.map((b) => ({ ...strip(b), uid: b.id }));
      if (!villageIds) return fix(await many<DeliveryBoy & { id: string }>('deliveryBoys')).sort((a, b) => b.createdAt - a.createdAt);
      const parts = await Promise.all(chunk30(villageIds).map((c) => many<DeliveryBoy & { id: string }>('deliveryBoys', where('villageId', 'in', c), where('status', '==', 'active'))));
      return fix(parts.flat()).sort((a, b) => a.name.localeCompare(b.name));
    },
    async assignDelivery(d) {
      const ref = doc(db, 'deliveries', d.id);
      let had = false;
      try { had = (await getDoc(ref)).exists(); } catch { had = false; } // a missing doc can't be read (rules) → create it
      if (had) {
        await updateDoc(ref, { deliveryUid: d.deliveryUid, deliveryName: d.deliveryName, deliveryPhone: d.deliveryPhone, status: 'assigned', updatedAt: Date.now(),
          ...(d.pickupAddress ? { pickupAddress: d.pickupAddress } : {}), ...(d.pickupLat != null ? { pickupLat: d.pickupLat, pickupLng: d.pickupLng } : {}) });
      } else {
        await setDoc(ref, strip(d));
      }
    },
    async updateDelivery(id, patch) {
      const { id: _i, ...rest } = patch; void _i;
      await updateDoc(doc(db, 'deliveries', id), { ...rest, updatedAt: Date.now() });
    },
    async listDeliveries(by, uid) {
      const r = by ? await many<Delivery>('deliveries', where(by, '==', uid)) : await many<Delivery>('deliveries');
      return r.sort((a, b) => b.updatedAt - a.updatedAt);
    },

    async createEnquiry(e) {
      await addDoc(collection(db, 'enquiries'), e);
    },
    async listEnquiriesTo(uid) {
      return (await many<Enquiry>('enquiries', where('toUid', '==', uid))).sort((a, b) => b.updatedAt - a.updatedAt);
    },
    async listEnquiriesFrom(uid) {
      return (await many<Enquiry>('enquiries', where('fromUid', '==', uid))).sort((a, b) => b.updatedAt - a.updatedAt);
    },
    async updateEnquiry(id, status, reply) {
      await updateDoc(doc(db, 'enquiries', id), { status, updatedAt: Date.now(), ...(reply ? { replies: arrayUnion(reply) } : {}) });
    },
    async recordCash(p, byName) {
      const r = await addDoc(collection(db, 'payments'), { ...p, status: 'pending' });
      await this.decidePayment({ ...p, id: r.id, status: 'pending' }, true, byName);
    },

    async bulkImport(village, providers, contacts, onProgress) {
      if (village) await setDoc(doc(db, 'villages', village.id), strip(village));
      const ops: [string, string, object][] = [
        ...providers.map((p): [string, string, object] => { const { uid, ...rest } = p; return ['providers', uid, rest]; }),
        ...contacts.map((c): [string, string, object] => { const { id, ...rest } = c; return ['contacts', id, rest]; }),
      ];
      // Small batches: each write is checked by the security rules.
      for (let i = 0; i < ops.length; i += 100) {
        const batch = writeBatch(db);
        for (const [col, id, data] of ops.slice(i, i + 100)) batch.set(doc(db, col, id), strip(data));
        await batch.commit();
        onProgress?.(Math.min(i + 100, ops.length), ops.length);
      }
    },
  };

  // ---- Read cache: 30,000 residents on the free plan (50k reads a day) can't re-read every list on every screen. ----
  // Public lists are kept in memory for a few minutes; any write clears the cache so the user sees their own change at once.
  const CACHED: Partial<Record<keyof Api, number>> = {
    listVillages: 10, listApprovedProviders: 5, listContacts: 10, listTimings: 30, listDonors: 5,
    getPaySettings: 2, listSellers: 5, getRatingStats: 5, listDeliveryBoys: 2, listListings: 3, listLiveAds: 5, listNews: 3,
  }; // minutes
  const store = new Map<string, { at: number; v: Promise<unknown> }>();
  const out = api as unknown as Record<string, unknown>;
  for (const [name, fn] of Object.entries(api)) {
    if (typeof fn !== 'function') continue;
    const f = (fn as (...a: unknown[]) => Promise<unknown>).bind(api);
    const ttl = CACHED[name as keyof Api];
    if (ttl) {
      out[name] = (...args: unknown[]) => {
        // Admin views (pending news, owner's full lists) always read fresh.
        if (name === 'listNews' && (args[1] as { includePending?: boolean } | undefined)?.includePending) return f(...args);
        if (name === 'listListings' && args[0] === null) return f(...args);
        if (name === 'listSellers' && !args[0]) return f(...args);
        const key = name + JSON.stringify(args);
        const hit = store.get(key);
        if (hit && Date.now() - hit.at < ttl * 60000) return hit.v.then((v) => structuredClone(v));
        const v = f(...args);
        store.set(key, { at: Date.now(), v });
        v.catch(() => store.delete(key));
        return v.then((x) => structuredClone(x));
      };
    } else if (/^(save|create|add|delete|set|review|decide|record|reply|update|bulk|request|resolve|deleteMy|join|assign)/.test(name)) {
      out[name] = async (...args: unknown[]) => { try { return await f(...args); } finally { store.clear(); } };
    }
  }
  return api;
}
