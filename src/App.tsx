import { useState } from 'react';
import { HashRouter, MemoryRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from './lib/app';
import { resetDemo } from './data/demo';
import { ConsentStep, LanguageStep, LoginStep, PincodeStep, ProfileStep, Splash, VillageStep } from './screens/Onboarding';
import { Emergency, Home } from './screens/Home';
import { NewsDetail, NewsList, SuggestNews } from './screens/News';
import { MoreWorks } from './screens/Workers';
import { Shops } from './screens/Shops';
import { AdForm, Market, MyMarket, Pay, SellForm } from './screens/Market';
import { Business } from './screens/Business';
import { OrderForm, Orders } from './screens/Orders';
import { DeliveryBoys, DeliveryHome, DeliveryJoin } from './screens/Delivery';
import { CartScreen, Store } from './screens/Store';
import { TrackDelivery } from './screens/Track';
import { ComplaintForm, Complaints } from './screens/Complaints';
import { BookingRequest, ProviderProfile, ReportProvider, Services, WorkerList } from './screens/Workers';
import { Drivers, Ride } from './screens/Ride';
import { BookingStatusScreen, MyBookings, RateBooking } from './screens/Bookings';
import { ProviderDashboard, ProviderRegister } from './screens/Provider';
import { ChangePin, ChangePincode, ChangeVillage, DeleteData, PrivacyScreen, Profile, RequestAdmin } from './screens/Profile';
import { AdminApp } from './admin/Admin';
import { PanchayatPeople, PanchayatPicker, WardList } from './screens/Panchayats';
import { BloodDonors, BloodForm, ContactForm, DirectoryList, TimingForm, Timings } from './screens/Local';
import type { Consent } from './types';

const Router = import.meta.env.VITE_ROUTER === 'memory' ? MemoryRouter : HashRouter;

function hasChosenLang() {
  try { return !!localStorage.getItem('gramaseva-lang'); } catch { return false; }
}

function Onboarding() {
  const { api, authUser, villages, lang, refresh, L, toast } = useApp();
  const nav = useNavigate();
  const [consent, setConsent] = useState<Consent | null>(null);
  const [villageId, setVillageId] = useState<string | undefined>(undefined);
  if (!authUser) return null;
  if (!consent) return <ConsentStep onDone={setConsent} />;
  if (villageId === undefined) return <VillageStep onDone={(v) => setVillageId(v?.id ?? '')} />;
  return (
    <ProfileStep draft={{}} needPhone={!authUser.phone} wards={villages.find((v) => v.id === villageId)?.wards} onDone={async (name, ward, wantsProvider, typedPhone, pin) => {
      try {
        await api.saveProfile({
          uid: authUser.uid, name, phone: authUser.phone || typedPhone, ...(authUser.email ? { email: authUser.email.toLowerCase() } : {}), villageId, ...(ward ? { ward } : {}), ...pin, lang, role: 'user',
          coordinatorOf: null, consent, createdAt: Date.now(),
        });
        await refresh();
        nav(wantsProvider ? '/work/register' : '/', { replace: true });
      } catch (e) {
        console.error(e);
        toast(L('സേവ് ചെയ്യാൻ പറ്റിയില്ല. Internet നോക്കി വീണ്ടും ശ്രമിക്കുക.', "Couldn't save. Check your internet and try again."));
      }
    }} />
  );
}

function Shell() {
  const { api, authReady, authUser, profile, toastMsg, L } = useApp();
  const [langChosen, setLangChosen] = useState(hasChosenLang());
  const loc = useLocation();
  const isAdmin = loc.pathname.startsWith('/admin');

  let body: JSX.Element;
  if (!authReady) body = <Splash />;
  else if (!authUser) body = langChosen ? <LoginStep /> : <LanguageStep onDone={() => setLangChosen(true)} />;
  else if (!profile) body = <Onboarding />;
  // PIN code is required: people who joined before it was asked add it once.
  else if (!profile.pincode && !isAdmin) body = <PincodeStep />;
  else if (isAdmin) body = <Routes><Route path="/admin/*" element={<AdminApp />} /></Routes>;
  else {
    body = (
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/news" element={<NewsList />} />
        <Route path="/news/suggest" element={<SuggestNews />} />
        <Route path="/news/:id" element={<NewsDetail />} />
        <Route path="/services" element={<Services />} />
        <Route path="/services/more" element={<MoreWorks />} />
        <Route path="/services/:cat" element={<WorkerList />} />
        <Route path="/provider/:uid" element={<ProviderProfile />} />
        <Route path="/book/:uid" element={<BookingRequest />} />
        <Route path="/report/:uid" element={<ReportProvider />} />
        <Route path="/ride" element={<Ride />} />
        <Route path="/ride/drivers" element={<Drivers />} />
        <Route path="/booking/:id" element={<BookingStatusScreen />} />
        <Route path="/bookings" element={<MyBookings />} />
        <Route path="/rate/:id" element={<RateBooking />} />
        <Route path="/work" element={<ProviderDashboard />} />
        <Route path="/work/register" element={<ProviderRegister />} />
        <Route path="/emergency" element={<Emergency />} />
        <Route path="/panchayats" element={<PanchayatPicker />} />
        <Route path="/people" element={<PanchayatPeople />} />
        <Route path="/wards" element={<WardList />} />
        <Route path="/directory/:kind" element={<DirectoryList />} />
        <Route path="/directory/:kind/new" element={<ContactForm />} />
        <Route path="/timings" element={<Timings />} />
        <Route path="/timings/new" element={<TimingForm />} />
        <Route path="/shops" element={<Shops />} />
        <Route path="/shops/:cat" element={<Shops />} />
        <Route path="/market" element={<Market />} />
        <Route path="/market/c/:cat" element={<Market />} />
        <Route path="/market/sell" element={<SellForm />} />
        <Route path="/market/edit/:id" element={<SellForm />} />
        <Route path="/market/my" element={<MyMarket />} />
        <Route path="/ads/new" element={<AdForm />} />
        <Route path="/pay" element={<Pay />} />
        <Route path="/business" element={<Business />} />
        <Route path="/order/new" element={<OrderForm />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/store" element={<Store />} />
        <Route path="/cart" element={<CartScreen />} />
        <Route path="/delivery" element={<DeliveryHome />} />
        <Route path="/delivery/join" element={<DeliveryJoin />} />
        <Route path="/delivery/boys" element={<DeliveryBoys />} />
        <Route path="/track/:id" element={<TrackDelivery />} />
        <Route path="/complaints" element={<Complaints />} />
        <Route path="/complaints/new" element={<ComplaintForm />} />
        <Route path="/blood" element={<BloodDonors />} />
        <Route path="/blood/me" element={<BloodForm />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/profile/privacy" element={<PrivacyScreen />} />
        <Route path="/profile/village" element={<ChangeVillage />} />
        <Route path="/profile/pincode" element={<ChangePincode />} />
        <Route path="/profile/pin" element={<ChangePin />} />
        <Route path="/profile/delete" element={<DeleteData />} />
        <Route path="/profile/request-admin" element={<RequestAdmin />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  return (
    <>
      {api.mode === 'demo' && (
        <div className="demobar">
          {L('Demo — ഉദാഹരണ data മാത്രം.', 'Demo — sample data only.')}
          <button onClick={() => { resetDemo(); location.reload(); }}>{L('Reset', 'Reset')}</button>
        </div>
      )}
      {isAdmin && profile ? body : <div className="phone">{body}</div>}
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
      <div id="recaptcha" />
    </>
  );
}

export default function App() {
  return <Router><Shell /></Router>;
}
