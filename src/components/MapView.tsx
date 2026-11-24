// Maps (Leaflet + OpenStreetMap tiles: free, no API key). Loaded only when a map is shown (see LazyMap.tsx).
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export type MapPointKind = 'shop' | 'home' | 'bike';
export interface MapPoint { lat: number; lng: number; kind: MapPointKind; label?: string }

const EMOJI: Record<MapPointKind, string> = { shop: '🏪', home: '🏠', bike: '🛵' };
const icon = (k: MapPointKind) => L.divIcon({ html: `<div class="mk mk-${k}">${EMOJI[k]}</div>`, className: '', iconSize: [38, 38], iconAnchor: [19, 19] });
const KERALA: L.LatLngTuple = [9.5, 76.4];

function baseMap(el: HTMLDivElement, center: L.LatLngTuple, zoom: number) {
  const m = L.map(el, { zoomControl: true, attributionControl: true }).setView(center, zoom);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(m);
  return m;
}

/** Shop, home and the delivery bike. The view fits all points once (and again when a new kind of point appears). */
export function LiveMap({ points, height = 320 }: { points: MapPoint[]; height?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const fittedKinds = useRef('');

  useEffect(() => {
    const m = baseMap(box.current!, KERALA, 13);
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    return () => { m.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    const m = map.current, g = layer.current;
    if (!m || !g) return;
    g.clearLayers();
    for (const p of points) {
      const mk = L.marker([p.lat, p.lng], { icon: icon(p.kind), zIndexOffset: p.kind === 'bike' ? 1000 : 0 });
      if (p.label) mk.bindTooltip(p.label);
      mk.addTo(g);
    }
    const bike = points.find((p) => p.kind === 'bike');
    const home = points.find((p) => p.kind === 'home');
    if (bike && home) L.polyline([[bike.lat, bike.lng], [home.lat, home.lng]], { color: '#1b7f3b', weight: 3, dashArray: '6 8' }).addTo(g);
    const kinds = points.map((p) => p.kind).sort().join(',');
    if (points.length && kinds !== fittedKinds.current) {
      fittedKinds.current = kinds;
      if (points.length === 1) m.setView([points[0].lat, points[0].lng], 16);
      else m.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng] as L.LatLngTuple)), { padding: [40, 40], maxZoom: 17 });
    }
  }, [points]);

  return <div ref={box} style={{ height, width: '100%', borderRadius: 12, overflow: 'hidden', zIndex: 0 }} />;
}

/** Tap or drag the pin to the exact house. */
export function PickMap({ value, center, onChange, height = 260 }: { value: { lat: number; lng: number } | null; center?: { lat: number; lng: number } | null; onChange: (p: { lat: number; lng: number }) => void; height?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const pin = useRef<L.Marker | null>(null);
  const cb = useRef(onChange);
  cb.current = onChange;
  const round = (n: number) => Math.round(n * 1e5) / 1e5;

  useEffect(() => {
    const start = value ?? center;
    const m = baseMap(box.current!, start ? [start.lat, start.lng] : KERALA, start ? 17 : 12);
    const mk = L.marker(start ? [start.lat, start.lng] : KERALA, { icon: icon('home'), draggable: true }).addTo(m);
    mk.on('dragend', () => { const p = mk.getLatLng(); cb.current({ lat: round(p.lat), lng: round(p.lng) }); });
    m.on('click', (e: L.LeafletMouseEvent) => { mk.setLatLng(e.latlng); cb.current({ lat: round(e.latlng.lat), lng: round(e.latlng.lng) }); });
    map.current = m; pin.current = mk;
    return () => { m.remove(); map.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Moved from outside (e.g. "use my GPS"): follow it.
  useEffect(() => {
    if (!value || !pin.current || !map.current) return;
    const cur = pin.current.getLatLng();
    if (Math.abs(cur.lat - value.lat) > 1e-5 || Math.abs(cur.lng - value.lng) > 1e-5) {
      pin.current.setLatLng([value.lat, value.lng]);
      map.current.setView([value.lat, value.lng], Math.max(map.current.getZoom(), 17));
    }
  }, [value]);

  return <div ref={box} style={{ height, width: '100%', borderRadius: 12, overflow: 'hidden', zIndex: 0 }} />;
}
