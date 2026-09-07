/** @type {import('next').NextConfig} */
const nextConfig = {
  // Defaults to .next. Overridable so a production build can run without
  // fighting a dev server that already holds the default directory.
  images: { formats: ['image/webp'] },
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
