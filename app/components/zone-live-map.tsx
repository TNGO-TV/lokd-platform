'use client';
import Image from 'next/image';
import { useState } from 'react';
import { mapPixel } from '../lib/zone-map';
import type { ZoneMapPoint } from '../lib/zone-location';
export default function ZoneLiveMap({ points, site, label = 'Live officer locations' }: { points: ZoneMapPoint[]; site?: { latitude: number; longitude: number; name: string }; label?: string }) {
  const [zoom, setZoom] = useState(12);
  const centre = site ?? points[0] ?? { latitude: -26.1076, longitude: 28.0567 }, pixel = mapPixel(centre.latitude, centre.longitude, zoom), width = 640, height = 340;
  const left = pixel.x - width / 2, top = pixel.y - height / 2, tiles = [];
  for (let x = Math.floor(left / 256); x <= Math.floor((left + width) / 256); x++) for (let y = Math.floor(top / 256); y <= Math.floor((top + height) / 256); y++) tiles.push({ x, y });
  return <figure className="zone-live-map" aria-label={label}><div className="zone-map-viewport"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
    <title>{label}</title><rect width={width} height={height} fill="#e7edf0" />
    {tiles.map(t => <image key={`${zoom}:${t.x}:${t.y}`} href={`/api/map-tile?z=${zoom}&x=${t.x}&y=${t.y}`} x={t.x * 256 - left} y={t.y * 256 - top} width="256" height="256" />)}
    {points.map(p => { const pos = mapPixel(p.latitude, p.longitude, zoom), x = pos.x - left, y = pos.y - top; return <g key={p.id}><title>{p.name}: {p.mode === 'en_route' ? 'On route' : 'Dispatch location shared'}</title><circle cx={x} cy={y} r="17" fill="#448cca" opacity="0.22" /><circle cx={x} cy={y} r="8" fill="#176299" stroke="white" strokeWidth="3" /></g>; })}
    {site && <g><title>{site.name}</title><rect x="309" y="159" width="22" height="22" rx="5" fill="#bb2531" stroke="white" strokeWidth="3" /></g>}
  </svg><div className="zone-map-tools"><button type="button" aria-label="Zoom in" disabled={zoom >= 16} onClick={() => setZoom(z => z + 1)}>+</button><button type="button" aria-label="Zoom out" disabled={zoom <= 10} onClick={() => setZoom(z => z - 1)}>−</button></div></div><figcaption><span><Image src="/zone/route.svg" alt="" width={24} height={24} /> {points.length ? `${points.length} current shared location${points.length === 1 ? '' : 's'}` : 'No current officer locations shared'}</span><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a></figcaption>
    <ul className="zone-map-accessible">{points.map(p => <li key={p.id}>{p.name} · {p.mode === 'en_route' ? 'On route' : 'Shared with Dispatch'} · Accuracy {Math.ceil(p.accuracy)} m · Updated {new Date(p.capturedAt).toLocaleTimeString('en-ZA', { timeZone: 'Africa/Johannesburg', hour: '2-digit', minute: '2-digit' })} SAST</li>)}</ul>
  </figure>;
}
