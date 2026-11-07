export const mapTileSize = 256;
export function mapPixel(latitude: number, longitude: number, zoom: number) {
  const scale = 2 ** zoom * mapTileSize, sine = Math.sin(Math.max(-85, Math.min(85, latitude)) * Math.PI / 180);
  return { x: (longitude + 180) / 360 * scale, y: (0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI)) * scale };
}
export function distanceMetres(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const rad = (n: number) => n * Math.PI / 180, dLat = rad(b.latitude - a.latitude), dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}
export function mapTileRequest(url: string) {
  const q = new URL(url).searchParams;
  const integer = (key: string) => { const v = q.get(key); return v && /^\d{1,6}$/.test(v) ? Number(v) : NaN; };
  const z = integer('z'), x = integer('x'), y = integer('y');
  if (!Number.isSafeInteger(z) || z < 10 || z > 16 || !Number.isSafeInteger(x) || !Number.isSafeInteger(y) || x < 0 || y < 0 || x >= 2 ** z || y >= 2 ** z) return null;
  // Fixed public basemap service, restricted to Johannesburg and its surrounds.
  const min = mapPixel(-25.4, 27, z), max = mapPixel(-27.2, 29.4, z);
  if (x < Math.floor(min.x / 256) || x > Math.floor(max.x / 256) || y < Math.floor(min.y / 256) || y > Math.floor(max.y / 256)) return null;
  return `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
}
