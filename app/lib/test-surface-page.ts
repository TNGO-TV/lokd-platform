import { env } from 'cloudflare:workers';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { testSurfacesEnabled, type TestSurfaceRuntime } from './test-surface-policy';

export async function pageTestSurfacesEnabled() {
  return testSurfacesEnabled(env as TestSurfaceRuntime, (await headers()).get('host') ?? '');
}

export async function requireTestSurfacePage() {
  if (!await pageTestSurfacesEnabled()) notFound();
}
