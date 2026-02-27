import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhook(.*)'
]);

// Routes that should redirect to dashboard if already authenticated
const isAuthRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/'
]);

export default clerkMiddleware(async (auth, request) => {
  const authObj = await auth();
  const { userId } = authObj;
  
  // If user is authenticated and trying to access auth routes, redirect to dashboard
  if (userId && isAuthRoute(request)) {
    return Response.redirect(new URL('/dashboard', request.url));
  }
  
  // Protect non-public routes with Clerk
  if (!isPublicRoute(request)) {
    if (!userId) {
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
