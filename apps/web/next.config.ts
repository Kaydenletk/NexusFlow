import path from "node:path";
import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  transpilePackages: ["@quantified-self/contracts"],
  outputFileTracingRoot: path.resolve(currentDirectory, "../.."),
};

export default nextConfig;
