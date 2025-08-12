/** @type {import('next').NextConfig} */
const nextConfig = {
  headers: async () => {
    return [
      {
        source: '/(.*)',
        headers: [
          // {
          //   key: 'Cross-Origin-Opener-Policy',
          //   value: 'same-origin',
          // },
          // {
          //   key: 'Cross-Origin-Embedder-Policy',
          //   value: 'credentialless',
          // },
          // {
          //   key: 'Cross-Origin-Resource-Policy',
          //   value: 'cross-origin',
          // },
          {
            key: 'Content-Security-Policy',
            value: [
              "frame-src 'self' https://stackblitz.com https://*.stackblitz.io",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://*.stackblitz.io https://*.clerk.accounts.dev",
              "connect-src 'self' https://stackblitz.com https://*.stackblitz.io https://*.clerk.accounts.dev https://*.convex.cloud wss://*.convex.cloud",
              "worker-src 'self' blob:",
              "img-src 'self' data: https:",
              "style-src 'self' 'unsafe-inline'",
              "default-src 'self'"
            ].join('; ')
          }
        ],
      },
    ]
  },
}

module.exports = nextConfig
