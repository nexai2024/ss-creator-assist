import { ConvexReactClient } from "convex/react";

export const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;
export const convexSiteUrl = (import.meta.env.VITE_CONVEX_SITE_URL as string | undefined)
  ?? (convexUrl ? convexUrl.replace(".convex.cloud", ".convex.site") : undefined);

export const convexConfigured = Boolean(convexUrl);

export const convex = new ConvexReactClient(convexUrl || "https://placeholder.convex.cloud");
