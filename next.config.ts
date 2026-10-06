import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev badge sits bottom-left, on top of the sidebar's Log out button. Errors still show.
  devIndicators: false,
  // Lets a tablet or phone on the same Wi-Fi open the dev server by the laptop's LAN address.
  allowedDevOrigins: ["172.20.10.2", "192.168.*.*", "10.*.*.*"],
};

export default nextConfig;
