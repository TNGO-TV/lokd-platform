import type { TestSurfaceRuntime } from './test-surface-policy';

export type RehearsalRuntime = TestSurfaceRuntime & {
  DB?: D1Database;
  TEST_DB?: D1Database;
  TEST_BUCKET?: R2Bucket;
};

export async function isolatedRehearsalStorage(runtime: RehearsalRuntime) {
  if (!runtime.DB || !runtime.TEST_DB || runtime.DB === runtime.TEST_DB) return false;
  try {
    // Detect distinct binding objects pointing at the same marked database.
    const primaryMarked = await runtime.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='lokd_rehearsal_instance'").first();
    if (primaryMarked) return false;
    const marker = await runtime.TEST_DB.prepare('SELECT mode, version FROM lokd_rehearsal_instance WHERE singleton=1').first<{mode:string;version:number}>();
    return marker?.mode === 'isolated-rehearsal' && marker.version === 1;
  } catch { return false; }
}

