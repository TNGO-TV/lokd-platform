import './register-cloudflare.mjs';
import { register } from 'node:module';

// Preserve the Cloudflare-then-finance loader chain in the offline child only.
register('./finance-event-integrity.test.mjs', import.meta.url);
