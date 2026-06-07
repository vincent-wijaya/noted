import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@prisma/client",
    "@prisma/adapter-pg",
    "@xenova/transformers",
    "pg",
  ],
};

export default nextConfig;
