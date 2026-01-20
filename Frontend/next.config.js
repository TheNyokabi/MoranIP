const withPWA = require('next-pwa')({
    dest: 'public',
    register: true,
    skipWaiting: true,
    disable: process.env.NODE_ENV === 'development',
    fallbacks: {
        document: '/offline.html',
    },
    runtimeCaching: [
        {
            urlPattern: /^https:\/\/fonts\.(?:gstatic|googleapis)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
                cacheName: 'google-fonts',
                expiration: {
                    maxEntries: 20,
                    maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
                },
            },
        },
        {
            urlPattern: /\.(?:eot|otf|ttc|ttf|woff|woff2|font\.css)$/i,
            handler: 'StaleWhileRevalidate',
            options: {
                cacheName: 'static-fonts',
                expiration: {
                    maxEntries: 20,
                    maxAgeSeconds: 60 * 60 * 24 * 7, // 1 week
                },
            },
        },
        {
            urlPattern: /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,
            handler: 'StaleWhileRevalidate',
            options: {
                cacheName: 'static-images',
                expiration: {
                    maxEntries: 64,
                    maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                },
            },
        },
        {
            urlPattern: /\.(?:js)$/i,
            handler: 'StaleWhileRevalidate',
            options: {
                cacheName: 'static-js',
                expiration: {
                    maxEntries: 32,
                    maxAgeSeconds: 60 * 60 * 24, // 1 day
                },
            },
        },
        {
            urlPattern: /\.(?:css|less)$/i,
            handler: 'StaleWhileRevalidate',
            options: {
                cacheName: 'static-styles',
                expiration: {
                    maxEntries: 32,
                    maxAgeSeconds: 60 * 60 * 24, // 1 day
                },
            },
        },
        {
            urlPattern: /\/api\/.*$/i,
            handler: 'NetworkFirst',
            options: {
                cacheName: 'api-cache',
                networkTimeoutSeconds: 10,
                expiration: {
                    maxEntries: 50,
                    maxAgeSeconds: 60 * 5, // 5 minutes
                },
            },
        },
    ],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone',
    reactStrictMode: true,
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: '**',
            },
        ],
    },
};

module.exports = withPWA(nextConfig);
