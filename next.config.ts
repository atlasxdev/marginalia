import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Exams became events, which can be anything with a date
  async redirects() {
    return [
      { source: "/exams", destination: "/events", permanent: true },
      { source: "/exams/:id", destination: "/events/:id", permanent: true },
    ];
  },
  cacheComponents: true,
  partialPrefetching: true,
  // Notes with handwriting are saved through a Server Action, so allow more than the 1 MB default
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
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
