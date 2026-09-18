/** @type {import('next').NextConfig} */
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    // T1-042: Next.js App Router WAJIB `script-src 'unsafe-inline'` (bootstrap/flight
    // inline). Tanpa itu hydration mati total (E2E debug: CSP blocked + __next_r error).
    // XSS tetap ditangani berlapis: React auto-escape, tanpa dangerouslySetInnerHTML,
    // tolak markup di shared/Zod, maxLength, onPaste plaintext-only.
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Content-Security-Policy',
            // P2 #17: hardening — tambah object-src/base-uri/frame-ancestors.
            value:
              `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ${apiUrl}; object-src 'none'; base-uri 'self'; frame-ancestors 'none'`,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
