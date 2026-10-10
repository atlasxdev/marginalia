import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The app has no landing page yet; send "/" straight to the chat.
  async redirects() {
    return [{ source: "/", destination: "/chat", permanent: false }];
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
