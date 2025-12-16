
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      }
    ]
  },
  env: {
    // Server-side only
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,

    // Public (client-side)
    NEXT_PUBLIC_STRIPE_PRO_PRICE_ID_MONTHLY: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID_MONTHLY,
    NEXT_PUBLIC_STRIPE_PRO_PRICE_ID_YEARLY: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID_YEARLY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:9002',
  }
};

export default nextConfig;
