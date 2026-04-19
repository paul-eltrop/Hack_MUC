import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "34.89.205.150" },
    ],
  },
};

export default nextConfig;
