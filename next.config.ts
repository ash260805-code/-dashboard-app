import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  serverExternalPackages: [
    "@sparticuz/chromium",
    "puppeteer-core",
    "puppeteer-extra-plugin-stealth",
    "is-plain-object",
    "merge-deep",
    "clone-deep"
  ],
};

export default nextConfig;
