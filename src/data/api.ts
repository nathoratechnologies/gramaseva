import type {
  RoleRequest,
  Booking, BookingStatus, Category, News, Provider, ProviderStatus, Report, Review, Role,
  UserProfile, Village, VillageStats, Complaint, Contact, ContactKind, Timing, BloodDonor,
  Listing, Seller, Ad, Payment, OrderReview, OrderReviewKind, RatingStat, PaySettings, Enquiry, EnquiryReply, DeliveryBoy, Delivery, StaffLogin, StaffPosition,
} from '../types';

/**
 * Everything the app needs from a backend. Two implementations:
 *  - demo.ts      sample data kept in the browser (no setup needed)
 *  - firebase.ts  real data in Firebase (phone OTP + Firestore)
 */
export interface AuthUser { uid: string; phone: string; email: string }
export interface WaLogin { session: string; code: string; text: string; waNumber: string; expiresAt: number }

export interface Api {
  mode: 'demo' | 'firebase';

  // Auth
  onAuth(cb: (user: AuthUser | null) => void): () => void;
  signInWithGoogle(): Promise<void>;
  signInWithEmail(email: string, password: string): Promise<void>;
  /** Mobile number (10 digits) + 6-digit PIN. Free, no SMS; the number is not checked by OTP. */
  signInWithMobilePin(tenDigits: string, pin: string): Promise<void>;
  registerMobilePin(tenDigits: string, pin: string): Promise<void>;
  resetPassword(email: string): Promise<void>;
  sendOtp(phone: string, recaptchaContainerId: string): Promise<void>;
  /** Free WhatsApp login is set up (VITE_WA_LOGIN_URL). */
  waLoginEnabled: boolean;
  /** Start a WhatsApp login: the person sends `text` to `waNumber` from their own WhatsApp. */
  startWaLogin(): Promise<WaLogin>;
  /** Check whether the WhatsApp message arrived; signs in and returns true when it did. */
  checkWaLogin(session: string): Promise<boolean>;
  verifyOtp(code: string): Promise<void>;
  signOut(): Promise<void>;

  // Users
  getProfile(uid: string): Promise<UserProfile | null>;
  saveProfile(p: UserProfile): Promise<void>;
  deleteMyData(uid: string): Promise<void>;
  findUserByPhone(phone: string): Promise<UserProfile | null>;
  findUserByEmail(email: string): Promise<UserProfile | null>;
  /** All coordinators (super admin), or those of one village (its president / members). */
  listCoordinators(villageId?: string): Promise<UserProfile[]>;
  setRole(uid: string, role: Role, coordinatorOf: string | null, position?: StaffPosition | null): Promise<void>;
  /** Super admin: every user (to see who is who). */
  listUsers(): Promise<UserProfile[]>;
  /** Super admin makes a username + password login for a president / vice president / ward member. */
  createStaffLogin(s: StaffLogin): Promise<UserProfile>;
  changePassword(newPassword: string): Promise<void>;

  // Admin access requests
  getMyRoleRequest(uid: string): Promise<RoleRequest | null>;
  requestRole(r: RoleRequest): Promise<void>;
  /** Pending requests: all (super admin) or one village (its president / vice president). */
  listRoleRequests(villageId?: string): Promise<RoleRequest[]>;
  decideRoleRequest(r: RoleRequest, approve: boolean): Promise<void>;

  // Villages
  listVillages(): Promise<Village[]>;
  saveVillage(v: Village): Promise<void>;
  /** Any signed-in person can add their own village from their location. */
  addVillage(v: Omit<Village, 'id'>): Promise<Village>;

  // Providers
  /** Approved providers in these villages (one panchayat and its neighbours); all work types when category is null. */
  listApprovedProviders(category: Category | null, villageIds: string[]): Promise<Provider[]>;
  listVillageProviders(villageId: string, status?: ProviderStatus): Promise<Provider[]>;
  getProvider(uid: string): Promise<Provider | null>;
  saveProvider(p: Provider): Promise<void>;
  setAvailability(uid: string, until: number): Promise<void>;
  reviewProvider(uid: string, status: ProviderStatus, verified: boolean): Promise<void>;

  // News
  listNews(villageId: string, opts?: { includePending?: boolean }): Promise<News[]>;
  getNews(id: string): Promise<News | null>;
  createNews(n: Omit<News, 'id'>): Promise<void>;
  setNewsStatus(id: string, status: News['status']): Promise<void>;

  // Bookings
  createBooking(b: Omit<Booking, 'id'>): Promise<string>;
  getBooking(id: string): Promise<Booking | null>;
  listMyBookings(uid: string): Promise<Booking[]>;
  listProviderBookings(uid: string): Promise<Booking[]>;
  updateBookingStatus(id: string, status: BookingStatus): Promise<void>;

  // Reviews
  addReview(booking: Booking, stars: number, comment: string, customerName: string): Promise<void>;
  listReviews(providerId: string): Promise<Review[]>;
  // Reviews of shops / sellers and delivery people after an order
  addOrderReview(r: Omit<OrderReview, 'id' | 'createdAt'>): Promise<void>;
  listOrderReviews(kind: OrderReviewKind, targetUid: string): Promise<OrderReview[]>;
  listMyOrderReviews(uid: string): Promise<OrderReview[]>;
  /** Rating totals by uid for these people. */
  getRatingStats(kind: OrderReviewKind, uids: string[]): Promise<Record<string, RatingStat>>;

  // Reports / complaints
  createReport(r: Omit<Report, 'id'>): Promise<void>;
  listReports(villageId: string): Promise<Report[]>;
  resolveReport(id: string): Promise<void>;

  // Resident messages / complaints to ward members
  createComplaint(c: Omit<Complaint, 'id'>): Promise<void>;
  listMyComplaints(uid: string): Promise<Complaint[]>;
  listComplaints(villageId: string): Promise<Complaint[]>;
  replyComplaint(id: string, reply: string, byName: string, resolved: boolean): Promise<void>;
  setComplaintStatus(id: string, status: Complaint['status']): Promise<void>;

  // Admin
  villageStats(villageId: string): Promise<VillageStats>;

  // Directory (hospitals, schools, ASHA workers, offices)
  listContacts(kind: ContactKind, villageIds: string[], status?: 'approved' | 'pending'): Promise<Contact[]>;
  saveContact(c: Omit<Contact, 'id'> & { id?: string }): Promise<void>;
  getContact(id: string): Promise<Contact | null>;
  deleteContact(id: string): Promise<void>;
  // Train / bus / boat timings
  listTimings(villageIds: string[]): Promise<Timing[]>;
  addTiming(t: Omit<Timing, 'id'>): Promise<void>;
  deleteTiming(id: string): Promise<void>;
  // Blood donors
  listDonors(villageIds: string[]): Promise<BloodDonor[]>;
  getDonor(uid: string): Promise<BloodDonor | null>;
  saveDonor(d: BloodDonor): Promise<void>;
  deleteDonor(uid: string): Promise<void>;

  // Super admin: bulk import from the Excel template (village record optional; providers/contacts written with their own ids).
  // Market, ads and payments
  getPaySettings(): Promise<PaySettings>;
  savePaySettings(s: PaySettings): Promise<void>;
  getSeller(uid: string): Promise<Seller | null>;
  createSeller(s: Seller): Promise<void>;
  listSellers(uids?: string[]): Promise<Seller[]>; // all sellers when uids is not given (owner)
  listListings(villageIds: string[] | null): Promise<Listing[]>; // null = every panchayat (owner)
  listMyListings(uid: string): Promise<Listing[]>;
  saveListing(l: Omit<Listing, 'id'> & { id?: string }): Promise<void>;
  deleteListing(id: string): Promise<void>;
  listLiveAds(villageIds: string[]): Promise<Ad[]>;
  listMyAds(uid: string): Promise<Ad[]>;
  listAllAds(): Promise<Ad[]>;
  createAd(a: Omit<Ad, 'id'>): Promise<string>;
  deleteAd(id: string): Promise<void>;
  setAdStatus(id: string, status: Ad['status'], until: number): Promise<void>;
  createPayment(p: Omit<Payment, 'id'>): Promise<void>;
  listMyPayments(uid: string): Promise<Payment[]>;
  listPayments(): Promise<Payment[]>;
  /** Owner approves / rejects; approval extends the seller's paidUntil or makes the ad live. */
  decidePayment(p: Payment, approve: boolean, byName: string): Promise<void>;
  /** Owner records money received by hand (cash / outside the app) and applies it at once. */
  recordCash(p: Omit<Payment, 'id' | 'status'>, byName: string): Promise<void>;

  // Orders / enquiries
  createEnquiry(e: Omit<Enquiry, 'id'>): Promise<void>;
  listEnquiriesTo(uid: string): Promise<Enquiry[]>;
  listEnquiriesFrom(uid: string): Promise<Enquiry[]>;
  updateEnquiry(id: string, status: Enquiry['status'], reply?: EnquiryReply): Promise<void>;

  // Delivery boys
  getDeliveryBoy(uid: string): Promise<DeliveryBoy | null>;
  joinDelivery(b: DeliveryBoy): Promise<void>;
  /** The delivery boy edits own details (not status / dates); the owner may change anything. */
  saveDeliveryBoy(uid: string, patch: Partial<DeliveryBoy>): Promise<void>;
  listDeliveryBoys(villageIds: string[] | null): Promise<DeliveryBoy[]>; // null = all (owner)
  /** Shop / seller hands an order to a delivery boy (creates the job, or re-assigns an existing one). */
  assignDelivery(d: Delivery): Promise<void>;
  updateDelivery(id: string, patch: Partial<Delivery>): Promise<void>;
  listDeliveries(by: 'shopUid' | 'deliveryUid' | 'customerUid' | null, uid?: string): Promise<Delivery[]>; // null = all (owner)

  bulkImport(village: Village | null, providers: Provider[], contacts: Contact[], onProgress?: (done: number, total: number) => void): Promise<void>;
}

export const byNewest = <T extends { createdAt: number }>(a: T, b: T) => b.createdAt - a.createdAt;
