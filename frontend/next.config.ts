import type { NextConfig } from "next";

const isCapacitor = process.env.CAPACITOR_BUILD === 'true';
const isWeb = process.env.WEB_BUILD === 'true';

const nextConfig: NextConfig = {
  ...((isCapacitor || isWeb) && {
    output: 'export',
    trailingSlash: true,
  }),
  images: {
    unoptimized: true,
  },
  reactStrictMode: true,
};

export default nextConfig;
