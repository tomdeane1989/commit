import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker optimization - enables standalone output
  output: 'standalone',
  
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
