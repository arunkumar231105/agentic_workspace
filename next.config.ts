import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Google profile photos (Firebase photoURL), shown on avatars and workspace cards.
  images: {
    remotePatterns: [{ protocol: "https", hostname: "lh3.googleusercontent.com" }],
  },
};

export default nextConfig;
