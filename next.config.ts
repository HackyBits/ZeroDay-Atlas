import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack: stub out optional jsPDF peer deps (SVG/HTML rendering we don't use)
  turbopack: {
    resolveAlias: {
      canvg:       "./lib/empty-module.js",
      html2canvas: "./lib/empty-module.js",
      dompurify:   "./lib/empty-module.js",
    },
  },
  // Webpack (used by `next build`): false = empty module
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      canvg:       false,
      html2canvas: false,
      dompurify:   false,
    };
    return config;
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options",           value: "DENY" },
          { key: "X-Content-Type-Options",     value: "nosniff" },
          { key: "Referrer-Policy",            value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy",         value: "camera=(), microphone=(), geolocation=()" },
          {
            key:   "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key:   "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "connect-src 'self' https://*.instantdb.com wss://*.instantdb.com",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
