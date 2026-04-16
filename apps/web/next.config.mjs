/** @type {import('next').NextConfig} */

const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";

// Extract origin (scheme + host) for CSP connect-src
let apiOrigin = "http://localhost:4000";
try {
  apiOrigin = new URL(apiBase).origin;
} catch {
  // keep default
}

const isDev = process.env.NODE_ENV !== "production";

/**
 * Content Security Policy
 *
 * Next.js injects inline <script> tags for hydration that cannot be
 * fingerprinted with hashes at build time without a custom nonce-based
 * middleware. Until that middleware is in place, we must allow
 * 'unsafe-inline' for scripts in BOTH dev and prod so the app renders.
 *
 * 'unsafe-eval' is restricted to dev only (needed by webpack HMR).
 *
 * Other directives remain strict:
 *  - object-src, frame-src, frame-ancestors all locked to 'none'
 *  - connect-src limited to self + API origin
 *  - img-src allows data: and blob: for photo previews and canvas exports
 */
const cspDirectives = [
  "default-src 'self'",
  // Scripts: unsafe-inline is required for Next.js hydration scripts.
  // unsafe-eval is restricted to dev (webpack HMR) only.
  isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'",
  // Styles: Tailwind requires unsafe-inline
  "style-src 'self' 'unsafe-inline'",
  // Images: data URIs for base64 photo previews, blob for canvas/camera
  "img-src 'self' data: blob:",
  // Fonts served from same origin
  "font-src 'self'",
  // Camera feed is a blob: MediaStream URL
  "media-src 'self' blob:",
  // Web workers and canvas toBlob()
  "worker-src 'self' blob:",
  // API fetch calls only to our own API origin
  `connect-src 'self' ${apiOrigin}`,
  // No iframes
  "frame-src 'none'",
  "frame-ancestors 'none'",
  // No Flash / plugins
  "object-src 'none'",
  // Disallow base tag hijacking
  "base-uri 'self'",
  // Only allow form submissions to self
  "form-action 'self'",
  // Upgrade any accidental http:// sub-resource requests
  "upgrade-insecure-requests"
]
  .filter(Boolean)
  .join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",

  // Hide "X-Powered-By: Next.js"
  poweredByHeader: false,

  // Brotli / gzip compression
  compress: true,

  experimental: {
    // Tree-shake barrel files — reduces lucide-react from ~400 kB to only icons used
    optimizePackageImports: ["lucide-react"],
  },

  async headers() {
    return [
      {
        // Immutable cache for versioned static chunks — browser never re-downloads these
        source: "/_next/static/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" }
        ]
      },
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value:
              "camera=(self), microphone=(), geolocation=(), payment=(), usb=(), fullscreen=(self)"
          },
          { key: "X-DNS-Prefetch-Control", value: "off" },
          { key: "X-Download-Options", value: "noopen" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload"
          },
          { key: "Content-Security-Policy", value: cspDirectives }
        ]
      }
    ];
  }
};

export default nextConfig;
