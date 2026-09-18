import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,

  experimental: {
    cpus: 1,
    workerThreads: false,
  },
};

export default nextConfig;
