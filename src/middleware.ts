import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhook(.*)'
]);

export default clerkMiddleware(async (auth, request) => {
  // Protect non-public routes with Clerk
  if (!isPublicRoute(request)) {
    const authObj = await auth();
    if (!authObj.userId) {
      return authObj.redirectToSignIn();
    }
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
