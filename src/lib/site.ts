// Canonical origin for metadata, robots and sitemap, without a trailing slash
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://marginalia.aceguevarra.xyz").replace(/\/+$/, "");
