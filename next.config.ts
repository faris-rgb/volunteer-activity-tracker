import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The application PDF (sent from the /join server action) embeds these fonts at runtime.
  outputFileTracingIncludes: {
    "/join": ["./src/assets/fonts/*.ttf"],
  },
};

export default nextConfig;
