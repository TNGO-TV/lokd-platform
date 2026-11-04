import { PUBLIC_SITE_URL } from "../lib/public-site";
export function GET() { return Response.redirect(new URL("/terms", PUBLIC_SITE_URL), 301); }
export function HEAD() { return GET(); }
