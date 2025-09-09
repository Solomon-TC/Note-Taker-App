/** @type {import('next').NextConfig} */

const nextConfig = {
    // Optimize images
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
    
    // Critical: Optimize for Vercel deployment
    experimental: {
        serverComponentsExternalPackages: ['@supabase/supabase-js'],
        // Disable problematic features that can cause infinite builds
        optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
    },
    
    // Build optimization to prevent infinite builds
    compiler: {
        removeConsole: process.env.NODE_ENV === 'production' ? {
            exclude: ['error', 'warn']
        } : false
    },
    
    // Critical: Prevent build timeouts and infinite loops
    webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
        // Prevent client-side polyfills that can cause build issues
        if (!isServer) {
            config.resolve.fallback = {
                ...config.resolve.fallback,
                fs: false,
                net: false,
                tls: false,
                crypto: false,
                stream: false,
                url: false,
                zlib: false,
                http: false,
                https: false,
                assert: false,
                os: false,
                path: false,
            };
        }
        
        // Optimize bundle splitting to prevent memory issues
        config.optimization = {
            ...config.optimization,
            splitChunks: {
                ...config.optimization.splitChunks,
                cacheGroups: {
                    ...config.optimization.splitChunks?.cacheGroups,
                    vendor: {
                        test: /[\\/]node_modules[\\/]/,
                        name: 'vendors',
                        chunks: 'all',
                        maxSize: 244000, // Prevent chunks that are too large
                    },
                }
            }
        };
        
        // Add timeout to prevent infinite builds
        config.watchOptions = {
            ...config.watchOptions,
            poll: false,
            ignored: /node_modules/,
        };
        
        return config;
    },
    
    // Output configuration for better Vercel compatibility
    output: 'standalone',
    
    // Disable source maps in production to speed up builds
    productionBrowserSourceMaps: false,
    
    // Optimize build performance
    swcMinify: true,
    
    // Prevent build cache issues
    generateBuildId: async () => {
        return `build-${Date.now()}`;
    },
    
    // Handle environment variables gracefully
    env: {
        CUSTOM_BUILD_ID: process.env.VERCEL_GIT_COMMIT_SHA || 'local-build',
    },
    
    // Redirect configuration to prevent 404s
    async redirects() {
        return [
            // Prevent API 404s by redirecting problematic routes
            {
                source: '/api/v1/:path*',
                destination: '/404',
                permanent: false,
            },
        ];
    },
    
    // Headers to prevent caching issues
    async headers() {
        return [
            {
                source: '/(.*)',
                headers: [
                    {
                        key: 'X-Frame-Options',
                        value: 'DENY',
                    },
                    {
                        key: 'X-Content-Type-Options',
                        value: 'nosniff',
                    },
                ],
            },
        ];
    },
};

module.exports = nextConfig;