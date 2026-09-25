/** @type {import('next').NextConfig} */
const nextConfig = {
  // Defaults to .next. Overridable so a production build can run without
  // fighting a dev server that already holds the default directory.
  // `qualities` lists every quality an <Image> uses; required from Next.js 16.
  images: { formats: ['image/webp'], qualities: [75, 80] },
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
