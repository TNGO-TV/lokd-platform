type OperationalRuntimeEnv = import('./app/lib/operational-provider').OperationalRuntime;
declare namespace Cloudflare {
  interface Env extends OperationalRuntimeEnv {
    DB?: D1Database;
    PAYSTACK_TEST_SECRET_KEY?: string;
    PAYSTACK_LIVE_SECRET_KEY?: string;
    LOKD_COLLECTION_LIVE_ENABLED?: string;
    BUCKET?: R2Bucket;
    LOKD_APP_STAGE?: string;
    LOKD_LIVE_SHIFT_SCAN?: string;
    LOKD_PILOT_ACCESS_JSON?: string;
  }
}
