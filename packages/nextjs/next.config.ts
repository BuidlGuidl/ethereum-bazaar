import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  typescript: {
    ignoreBuildErrors: process.env.NEXT_PUBLIC_IGNORE_BUILD_ERROR === "true",
  },
  eslint: {
    ignoreDuringBuilds: process.env.NEXT_PUBLIC_IGNORE_BUILD_ERROR === "true",
  },
  webpack: config => {
    config.resolve.fallback = { fs: false, net: false, tls: false };
    config.externals.push("pino-pretty", "lokijs", "encoding");
    return config;
  },
};

const isIpfs = process.env.NEXT_PUBLIC_IPFS_BUILD === "true";

if (isIpfs) {
  nextConfig.output = "export";
  nextConfig.trailingSlash = true;
  nextConfig.images = {
    unoptimized: true,
    dangerouslyAllowSVG: true,
  };
}

if (!isIpfs) {
  const defaultHosts = [
    { hostname: "gateway.pinata.cloud", pathname: "/ipfs/**" },
    { hostname: "ipfs.io", pathname: "/ipfs/**" },
    { hostname: "cloudflare-ipfs.com", pathname: "/ipfs/**" },
    { hostname: "w3s.link", pathname: "/ipfs/**" },
    { hostname: "nftstorage.link", pathname: "/ipfs/**" },
    { hostname: "imagedelivery.net", pathname: "/**" },
  ];
  const remotePatterns: { protocol: "http" | "https"; hostname: string; pathname: string }[] = [];
  for (const h of defaultHosts) {
    remotePatterns.push({ protocol: "https", hostname: h.hostname, pathname: h.pathname });
  }
  const pinataEnv = process.env.NEXT_PUBLIC_PINATA_GATEWAY;
  if (pinataEnv) {
    try {
      const u = new URL(pinataEnv);
      if (!remotePatterns.some(r => r.hostname === u.hostname)) {
        remotePatterns.push({
          protocol: u.protocol.replace(":", "") as "http" | "https",
          hostname: u.hostname,
          pathname: "/ipfs/**",
        });
      }
    } catch {
      // ignore invalid env value
    }
  }
  nextConfig.images = { remotePatterns, dangerouslyAllowSVG: true } as any;
}

module.exports = nextConfig;
