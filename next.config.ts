
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
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    NEXT_PUBLIC_STRIPE_PRO_PRICE_ID_MONTHLY: process.env.STRIPE_PRO_PRICE_ID_MONTHLY,
    NEXT_PUBLIC_STRIPE_PRO_PRICE_ID_YEARLY: process.env.STRIPE_PRO_PRICE_ID_YEARLY,
    NEXT_PUBLIC_SITE_URL: process.env.APP_URL || 'http://localhost:9002',
    APP_URL: process.env.APP_URL,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  }
};

export default nextConfig;
