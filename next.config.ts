import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  serverExternalPackages: [
    "@sparticuz/chromium",
    "puppeteer-core",
    "puppeteer-extra",
    "puppeteer-extra-plugin-stealth"
  ],
};

export default nextConfig;
