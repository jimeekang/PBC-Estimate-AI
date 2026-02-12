/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_API_KEY: process.env.FIREBASE_API_KEY,
    NEXT_PUBLIC_AUTH_DOMAIN: process.env.FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_MESSAGING_SENDER_ID: process.env.FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_APP_ID: process.env.FIREBASE_APP_ID,
  },
};

export default nextConfig;
