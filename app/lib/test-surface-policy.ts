// Compatibility boundary for callers being removed from production routes.
// No configuration or hostname can enable a retired surface.
export function testSurfacesEnabled(_runtime: unknown, _hostname: string): boolean {
  return false;
}
export type TestSurfaceRuntime = Record<string, unknown>;
