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
 * - 'nonce-based' approach would require middleware; use strict-dynamic for
 *   Next.js inline scripts instead.
 * - 'unsafe-inline' for styles is required by Tailwind in dev.
 * - Tighten further once a nonce-based approach is adopted.
 */
const cspDirectives = [
  "default-src 'self'",
  // Scripts: self + Next.js internals
  isDev
    ? "script-src 'self' 'unsafe-eval' 'unsafe-inline'"
    : "script-src 'self' 'strict-dynamic'",
  // Styles: Tailwind needs unsafe-inline in both dev and prod (no CSS-in-JS)
  "style-src 'self' 'unsafe-inline'",
  // Images: self + data URIs (for base64 previews) + blob (for canvas exports)
  "img-src 'self' data: blob:",
  // Fonts: self only
  "font-src 'self'",
  // Media (camera feed is blob:)
  "media-src 'self' blob:",
  // Workers and canvas blobs
  "worker-src 'self' blob:",
  // API calls
  `connect-src 'self' ${apiOrigin}`,
  // No frames
  "frame-src 'none'",
  "frame-ancestors 'none'",
  // No plugins
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests"
]
  .filter(Boolean)
  .join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",

  // Disable the "Powered-By: Next.js" header
  poweredByHeader: false,

  // Compress responses
  compress: true,

  async headers() {
    return [
      {
        // Apply to all routes
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
