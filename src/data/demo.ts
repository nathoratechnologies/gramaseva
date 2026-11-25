// Demo backend: keeps sample data in this browser only. No Firebase needed.
import type { Api } from './api';
import { byNewest } from './api';
import { makeSeed, type SeedData } from './seed';
import type { Booking, Provider, RoleRequest, UserProfile, Contact, Timing, BloodDonor, Complaint, Listing, Seller, Ad, Payment, PaySettings, Enquiry, DeliveryBoy, Delivery, OrderReview, RatingStat } from '../types';
import { DEFAULT_PAY, WEEK } from '../types';
import type { AuthUser } from './api';

const KEY = 'gramaseva-demo-v1';
export const DEMO_OTP = '123456';

function load(): SeedData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as SeedData;
  } catch { /* storage blocked: fall back to fresh sample data */ }
  return makeSeed();
}

const readPins = (): Record<string, string> => { try { return JSON.parse(localStorage.getItem(KEY + '-pins') ?? '{}'); } catch { return {}; } };

export function createDemoApi(): Api {
  let db = load();
  let session: AuthUser | null = null;
  let roleRequests: RoleRequest[] = [];
  let pendingPhone: string | null = null;
  let waStarted: { session: string; at: number } | null = null;
  const listeners = new Set<(u: AuthUser | null) => void>();

  try {
    const s = localStorage.getItem(KEY + '-session');
    if (s) session = JSON.parse(s);
  } catch { /* ignore */ }

  type Extra = { contacts: Contact[]; timings: Timing[]; donors: BloodDonor[]; complaints: Complaint[]; listings: Listing[]; sellers: Seller[]; ads: Ad[]; payments: Payment[]; pay: PaySettings; enquiries: Enquiry[]; boys: DeliveryBoy[]; deliveries: Delivery[]; orderReviews: OrderReview[] };
  let extra: Extra = { contacts: [], timings: [], donors: [], complaints: [], listings: [], sellers: [], ads: [], payments: [], pay: { ...DEFAULT_PAY, upiId: 'demo@upi' }, enquiries: [], boys: [], deliveries: [], orderReviews: [] };
  try { const e = localStorage.getItem(KEY + '-extra'); if (e) extra = { ...extra, ...JSON.parse(e) }; } catch { /* ignore */ }
  const saveExtra = () => { try { localStorage.setItem(KEY + '-extra', JSON.stringify(extra)); } catch { /* ignore */ } };

  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
      localStorage.setItem(KEY + '-session', JSON.stringify(session));
    } catch { /* ignore */ }
  };
  const emit = () => listeners.forEach((l) => l(session));
  const wait = <T>(v: T) => new Promise<T>((r) => setTimeout(() => r(structuredClone(v)), 120));
  const id = () => Math.random().toString(36).slice(2, 10);

  const api: Api = {
    mode: 'demo',

    onAuth(cb) {
      listeners.add(cb);
      setTimeout(() => cb(session), 0);
      return () => listeners.delete(cb);
    },
    async signInWithGoogle() {
      await wait(null);
      session = { uid: 'me-google-demo', phone: '', email: 'demo@example.com' };
      save();
      emit();
    },
    async signInWithEmail(email, password) {
      await wait(null);
      if (!email.includes('@') || password.length < 6) throw Object.assign(new Error('bad'), { code: 'auth/invalid-credential' });
      session = { uid: 'me-email-' + email.replace(/\W/g, ''), phone: '', email };
      save();
      emit();
    },
    async resetPassword() { await wait(null); },
    async signInWithMobilePin(ten, pin) {
      await wait(null);
      const pins = readPins();
      if (pins[ten] !== pin) throw Object.assign(new Error('bad'), { code: 'auth/invalid-credential' });
      session = { uid: 'me-m' + ten, phone: '+91' + ten, email: '' };
      save(); emit();
    },
    async registerMobilePin(ten, pin) {
      await wait(null);
      const pins = readPins();
      if (pins[ten]) throw Object.assign(new Error('exists'), { code: 'auth/email-already-in-use' });
      pins[ten] = pin;
      try { localStorage.setItem(KEY + '-pins', JSON.stringify(pins)); } catch { /* ignore */ }
      session = { uid: 'me-m' + ten, phone: '+91' + ten, email: '' };
      save(); emit();
    },
    async sendOtp(phone) {
      pendingPhone = phone;
      await wait(null);
    },
    async verifyOtp(code) {
      await wait(null);
      if (code !== DEMO_OTP || !pendingPhone) throw new Error('bad-code');
      session = { uid: 'me-' + pendingPhone.replace(/\D/g, ''), phone: pendingPhone, email: '' };
      save();
      emit();
    },
    waLoginEnabled: false, // like the real app until the WhatsApp server is set up (startWaLogin below still works for testing)
    async startWaLogin() {
      await wait(null);
      const code = Math.random().toString(36).slice(2, 8).toUpperCase();
      waStarted = { session: 'demo-' + code, at: Date.now() };
      return { session: waStarted.session, code, text: `GRAMASEVA LOGIN ${code}`, waNumber: '919000000000', expiresAt: Date.now() + 600000 };
    },
    async checkWaLogin(sid) {
      await wait(null);
      // Demo: the "message" arrives 4 seconds after the start.
      if (!waStarted || waStarted.session !== sid || Date.now() - waStarted.at < 4000) return false;
      waStarted = null;
      session = { uid: 'me-wa-demo', phone: '+919446000111', email: '' };
      save();
      emit();
      return true;
    },
    async signOut() {
      session = null;
      save();
      emit();
    },

    async getProfile(uid) {
      return wait(db.users.find((u) => u.uid === uid) ?? null);
    },
    async saveProfile(p) {
      // In the demo every new user is a super admin, so the admin panel can be tried out.
      const existing = db.users.find((u) => u.uid === p.uid);
      const next: UserProfile = existing ? p : { ...p, role: 'superadmin' };
      db.users = [...db.users.filter((u) => u.uid !== p.uid), next];
      save();
      await wait(null);
    },
    async deleteMyData(uid) {
      db.users = db.users.filter((u) => u.uid !== uid);
      db.providers = db.providers.filter((p) => p.uid !== uid);
      db.bookings = db.bookings.filter((b) => b.customerId !== uid && b.providerId !== uid);
      extra.donors = extra.donors.filter((d) => d.uid !== uid);
      extra.contacts = extra.contacts.filter((c) => c.id !== 'asha_' + uid);
      saveExtra();
      session = null;
      save();
      emit();
    },
    async findUserByPhone(phone) {
      return wait(db.users.find((u) => u.phone === phone) ?? null);
    },
    async findUserByEmail(email) {
      return wait(db.users.find((u) => u.email === email) ?? null);
    },
    async getMyRoleRequest(uid) {
      return wait(roleRequests.find((r) => r.uid === uid) ?? null);
    },
    async requestRole(r) {
      roleRequests = [...roleRequests.filter((x) => x.uid !== r.uid), r];
    },
    async listRoleRequests(villageId) {
      return wait([...roleRequests, {
        uid: 'u-kumaran', name: 'കുമാരൻ (ഉദാഹരണം)', phone: '+919000000202', villageId: 'kizhakkemuri',
        position: 'വാർഡ് 5 മെമ്പർ', note: 'വാർഡിലെ അറിയിപ്പുകൾ ഇടാൻ', status: 'pending' as const, createdAt: Date.now() - 3600_000,
      }].filter((r, i, a) => a.findIndex((x) => x.uid === r.uid) === i).filter((r) => r.status === 'pending' && (!villageId || r.villageId === villageId)).sort(byNewest));
    },
    async decideRoleRequest(r, approve) {
      roleRequests = [...roleRequests.filter((x) => x.uid !== r.uid), { ...r, status: approve ? 'approved' : 'rejected' }];
      if (approve) db.users = db.users.map((u) => (u.uid === r.uid ? { ...u, role: 'coordinator', coordinatorOf: r.villageId, position: 'member' } : u));
      save();
    },
    async listCoordinators(villageId) {
      return wait(db.users.filter((u) => u.role === 'coordinator' && (!villageId || u.coordinatorOf === villageId)));
    },
    async setRole(uid, role, coordinatorOf, position) {
      db.users = db.users.map((u) => (u.uid === uid ? { ...u, role, coordinatorOf, ...(position !== undefined ? { position } : {}) } : u));
      save();
    },
    async listUsers() {
      return wait([...db.users].sort((a, b) => b.createdAt - a.createdAt));
    },
    async createStaffLogin(s) {
      const email = s.username.includes('@') ? s.username.toLowerCase() : `${s.username.toLowerCase()}@gramaseva.app`;
      if (db.users.some((u) => u.email === email)) throw Object.assign(new Error('exists'), { code: 'auth/email-already-in-use' });
      const now = Date.now();
      const p: UserProfile = { uid: 'staff-' + now, name: s.name, phone: s.phone, villageId: s.villageId, ...(s.ward ? { ward: s.ward } : {}), lang: 'ml',
        role: 'coordinator', coordinatorOf: s.villageId, position: s.position, email, consent: { showContact: true, showPhoto: false, notify: true, at: now }, createdAt: now };
      db.users = [...db.users, p]; save();
      return wait(p);
    },
    async changePassword() { await wait(null); },

    async listVillages() {
      return wait(db.villages);
    },
    async addVillage(v) {
      const nv = { ...v, id: id() };
      db.villages = [...db.villages, nv];
      save();
      return wait(nv);
    },
    async saveVillage(v) {
      db.villages = [...db.villages.filter((x) => x.id !== v.id), v];
      save();
    },

    async listApprovedProviders(category, villageIds) {
      return wait(db.providers.filter((p) => (!category || p.category === category) && p.status === 'approved' && villageIds.includes(p.villageId)));
    },
    async listVillageProviders(villageId, status) {
      return wait(db.providers.filter((p) => p.villageId === villageId && (!status || p.status === status)).sort(byNewest));
    },
    async getProvider(uid) {
      return wait(db.providers.find((p) => p.uid === uid) ?? null);
    },
    async saveProvider(p) {
      const isNew = !db.providers.some((x) => x.uid === p.uid);
      db.providers = [...db.providers.filter((x) => x.uid !== p.uid), p];
      if (isNew) {
        // Give the new provider a sample request so the dashboard has something to show.
        db.bookings.push({
          id: id(), type: 'service', customerId: 'u-leela', customerName: 'ലീല എം. (ഉദാഹരണം)', customerPhone: '+919000000201',
          providerId: p.uid, providerName: p.name, providerPhone: p.phone, villageId: p.villageId, category: p.category,
          date: new Date(Date.now() + 86400000).toISOString().slice(0, 10), slot: 'noon',
          details: 'ഇതൊരു ഉദാഹരണ request ആണ്.', status: 'requested', rated: false, createdAt: Date.now(),
        });
      }
      save();
      await wait(null);
    },
    async setAvailability(uid, until) {
      db.providers = db.providers.map((p) => (p.uid === uid ? { ...p, availableUntil: until } : p));
      save();
    },
    async reviewProvider(uid, status, verified) {
      db.providers = db.providers.map((p) => (p.uid === uid ? { ...p, status, verified } : p));
      save();
    },

    async listNews(villageId, opts) {
      return wait(
        db.news
          .filter((n) => n.villageId === villageId && (n.status === 'published' || (opts?.includePending && n.status === 'pending')))
          .sort(byNewest),
      );
    },
    async getNews(nid) {
      return wait(db.news.find((n) => n.id === nid) ?? null);
    },
    async createNews(n) {
      db.news.push({ ...n, id: id() });
      save();
    },
    async setNewsStatus(nid, status) {
      db.news = db.news.map((n) => (n.id === nid ? { ...n, status } : n));
      save();
    },

    async createBooking(b) {
      const bid = id();
      db.bookings.push({ ...b, id: bid });
      save();
      // Sample providers "accept" after a few seconds so the flow can be seen.
      if (!b.providerId.startsWith('me-')) {
        setTimeout(() => {
          db.bookings = db.bookings.map((x) => (x.id === bid && x.status === 'requested' ? { ...x, status: 'accepted' } : x));
          save();
        }, 4000);
      }
      return bid;
    },
    async getBooking(bid) {
      return wait(db.bookings.find((b) => b.id === bid) ?? null);
    },
    async listMyBookings(uid) {
      return wait(db.bookings.filter((b) => b.customerId === uid).sort(byNewest));
    },
    async listProviderBookings(uid) {
      return wait(db.bookings.filter((b) => b.providerId === uid).sort(byNewest));
    },
    async updateBookingStatus(bid, status) {
      db.bookings = db.bookings.map((b) => (b.id === bid ? { ...b, status } : b));
      save();
    },

    async addReview(booking: Booking, stars, comment, customerName) {
      db.reviews.push({ id: booking.id, providerId: booking.providerId, customerId: booking.customerId, customerName, stars, comment, createdAt: Date.now() });
      db.providers = db.providers.map((p: Provider) =>
        p.uid === booking.providerId ? { ...p, ratingSum: p.ratingSum + stars, ratingCount: p.ratingCount + 1, lastReviewId: booking.id } : p,
      );
      db.bookings = db.bookings.map((b) => (b.id === booking.id ? { ...b, rated: true, status: 'done' } : b));
      save();
    },
    async listReviews(providerId) {
      return wait(db.reviews.filter((r) => r.providerId === providerId).sort(byNewest));
    },

    async addOrderReview(r) {
      const rid = `${r.kind}_${r.enquiryId}`;
      if (extra.orderReviews.some((x) => x.id === rid)) throw new Error('already reviewed');
      extra.orderReviews.push({ ...r, id: rid, createdAt: Date.now() });
      saveExtra();
      await wait(null);
    },
    async listOrderReviews(kind, targetUid) {
      return wait(extra.orderReviews.filter((r) => r.kind === kind && r.targetUid === targetUid).sort(byNewest));
    },
    async listMyOrderReviews(uid) {
      return wait(extra.orderReviews.filter((r) => r.fromUid === uid));
    },
    async getRatingStats(kind, uids) {
      const out: Record<string, RatingStat> = {};
      for (const r of extra.orderReviews) {
        if (r.kind !== kind || !uids.includes(r.targetUid)) continue;
        const s = (out[r.targetUid] ??= { sum: 0, count: 0 });
        s.sum += r.stars; s.count += 1;
      }
      return wait(out);
    },

    async createReport(r) {
      db.reports.push({ ...r, id: id() });
      save();
    },
    async listReports(villageId) {
      return wait(db.reports.filter((r) => r.villageId === villageId).sort(byNewest));
    },
    async resolveReport(rid) {
      db.reports = db.reports.map((r) => (r.id === rid ? { ...r, status: 'resolved' } : r));
      save();
    },

    async createComplaint(c) {
      extra.complaints.push({ ...c, id: id() });
      saveExtra();
      await wait(null);
    },
    async listMyComplaints(uid) {
      return wait(extra.complaints.filter((c) => c.fromUid === uid).sort(byNewest));
    },
    async listComplaints(villageId) {
      return wait(extra.complaints.filter((c) => c.villageId === villageId).sort(byNewest));
    },
    async replyComplaint(cid, reply, byName, resolved) {
      extra.complaints = extra.complaints.map((c) => (c.id === cid ? { ...c, reply, repliedByName: byName, repliedAt: Date.now(), status: resolved ? 'resolved' : 'replied' } : c));
      saveExtra();
      await wait(null);
    },
    async setComplaintStatus(cid, status) {
      extra.complaints = extra.complaints.map((c) => (c.id === cid ? { ...c, status } : c));
      saveExtra();
      await wait(null);
    },

    async villageStats(villageId) {
      const pending =
        db.providers.filter((p) => p.villageId === villageId && p.status === 'pending').length +
        db.news.filter((n) => n.villageId === villageId && n.status === 'pending').length +
        db.reports.filter((r) => r.villageId === villageId && r.status === 'open').length;
      return wait({
        users: db.users.filter((u) => u.villageId === villageId).length,
        providers: db.providers.filter((p) => p.villageId === villageId && p.status === 'approved').length,
        bookings: db.bookings.filter((b) => b.villageId === villageId).length,
        pending,
      });
    },

    // ---------- Directory, timings, blood donors (kept in a separate store) ----------
    async listContacts(kind, villageIds, status = 'approved') {
      return wait(extra.contacts.filter((c) => c.kind === kind && c.status === status && villageIds.includes(c.villageId)).sort((a, b) => a.name.localeCompare(b.name)));
    },
    async saveContact(c) {
      const cid = c.id ?? id();
      extra.contacts = [...extra.contacts.filter((x) => x.id !== cid), { ...c, id: cid } as Contact];
      saveExtra();
    },
    async getContact(cid) {
      return wait(extra.contacts.find((c) => c.id === cid) ?? null);
    },
    async deleteContact(cid) {
      extra.contacts = extra.contacts.filter((x) => x.id !== cid);
      saveExtra();
    },
    async listTimings(villageIds) {
      return wait(extra.timings.filter((t) => villageIds.includes(t.villageId)).sort((a, b) => a.time.localeCompare(b.time)));
    },
    async addTiming(t) {
      extra.timings.push({ ...t, id: id() });
      saveExtra();
    },
    async deleteTiming(tid) {
      extra.timings = extra.timings.filter((x) => x.id !== tid);
      saveExtra();
    },
    async listDonors(villageIds) {
      return wait(extra.donors.filter((d) => villageIds.includes(d.villageId)));
    },
    async getDonor(uid) {
      return wait(extra.donors.find((d) => d.uid === uid) ?? null);
    },
    async saveDonor(d) {
      extra.donors = [...extra.donors.filter((x) => x.uid !== d.uid), d];
      saveExtra();
    },
    async deleteDonor(uid) {
      extra.donors = extra.donors.filter((x) => x.uid !== uid);
      saveExtra();
    },

    // ---------- Market, ads, payments ----------
    async getPaySettings() { return wait(extra.pay); },
    async savePaySettings(s) { extra.pay = s; saveExtra(); },
    async getSeller(uid) { return wait(extra.sellers.find((s) => s.uid === uid) ?? null); },
    async createSeller(s) { extra.sellers = [...extra.sellers.filter((x) => x.uid !== s.uid), s]; saveExtra(); },
    async listSellers(uids) { return wait(uids ? extra.sellers.filter((s) => uids.includes(s.uid)) : extra.sellers); },
    async listListings(villageIds) {
      return wait(extra.listings.filter((l) => !villageIds || (l.active && villageIds.includes(l.villageId))).sort(byNewest));
    },
    async listMyListings(uid) { return wait(extra.listings.filter((l) => l.sellerUid === uid).sort(byNewest)); },
    async saveListing(l) {
      const lid = l.id ?? id();
      extra.listings = [...extra.listings.filter((x) => x.id !== lid), { ...l, id: lid } as Listing];
      saveExtra();
    },
    async deleteListing(lid) { extra.listings = extra.listings.filter((x) => x.id !== lid); saveExtra(); },
    async listLiveAds(villageIds) {
      return wait(extra.ads.filter((a) => a.status === 'live' && a.until > Date.now() && villageIds.includes(a.villageId)).sort(byNewest));
    },
    async listMyAds(uid) { return wait(extra.ads.filter((a) => a.uid === uid).sort(byNewest)); },
    async listAllAds() { return wait([...extra.ads].sort(byNewest)); },
    async createAd(a) { const aid = id(); extra.ads = [...extra.ads, { ...a, id: aid }]; saveExtra(); return wait(aid); },
    async deleteAd(aid) { extra.ads = extra.ads.filter((x) => x.id !== aid); saveExtra(); },
    async setAdStatus(aid, status, until) { extra.ads = extra.ads.map((a) => (a.id === aid ? { ...a, status, until } : a)); saveExtra(); },
    async createPayment(p) { extra.payments = [...extra.payments, { ...p, id: id() }]; saveExtra(); },
    async listMyPayments(uid) { return wait(extra.payments.filter((p) => p.uid === uid).sort(byNewest)); },
    async listPayments() { return wait([...extra.payments].sort(byNewest)); },
    async decidePayment(p, approve, byName) {
      const now = Date.now();
      extra.payments = extra.payments.map((x) => (x.id === p.id ? { ...x, status: approve ? 'approved' : 'rejected', decidedBy: byName, decidedAt: now } : x));
      if (approve && p.purpose === 'seller') {
        extra.sellers = extra.sellers.map((s) => (s.uid === p.uid ? { ...s, paidUntil: Math.max(now, s.paidUntil, s.freeUntil) + p.weeks * WEEK } : s));
      }
      if (approve && p.purpose === 'delivery') {
        extra.boys = extra.boys.map((b) => (b.uid === p.uid ? { ...b, paidUntil: Math.max(now, b.paidUntil, b.freeUntil) + p.weeks * WEEK } : b));
      }
      if (p.purpose === 'ad' && p.adId) {
        extra.ads = extra.ads.map((a) => (a.id !== p.adId ? a : approve
          ? { ...a, status: 'live', until: Math.max(now, a.status === 'live' ? a.until : 0) + p.weeks * WEEK }
          : { ...a, status: a.status === 'live' ? 'live' : 'rejected' }));
      }
      saveExtra();
      await wait(null);
    },

    async getDeliveryBoy(uid) { return wait(extra.boys.find((b) => b.uid === uid) ?? null); },
    async joinDelivery(b) { extra.boys = [...extra.boys.filter((x) => x.uid !== b.uid), b]; saveExtra(); },
    async saveDeliveryBoy(uid, patch) { extra.boys = extra.boys.map((b) => (b.uid === uid ? { ...b, ...patch, uid } : b)); saveExtra(); },
    async listDeliveryBoys(villageIds) {
      return wait(villageIds ? extra.boys.filter((b) => b.status === 'active' && villageIds.includes(b.villageId)) : [...extra.boys].sort((a, b) => b.createdAt - a.createdAt));
    },
    async assignDelivery(d) {
      const old = extra.deliveries.find((x) => x.id === d.id);
      extra.deliveries = [...extra.deliveries.filter((x) => x.id !== d.id), old ? { ...old, deliveryUid: d.deliveryUid, deliveryName: d.deliveryName, deliveryPhone: d.deliveryPhone, status: 'assigned', updatedAt: Date.now() } : d];
      saveExtra();
    },
    async updateDelivery(did, patch) { extra.deliveries = extra.deliveries.map((x) => (x.id === did ? { ...x, ...patch, id: did, updatedAt: Date.now() } : x)); saveExtra(); },
    async trackLocation(did, at) {
      extra.deliveries = extra.deliveries.map((x) => (x.id === did ? { ...x, liveLat: at.lat, liveLng: at.lng, liveAt: Date.now() } : x));
      saveExtra();
    },
    watchDelivery(did, cb) {
      const send = () => {
        // Demo: the bike moves a little towards the customer each time.
        let d = extra.deliveries.find((x) => x.id === did) ?? null;
        if (d && (d.status === 'accepted' || d.status === 'picked') && d.lat != null && d.lng != null) {
          const from = d.liveLat != null ? { lat: d.liveLat, lng: d.liveLng! } : { lat: d.pickupLat ?? d.lat + 0.02, lng: d.pickupLng ?? d.lng + 0.02 };
          d = { ...d, liveLat: from.lat + (d.lat - from.lat) * 0.15, liveLng: from.lng + (d.lng - from.lng) * 0.15, liveAt: Date.now() };
          const next = d;
          extra.deliveries = extra.deliveries.map((x) => (x.id === did ? next : x));
          saveExtra();
        }
        cb(d ? structuredClone(d) : null);
      };
      send();
      const t = setInterval(send, 3000);
      return () => clearInterval(t);
    },
    async listDeliveries(by, uid) {
      return wait(extra.deliveries.filter((d) => !by || d[by] === uid).sort((a, b) => b.updatedAt - a.updatedAt));
    },
    async createEnquiry(e) { extra.enquiries = [...extra.enquiries, { ...e, id: id() }]; saveExtra(); },
    async listEnquiriesTo(uid) { return wait(extra.enquiries.filter((e) => e.toUid === uid).sort((a, b) => b.updatedAt - a.updatedAt)); },
    async listEnquiriesFrom(uid) { return wait(extra.enquiries.filter((e) => e.fromUid === uid).sort((a, b) => b.updatedAt - a.updatedAt)); },
    async updateEnquiry(eid, status, reply) {
      extra.enquiries = extra.enquiries.map((e) => (e.id === eid ? { ...e, status, updatedAt: Date.now(), replies: reply ? [...e.replies, reply] : e.replies } : e));
      saveExtra();
    },
    async recordCash(p, byName) {
      const pid = id();
      extra.payments = [...extra.payments, { ...p, id: pid, status: 'pending' }];
      await api.decidePayment({ ...p, id: pid, status: 'pending' }, true, byName);
    },

    async bulkImport(village, providers, contacts, onProgress) {
      if (village) db.villages = [...db.villages.filter((x) => x.id !== village.id), village];
      const pids = new Set(providers.map((p) => p.uid));
      db.providers = [...db.providers.filter((p) => !pids.has(p.uid)), ...providers];
      save();
      const cids = new Set(contacts.map((c) => c.id));
      extra.contacts = [...extra.contacts.filter((c) => !cids.has(c.id)), ...contacts];
      saveExtra();
      onProgress?.(providers.length + contacts.length, providers.length + contacts.length);
      await wait(null);
    },
  };

  return api;
}

/** Wipe demo data (used by the "reset demo" button). */
export function resetDemo() {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(KEY + '-session');
    localStorage.removeItem(KEY + '-extra');
  } catch { /* ignore */ }
}
