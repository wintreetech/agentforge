import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/dashboard", "/admin", "/api/", "/checkout", "/cart", "/dev/", "/wishlist", "/compare"] }],
    sitemap: `${env.appUrl}/sitemap.xml`,
  };
}
