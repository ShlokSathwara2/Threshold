import type { NextConfig } from "next";

const isCapacitor = process.env.CAPACITOR_BUILD === 'true';

const nextConfig: NextConfig = {
  ...(isCapacitor && {
    output: 'export',
    trailingSlash: true,
  }),
  images: {
    unoptimized: true,
  },
  reactStrictMode: true,
};

export default nextConfig;
