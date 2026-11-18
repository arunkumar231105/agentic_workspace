import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev server only serves its browser scripts to localhost by default. The deployed
  // server (opened by IP) runs `next dev` too, so allow that host or nothing hydrates.
  allowedDevOrigins: ["31.97.110.197"],
  // Google profile photos (Firebase photoURL), shown on avatars and workspace cards.
  images: {
    remotePatterns: [{ protocol: "https", hostname: "lh3.googleusercontent.com" }],
  },
};

export default nextConfig;
