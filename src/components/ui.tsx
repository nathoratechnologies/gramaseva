import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Armchair, Briefcase, BusFront, Croissant, Footprints, Gem, Pencil, Pill, Sailboat, Shirt, ShoppingBag, ShoppingCart, Smartphone, Store, Truck, UtensilsCrossed, Wrench, Bus, Car, CarTaxiFront, ClipboardList, Droplet, Flame, Flower2, Hammer, House, Landmark,
  MessageCircle, PartyPopper, Phone, Sprout, Star, TreePalm, User, Wheat, Zap, ZapOff, type LucideIcon,
} from 'lucide-react';
import { useApp } from '../lib/app';
import type { Category, NewsCat } from '../types';
import { telHref, waHref } from '../lib/util';

export const CAT_ICON: Record<Category, { Icon: LucideIcon; color: string; bg: string }> = {
  plumbing: { Icon: Droplet, color: '#1565c0', bg: '#e3f0fc' },
  electrical: { Icon: Zap, color: '#a86b00', bg: '#fff3d6' },
  welding: { Icon: Flame, color: '#c62828', bg: '#fdecea' },
  coconut: { Icon: TreePalm, color: '#2e7d32', bg: '#e8f5e9' },
  farming: { Icon: Sprout, color: '#558b2f', bg: '#f0f7e6' },
  other: { Icon: Hammer, color: '#5c5c53', bg: '#efefe8' },
  auto: { Icon: CarTaxiFront, color: '#8a4b00', bg: '#fff3d6' },
  car4: { Icon: Car, color: '#1565c0', bg: '#e3f0fc' },
  car7: { Icon: Bus, color: '#2e7d32', bg: '#e8f5e9' },
  goods: { Icon: Truck, color: '#6d4c41', bg: '#efebe9' },
  traveller: { Icon: BusFront, color: '#00838f', bg: '#e0f7fa' },
  tourbus: { Icon: BusFront, color: '#ad1457', bg: '#fce4ec' },
  houseboat: { Icon: Sailboat, color: '#0277bd', bg: '#e1f5fe' },
  bakery: { Icon: Croissant, color: '#ef6c00', bg: '#fff3e0' },
  restaurant: { Icon: UtensilsCrossed, color: '#c62828', bg: '#fdecea' },
  furniture: { Icon: Armchair, color: '#6d4c41', bg: '#efebe9' },
  supermarket: { Icon: ShoppingCart, color: '#2e7d32', bg: '#e8f5e9' },
  dress: { Icon: Shirt, color: '#8e24aa', bg: '#f3e5f5' },
  footwear: { Icon: Footprints, color: '#5d4037', bg: '#efebe9' },
  ladies: { Icon: ShoppingBag, color: '#d81b60', bg: '#fce4ec' },
  medical: { Icon: Pill, color: '#00897b', bg: '#e0f2f1' },
  hardware: { Icon: Wrench, color: '#455a64', bg: '#eceff1' },
  stationery: { Icon: Pencil, color: '#1565c0', bg: '#e3f0fc' },
  mobile: { Icon: Smartphone, color: '#3949ab', bg: '#e8eaf6' },
  jewellery: { Icon: Gem, color: '#a86b00', bg: '#fff3d6' },
  shopother: { Icon: Store, color: '#5c5c53', bg: '#efefe8' },
};

export const NEWS_ICON: Record<NewsCat, { Icon: LucideIcon; bg: string }> = {
  panchayat: { Icon: Landmark, bg: '#1565c0' },
  outage: { Icon: ZapOff, bg: '#c62828' },
  festival: { Icon: PartyPopper, bg: '#8e5bd1' },
  obituary: { Icon: Flower2, bg: '#5c5c53' },
  jobs: { Icon: Briefcase, bg: '#a86b00' },
  farming: { Icon: Wheat, bg: '#2e7d32' },
};

export function CatIcon({ cat, size = 28 }: { cat: Category; size?: number }) {
  const { Icon, color, bg } = CAT_ICON[cat];
  return (
    <span className="ic" style={{ background: bg, color, width: size * 2, height: size * 2, borderRadius: size * 0.55, display: 'grid', placeItems: 'center', flex: 'none' }}>
      <Icon size={size} strokeWidth={2.2} aria-hidden />
    </span>
  );
}

export function Logo({ size = 96, inverse = false }: { size?: number; inverse?: boolean }) {
  const bg = inverse ? '#ffffff' : '#2e7d32';
  const fg = inverse ? '#2e7d32' : '#ffffff';
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" role="img" aria-label="Gramaseva">
      <rect width="200" height="200" rx="48" fill={bg} />
      <path d="M44 112 L100 62 L156 112" fill="none" stroke={fg} strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="62" y="108" width="76" height="52" rx="6" fill={fg} />
      <rect x="90" y="126" width="20" height="34" rx="4" fill={bg} />
      <path d="M138 66 C150 40 172 36 178 38 C168 46 160 58 150 72 Z" fill="#F9A825" />
      <path d="M138 66 C126 44 108 40 100 42 C112 48 122 58 132 72 Z" fill="#A5D6A7" />
    </svg>
  );
}

export function Screen({
  title, back = true, children, nav = false, right, sub,
}: { title?: ReactNode; back?: boolean | string; children: ReactNode; nav?: boolean; right?: ReactNode; sub?: ReactNode }) {
  const navigate = useNavigate();
  return (
    <>
      {(title || back) && (
        <header className="appbar">
          {back && (
            <button className="iconbtn" aria-label="back" onClick={() => (typeof back === 'string' ? navigate(back) : navigate(-1))}>
              <ArrowLeft size={24} />
            </button>
          )}
          <div className="grow">
            {title && <h1>{title}</h1>}
            {sub && <div className="sub">{sub}</div>}
          </div>
          {right}
        </header>
      )}
      <main className={'content' + (nav ? ' with-nav' : '')}>{children}</main>
      {nav && <BottomNav />}
    </>
  );
}

export function BottomNav({ badge = 0 }: { badge?: number }) {
  const { L } = useApp();
  const items: [string, LucideIcon, string][] = [
    ['/', House, L('ഹോം', 'Home')],
    ['/store', Store, L('കട', 'Shop')],
    ['/orders', ClipboardList, L('ഓർഡറുകൾ', 'Orders')],
    ['/profile', User, L('ഞാൻ', 'Me')],
  ];
  return (
    <nav className="bottomnav" aria-label="main">
      {items.map(([to, Icon, label]) => (
        <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
          <Icon size={24} aria-hidden />
          {label}
          {to === '/orders' && badge > 0 && <span className="dotbadge">{badge}</span>}
        </NavLink>
      ))}
    </nav>
  );
}

const AV_COLORS = ['#c8e6c9', '#ffe0b2', '#bbdefb', '#f8bbd0', '#d1c4e9', '#dcedc8'];
export function Avatar({ name, size, className = '' }: { name: string; size?: 'lg'; className?: string }) {
  const letter = [...name.trim()][0] ?? '?';
  const color = AV_COLORS[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AV_COLORS.length];
  return (
    <span className={`avatar ${size ?? ''} ${className}`} style={{ background: color }} aria-hidden>
      {letter}
    </span>
  );
}

export function StarRow({ value, count }: { value: number; count?: number }) {
  if (!count) return null;
  return (
    <span className="row nowrap" style={{ gap: 3 }}>
      <Star size={15} fill="#f9a825" color="#f9a825" aria-hidden />
      <b className="num">{value.toFixed(1)}</b>
      {count !== undefined && <span className="muted small num">({count})</span>}
    </span>
  );
}

export function CallButton({ phone, off }: { phone: string; off?: boolean }) {
  const { L } = useApp();
  return (
    <a className={'callbtn' + (off ? ' off' : '')} href={telHref(phone)} aria-label={L('വിളിക്കുക', 'Call')} onClick={(e) => e.stopPropagation()}>
      <Phone size={22} aria-hidden />
    </a>
  );
}

export function CallWhatsApp({ phone, text }: { phone: string; text?: string }) {
  const { L } = useApp();
  return (
    <div className="row nowrap">
      <a className="btn grow" href={telHref(phone)}><Phone size={20} aria-hidden />{L('വിളിക്കുക', 'Call')}</a>
      <a className="btn wa grow" href={waHref(phone, text)} target="_blank" rel="noreferrer"><MessageCircle size={20} aria-hidden />WhatsApp</a>
    </div>
  );
}

export const Loading = () => {
  const { L } = useApp();
  return <div className="loading">{L('ലോഡ് ചെയ്യുന്നു…', 'Loading…')}</div>;
};

export function Empty({ icon, text, children }: { icon?: ReactNode; text: string; children?: ReactNode }) {
  return (
    <div className="empty">
      {icon}
      <p>{text}</p>
      {children}
    </div>
  );
}

export function LoadError({ retry }: { retry: () => void }) {
  const { L } = useApp();
  return (
    <div className="notice bad" role="alert">
      <span className="grow">{L('വിവരങ്ങൾ എടുക്കാൻ പറ്റിയില്ല. Internet ഉണ്ടോ എന്ന് നോക്കുക.', "Couldn't load. Check your internet connection.")}</span>
      <button className="link" onClick={retry}>{L('വീണ്ടും', 'Retry')}</button>
    </div>
  );
}
