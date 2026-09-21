import type { NextConfig } from "next";
import { baselineSecurityHeaders, contentSecurityPolicy } from './app/lib/security-headers';

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: '/:path*', headers: [
      {key: 'Content-Security-Policy', value: contentSecurityPolicy(undefined, process.env.NODE_ENV === 'development')},
      ...Object.entries(baselineSecurityHeaders).map(([key,value]) => ({key,value})),
    ] }];
  },
};
export default nextConfig;
