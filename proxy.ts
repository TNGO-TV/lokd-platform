import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest, type NextFetchEvent } from "next/server";
import { clerkSettings } from "./app/lib/clerk-config";

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  const settings = clerkSettings();
  // Public pages stay available during configuration. Protected page/API
  // helpers fail closed while keys are missing, with no legacy auth fallback.
  if (!settings.ready) return NextResponse.next();
  return clerkMiddleware({
    publishableKey: settings.publishableKey,
    // Clerk reads this one application's secret from process.env. Keeping it
    // out of dynamic request options avoids extra encrypted secret propagation.
    jwtKey: settings.jwtKey || undefined,
    authorizedParties: settings.authorizedParties,
    signInUrl: "/sign-in",
    signUpUrl: "/sign-up",
  })(request, event);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
