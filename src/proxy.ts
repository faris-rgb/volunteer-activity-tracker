import { NextResponse } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/about",
  "/programmes",
  "/contact",
  "/privacy",
  "/join(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
]);

// The public website (/, /about, /programmes, /contact, /privacy, /join) and sign-in/up are open;
// everything else (the staff portal) requires a signed-in Clerk user.
// Role checks happen server-side in layouts/pages (src/lib/auth.ts) and in server actions.
export default clerkMiddleware(
  async (auth, req) => {
    if (isPublicRoute(req)) {
      return;
    }

    const { userId } = await auth();
    if (!userId) {
      // Redirect to our own sign-in page (not Clerk's hosted portal) and come back afterwards.
      const signInUrl = new URL("/sign-in", req.url);
      signInUrl.searchParams.set("redirect_url", req.nextUrl.pathname + req.nextUrl.search);
      return NextResponse.redirect(signInUrl);
    }
  },
  { signInUrl: "/sign-in", signUpUrl: "/sign-up" }
);

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
