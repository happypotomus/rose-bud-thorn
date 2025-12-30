/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: '/',
        destination: '/invite',
        permanent: true, // 308 redirect (permanent)
      },
    ];
  },
};

export default nextConfig;
