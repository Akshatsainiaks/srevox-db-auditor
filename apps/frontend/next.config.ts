import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.STANDALONE === "true" ? "standalone" : undefined,
  async rewrites() {
    const apiUrl = process.env.API_URL || "http://localhost:4000";
    const activityUrl = process.env.ACTIVITY_SERVICE_URL || "http://localhost:5005";
    return [
      {
        source: "/api/activities/:path*",
        destination: `${activityUrl}/api/activities/:path*`,
      },
      {
        source: "/api/:path*",
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
