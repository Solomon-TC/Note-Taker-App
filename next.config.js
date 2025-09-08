/** @type {import('next').NextConfig} */

const nextConfig = {
    images: {
        domains: ['images.unsplash.com', 'api.dicebear.com'],
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'images.unsplash.com',
            },
            {
                protocol: 'https',
                hostname: 'api.dicebear.com',
            }
        ]
    },
    // Optimize for Vercel deployment
    experimental: {
        serverComponentsExternalPackages: ['@supabase/supabase-js']
    },
    // Environment variable validation
    env: {
        CUSTOM_KEY: process.env.CUSTOM_KEY,
    },
    // Build optimization
    compiler: {
        removeConsole: process.env.NODE_ENV === 'production'
    },
    // Handle missing environment variables gracefully
    webpack: (config, { isServer }) => {
        if (!isServer) {
            config.resolve.fallback = {
                ...config.resolve.fallback,
                fs: false,
                net: false,
                tls: false,
            };
        }
        return config;
    }
};

module.exports = nextConfig;