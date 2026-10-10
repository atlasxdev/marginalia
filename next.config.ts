import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Uploads go through a server action; allow up to the 10 MB file limit plus form overhead.
  experimental: { serverActions: { bodySizeLimit: "11mb" } },
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
