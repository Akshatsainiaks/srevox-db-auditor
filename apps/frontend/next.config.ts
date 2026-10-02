import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.STANDALONE === "true" ? "standalone" : undefined,
  async rewrites() {
    const apiUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:7001";
    return [
      {
        source: "/api/:path*",
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
