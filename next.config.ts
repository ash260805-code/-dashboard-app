import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  serverExternalPackages: [
    "@sparticuz/chromium",
    "puppeteer-core",
    "puppeteer-extra",
    "puppeteer-extra-plugin-stealth",
    "merge-deep",
    "clone-deep",
    "is-plain-object",
    "kind-of",
    "shallow-clone",
    "deep-extend"
  ],
};

export default nextConfig;
