import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @ts-ignore: Next.js dev server cross-origin access configuration
  allowedDevOrigins: ['192.168.137.1', 'localhost'],
  /* config options here */
};

export default nextConfig;
