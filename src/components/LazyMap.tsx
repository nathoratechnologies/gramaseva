// The map code (Leaflet) is downloaded only when a map is first shown.
import { Suspense, lazy, type ComponentProps } from 'react';
import type { LiveMap as LiveMapT, PickMap as PickMapT, RoutePickMap as RouteT } from './MapView';

const Live = lazy(() => import('./MapView').then((m) => ({ default: m.LiveMap })));
const Pick = lazy(() => import('./MapView').then((m) => ({ default: m.PickMap })));
const Route = lazy(() => import('./MapView').then((m) => ({ default: m.RoutePickMap })));
const Box = ({ h }: { h: number }) => <div style={{ height: h, borderRadius: 12, background: '#e8eee4' }} />;

export function LiveMap(p: ComponentProps<typeof LiveMapT>) {
  return <Suspense fallback={<Box h={p.height ?? 320} />}><Live {...p} /></Suspense>;
}
export function PickMap(p: ComponentProps<typeof PickMapT>) {
  return <Suspense fallback={<Box h={p.height ?? 260} />}><Pick {...p} /></Suspense>;
}
export function RoutePickMap(p: ComponentProps<typeof RouteT>) {
  return <Suspense fallback={<Box h={p.height ?? 280} />}><Route {...p} /></Suspense>;
}
export type { MapPoint } from './MapView';
