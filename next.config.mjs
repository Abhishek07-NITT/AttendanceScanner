/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["@googleapis/sheets", "google-auth-library"],
};

export default nextConfig;
