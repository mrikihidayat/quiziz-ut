/** @type {import('next').NextConfig} */
const nextConfig = {
  // Diperlukan agar pdf-parse bisa berjalan di Route Handler (Node.js runtime)
  serverExternalPackages: ['pdf-parse'],
};

module.exports = nextConfig;
