import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow images from any remote domain (YouTube thumbnails)
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
  // Externalize native modules to keep them server-side only
  serverExternalPackages: ["ffmpeg-static"],
};

export default nextConfig;
