import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: { unoptimized: true },
  transpilePackages: ['@psd/shared'],
  experimental: {
    externalDir: true,
  },
  turbopack: {
    root: repoRoot,
  },
};

export default nextConfig;
