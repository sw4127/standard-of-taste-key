import type { NextConfig } from "next";

// A static export: plain files, no server (PRD section 2, rule 6; section 9).
const config: NextConfig = {
  output: "export",
  trailingSlash: true,
  transpilePackages: ["@sot/core"],
  images: { unoptimized: true },
};

export default config;
