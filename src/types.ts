export type Lang = 'ml' | 'en';
export type Role = 'user' | 'coordinator' | 'superadmin';
export type StaffPosition = 'president' | 'vice' | 'member';
export const POSITION_LABEL: Record<StaffPosition, [string, string]> = {
  president: ['പഞ്ചായത്ത് പ്രസിഡന്റ്', 'Panchayat President'],
  vice: ['വൈസ് പ്രസിഡന്റ്', 'Vice President'],
  member: ['വാർഡ് മെമ്പർ', 'Ward member'],
};
/** President / vice president: can approve ward members of their panchayat. */
export const isHeadPos = (p?: StaffPosition | null) => p === 'president' || p === 'vice';
/** Login details the super admin types when making an account for a president / VP / ward member. */
export interface StaffLogin { username: string; password: string; name: string; phone: string; villageId: string; ward?: string; position: StaffPosition }

export type WorkCategory = 'plumbing' | 'electrical' | 'welding' | 'coconut' | 'farming' | 'other';
export type VehicleCategory = 'auto' | 'car4' | 'car7' | 'goods' | 'traveller' | 'tourbus' | 'houseboat';
export type ShopCategory = 'bakery' | 'restaurant' | 'furniture' | 'supermarket' | 'dress' | 'footwear' | 'ladies' | 'medical' | 'hardware' | 'stationery' | 'mobile' | 'jewellery' | 'shopother';
export type Category = WorkCategory | VehicleCategory | ShopCategory;

export const WORK_CATS: WorkCategory[] = ['plumbing', 'electrical', 'welding', 'coconut', 'farming', 'other'];
export const VEHICLE_CATS: VehicleCategory[] = ['auto', 'car4', 'car7', 'goods', 'traveller', 'tourbus', 'houseboat'];
export const SHOP_CATS: ShopCategory[] = ['bakery', 'restaurant', 'furniture', 'supermarket', 'dress', 'footwear', 'ladies', 'medical', 'hardware', 'stationery', 'mobile', 'jewellery', 'shopother'];
export const isShop = (c: Category): c is ShopCategory => (SHOP_CATS as Category[]).includes(c);
export const isVehicle = (c: Category): c is VehicleCategory => (VEHICLE_CATS as Category[]).includes(c);

export interface Village {
  id: string;
  name: string; // Malayalam
  nameEn: string;
  panchayat: string;
  district: string;
  status: 'live' | 'soon';
  lat: number;
  lng: number;
  panchayatPhone?: string;
  createdBy?: string;
  wards?: Ward[];
}

/** One ward of a panchayat, with its elected member. */
export interface Ward {
  no: number;
  name: string; // Malayalam
  nameEn: string;
  member: string;
  role: string; // Member / President / Vice President
}

export interface Consent {
  showContact: boolean;
  showPhoto: boolean;
  notify: boolean;
  at: number;
}

export interface UserProfile {
  uid: string;
  name: string;
  phone: string; // E.164, e.g. +919876543210
  villageId: string;
  ward?: string;
  lang: Lang;
  role: Role;
  coordinatorOf?: string | null;
  /** For coordinators: panchayat president, vice president or ward member. */
  position?: StaffPosition | null;
  email?: string;
  consent?: Consent;
  /** 6-digit India PIN code of the person's home (required for new profiles). */
  pincode?: string;
  /** Centre of the PIN code area (for "near me"), when it could be found. */
  pinLat?: number;
  pinLng?: number;
  /** Post office / place name of the PIN code. */
  pinPlace?: string;
  createdAt: number;
}

export type ProviderStatus = 'pending' | 'approved' | 'rejected' | 'blocked';

export interface Provider {
  uid: string;
  name: string;
  phone: string;
  villageId: string;
  category: Category;
  rate: number;
  rateUnit: 'day' | 'job' | 'km';
  radiusKm: number;
  lat: number;
  lng: number;
  availableUntil: number; // ms timestamp; "free now" while in the future
  status: ProviderStatus;
  verified: boolean;
  ratingSum: number;
  ratingCount: number;
  lastReviewId?: string;
  ward?: string;
  /** Own job name when category is 'other' (e.g. Stage decoration, Light & sound). */
  jobTitle?: string;
  /** Shops / businesses: name, address and opening hours. */
  shopName?: string;
  address?: string;
  openHours?: string;
  experienceYears?: number;
  vehicleNo?: string;
  about?: string;
  /** Added by the super admin from the Excel sheet (no app account): call only, no booking. */
  imported?: boolean;
  pincode?: string;
  createdAt: number;
}

export type NewsCat = 'panchayat' | 'outage' | 'festival' | 'obituary' | 'jobs' | 'farming';
export const NEWS_CATS: NewsCat[] = ['panchayat', 'outage', 'festival', 'obituary', 'jobs', 'farming'];

export interface News {
  id: string;
  villageId: string;
  title: string;
  body: string;
  category: NewsCat;
  ward?: string; // empty = whole panchayat
  important: boolean;
  status: 'pending' | 'published' | 'rejected';
  postedBy: string;
  postedByName: string;
  createdAt: number;
}

export type BookingStatus = 'requested' | 'accepted' | 'rejected' | 'done' | 'cancelled';

export interface Booking {
  id: string;
  type: 'service' | 'ride';
  customerId: string;
  customerName: string;
  customerPhone: string;
  providerId: string;
  providerName: string;
  providerPhone: string;
  villageId: string;
  category: Category;
  date: string; // YYYY-MM-DD
  slot: string; // 'now' | 'morning' | 'noon' | 'evening' | 'HH:MM'
  details: string;
  from?: string;
  to?: string;
  status: BookingStatus;
  rated: boolean;
  createdAt: number;
}

export interface Review {
  id: string; // = bookingId, so one review per booking
  providerId: string;
  customerId: string;
  customerName: string;
  stars: number;
  comment: string;
  createdAt: number;
}

/** Review of a shop / seller or a delivery person after an order (id = `${kind}_${enquiryId}`: one each per order). */
export type OrderReviewKind = 'shop' | 'delivery';
export interface OrderReview {
  id: string;
  kind: OrderReviewKind;
  enquiryId: string;
  targetUid: string; // shop owner / seller, or delivery person
  targetName: string;
  fromUid: string;
  fromName: string;
  stars: number;
  comment: string;
  createdAt: number;
}
/** Running total of a person's order reviews (id = `${kind}_${uid}`). */
export interface RatingStat { sum: number; count: number }
export const statAvg = (s: RatingStat | undefined) => (s?.count ? Math.round((s.sum / s.count) * 10) / 10 : 0);

export interface Report {
  id: string;
  reportedBy: string;
  reporterName: string;
  againstId: string;
  againstName: string;
  villageId: string;
  reason: string;
  status: 'open' | 'resolved';
  createdAt: number;
}

export type RoleRequestStatus = 'pending' | 'approved' | 'rejected';

/** A resident asking to become a village coordinator (e.g. a ward member). One per user (id = uid). */
export interface RoleRequest {
  uid: string;
  name: string;
  phone: string;
  villageId: string;
  position: string; // e.g. "വാർഡ് 7 മെമ്പർ"
  note: string;
  status: RoleRequestStatus;
  createdAt: number;
}

export interface VillageStats {
  users: number;
  providers: number;
  bookings: number;
  pending: number;
}

// ---------- Panchayat directory: hospitals, schools, ASHA workers, offices ----------
export type ContactKind = 'hospital' | 'school' | 'asha' | 'office';
export const CONTACT_KINDS: ContactKind[] = ['hospital', 'school', 'asha', 'office'];
/** English text for built-in (seeded) entries; users' own entries stay as typed. */
export type EnText = Partial<Record<'name' | 'address' | 'note' | 'from' | 'to' | 'stop' | 'days', string>>;
export interface Contact {
  en?: EnText;
  id: string;
  villageId: string;
  kind: ContactKind;
  name: string;
  phone: string;
  phone2?: string;
  ward?: string;
  address?: string;
  note?: string; // e.g. "24 hours", "OP 9–1", "LP school"
  uid?: string; // ASHA worker who applied from her own account
  status: 'approved' | 'pending';
  createdBy: string;
  createdAt: number;
}

// ---------- Train / bus / boat timings ----------
export type TravelMode = 'train' | 'bus' | 'boat';
export const TRAVEL_MODES: TravelMode[] = ['train', 'bus', 'boat'];
export interface Timing {
  en?: EnText;
  id: string;
  villageId: string;
  mode: TravelMode;
  name: string; // train name / bus name / boat service
  number?: string; // train number
  stop: string; // where it stops in the panchayat
  from: string;
  to: string;
  time: string; // "HH:MM" 24h, at the stop
  days?: string; // e.g. "Daily", "Except Sunday"
  note?: string;
  addedBy: string;
  addedByName: string;
  createdAt: number;
}

// ---------- Blood donors (id = uid) ----------
export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'] as const;
export type BloodGroup = (typeof BLOOD_GROUPS)[number];
export interface BloodDonor {
  uid: string;
  villageId: string;
  name: string;
  phone: string;
  group: BloodGroup;
  ward?: string;
  lastDonated?: string; // yyyy-mm
  available: boolean;
  createdAt: number;
}

/** A message / complaint from a resident to their ward member / panchayat office. Private to the sender and the village's coordinators. */
export interface Complaint {
  id: string;
  villageId: string;
  ward?: string;
  fromUid: string;
  fromName: string;
  fromPhone: string;
  text: string;
  photo?: string; // small JPEG data URL
  status: 'open' | 'replied' | 'resolved';
  reply?: string;
  repliedByName?: string;
  repliedAt?: number;
  createdAt: number;
}

// ---------- Market: residents sell / rent / ask to buy (milk, eggs, rental items…) ----------
export type ListingKind = 'sell' | 'rent' | 'buy';
export const LISTING_KINDS: ListingKind[] = ['sell', 'rent', 'buy'];
export type ListingCat = 'milk' | 'egg' | 'vegetable' | 'fruit' | 'fish' | 'meat' | 'homefood' | 'plants' | 'animals' | 'rental' | 'used' | 'itemother';
export const LISTING_CATS: ListingCat[] = ['milk', 'egg', 'vegetable', 'fruit', 'fish', 'meat', 'homefood', 'plants', 'animals', 'rental', 'used', 'itemother'];
export interface Listing {
  id: string;
  villageId: string;
  sellerUid: string;
  sellerName: string;
  phone: string;
  ward?: string;
  kind: ListingKind;
  category: ListingCat;
  title: string;
  price: number; // 0 = ask
  unit?: string; // e.g. "ലിറ്റർ", "എണ്ണം", "ദിവസം"
  note?: string;
  photo?: string; // small JPEG data URL
  active: boolean;
  inStock?: boolean; // store: false = "out of stock"
  shopName?: string;
  lat?: number; // pick-up place, for the delivery charge
  lng?: number;
  pincode?: string;
  createdAt: number;
}

/** A person who sells in the market (id = uid). Free until freeUntil, then a weekly fee extends paidUntil. */
export interface Seller {
  uid: string;
  name: string;
  phone: string;
  villageId: string;
  freeUntil: number;
  paidUntil: number;
  createdAt: number;
}

/** A shop's advertisement, shown on the home screen while live. */
export interface Ad {
  id: string;
  villageId: string;
  uid: string;
  name: string; // shop / business name
  phone: string;
  title: string;
  text: string;
  photo?: string;
  status: 'pending' | 'live' | 'rejected';
  until: number; // live until (ms)
  createdAt: number;
}

/** A UPI payment the user reports (with its transaction id); the owner checks the bank app and approves. */
export interface Payment {
  id: string;
  uid: string;
  name: string;
  phone: string;
  villageId: string;
  purpose: 'seller' | 'ad' | 'delivery';
  adId?: string;
  weeks: number;
  amount: number;
  utr: string;
  status: 'pending' | 'approved' | 'rejected';
  decidedBy?: string;
  decidedAt?: number;
  createdAt: number;
}

export interface PaySettings {
  upiId: string;
  payeeName: string;
  sellerFee: number; // ₹ per week
  adFee: number; // ₹ per week
  freeDays: number; // new sellers sell free for this many days
  deliveryFee: number; // ₹ per week for delivery boys
  deliveryFreeDays: number; // free days after the owner approves a delivery boy
  // Delivery charge paid by the customer to the delivery person (no commission for the owner)
  delBase: number; // ₹ up to delBaseKm
  delBaseKm: number;
  delPerKm: number; // ₹ for every km after that
  delDaily: number; // ₹ per delivery for daily / weekly / monthly orders
}
export const DEFAULT_PAY: PaySettings = { upiId: '', payeeName: 'Gramaseva', sellerFee: 10, adFee: 50, freeDays: 30, deliveryFee: 15, deliveryFreeDays: 7, delBase: 20, delBaseKm: 2, delPerKm: 5, delDaily: 5 };
export const WEEK = 7 * 86400000;
export const sellerActive = (s: Pick<Seller, 'freeUntil' | 'paidUntil'> | null | undefined, now = Date.now()) => !!s && Math.max(s.freeUntil, s.paidUntil) > now;

// ---------- Orders / enquiries from residents to shops and market sellers ----------
export type OrderFreq = 'once' | 'daily' | 'weekly' | 'monthly';
export const ORDER_FREQS: OrderFreq[] = ['once', 'daily', 'weekly', 'monthly'];
export type EnquiryStatus = 'new' | 'replied' | 'accepted' | 'declined' | 'done' | 'cancelled';
export interface OrderLine { listingId: string; title: string; price: number; unit?: string; qty: number }
export interface EnquiryReply { byUid: string; byName: string; text: string; at: number }
export interface Enquiry {
  id: string;
  villageId: string;
  toUid: string; // shop owner / seller
  toName: string;
  toPhone: string;
  kind: 'shop' | 'listing';
  listingId?: string;
  listingTitle?: string;
  fromUid: string;
  fromName: string;
  fromPhone: string;
  items: string; // what they want
  qty?: string; // e.g. "1 ലിറ്റർ", "2 ഡസൻ"
  freq: OrderFreq;
  delivery: boolean;
  address?: string;
  lat?: number; // customer's location (optional)
  lng?: number;
  pincode?: string; // customer's PIN code
  note?: string;
  // Store orders: the cart and the bill (pay cash / UPI on delivery)
  lines?: OrderLine[];
  itemsTotal?: number; // ₹ for the goods (to the shop / seller)
  deliveryFee?: number; // ₹ per delivery (to the delivery person)
  km?: number;
  status: EnquiryStatus;
  replies: EnquiryReply[];
  createdAt: number;
  updatedAt: number;
}

// ---------- Delivery boys ----------
export type DeliveryBoyStatus = 'pending' | 'active' | 'suspended' | 'removed';
export type DeliveryVehicle = 'walk' | 'cycle' | 'bike' | 'auto' | 'other';
/** A delivery person (id = uid). Joins as pending; the owner approves (free days start then), suspends with a warning, or removes. */
export interface DeliveryBoy {
  uid: string;
  name: string;
  phone: string;
  villageId: string;
  ward?: string;
  vehicle: DeliveryVehicle;
  area?: string; // where they deliver
  available: boolean;
  busyWith?: string; // id of the one-time delivery accepted and not yet delivered ('' = free)
  status: DeliveryBoyStatus;
  warning?: string;
  freeUntil: number;
  paidUntil: number;
  pincode?: string;
  createdAt: number;
}
export const boyActive = (b: Pick<DeliveryBoy, 'status' | 'freeUntil' | 'paidUntil'> | null | undefined, now = Date.now()) =>
  !!b && b.status === 'active' && Math.max(b.freeUntil, b.paidUntil) > now;

export type DeliveryStatus = 'assigned' | 'accepted' | 'picked' | 'delivered' | 'rejected' | 'cancelled';
/** A delivery job: a shop / seller hands an order to a delivery boy (id = enquiry id). */
export interface Delivery {
  id: string;
  enquiryId: string;
  villageId: string;
  shopUid: string;
  shopName: string;
  shopPhone: string;
  pickupAddress?: string;
  pickupLat?: number;
  pickupLng?: number;
  customerUid: string;
  customerName: string;
  customerPhone: string;
  address?: string;
  lat?: number;
  lng?: number;
  items: string;
  qty?: string;
  freq: OrderFreq;
  deliveryUid: string;
  deliveryName: string;
  deliveryPhone: string;
  status: DeliveryStatus;
  deliveredCount: number; // daily / weekly orders: one per delivery done
  lastDeliveredAt?: number;
  log?: number[]; // time of each delivery (for monthly bills)
  itemsTotal?: number; // ₹ to collect for the goods (give to the shop)
  deliveryFee?: number; // ₹ the delivery person keeps, per delivery
  createdAt: number;
  updatedAt: number;
}

/** Delivery charge for one delivery. Distance is straight-line km × 1.3 for roads; unknown distance → the base charge. */
export function deliveryCharge(p: Pick<PaySettings, 'delBase' | 'delBaseKm' | 'delPerKm' | 'delDaily'>, freq: OrderFreq, straightKm: number | null) {
  if (freq !== 'once') return { fee: p.delDaily, km: straightKm == null ? null : Math.round(straightKm * 13) / 10 };
  if (straightKm == null) return { fee: p.delBase, km: null };
  const road = Math.round(straightKm * 13) / 10;
  return { fee: p.delBase + Math.max(0, Math.ceil(road - p.delBaseKm)) * p.delPerKm, km: road };
}
/** Deliveries recorded in a calendar month (from the delivery log). */
export const inMonth = (log: number[] | undefined, at = new Date()) =>
  (log ?? []).filter((t) => { const d = new Date(t); return d.getFullYear() === at.getFullYear() && d.getMonth() === at.getMonth(); }).length;

/** "Super admin" / "Panchayat President" / "Ward member" … */
export function roleText(u: Pick<UserProfile, 'role' | 'position'>, lang: 'ml' | 'en' | string) {
  if (u.role === 'superadmin') return 'Super admin';
  if (u.role === 'coordinator') { const p = POSITION_LABEL[u.position ?? 'member']; return lang === 'ml' ? p[0] : p[1]; }
  return lang === 'ml' ? 'സാധാരണ user' : 'User';
}
