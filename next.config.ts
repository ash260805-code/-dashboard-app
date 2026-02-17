import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  serverExternalPackages: [
    "@sparticuz/chromium",
    "puppeteer-core"
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  outputFileTracingIncludes: {
    '/api/**/*': ['./bin/**/*'],
  },
};

export default nextConfig;
