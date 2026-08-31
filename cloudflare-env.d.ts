declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    LOKD_APP_STAGE?: string;
    LOKD_LIVE_SHIFT_SCAN?: string;
    LOKD_PILOT_ACCESS_JSON?: string;
  }
}
