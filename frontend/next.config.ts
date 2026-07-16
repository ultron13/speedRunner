import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  output: "standalone",
  images: {
    unoptimized: true,
  },
  // Skip type checking during build for faster builds
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
