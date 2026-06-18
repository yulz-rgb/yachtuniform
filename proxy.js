// Clerk auth via the Next.js 16 proxy convention (formerly middleware).
// When Clerk is not configured this is a pass-through so the app still runs
// in local mode.
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { hasClerk } from './lib/config';

const isPublicRoute = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)', '/demo(.*)']);

const clerkHandler = clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    const { userId, redirectToSignIn } = await auth();
    if (!userId) {
      return redirectToSignIn({ returnBackUrl: req.url });
    }
  }
});

export default function proxy(req, evt) {
  if (!hasClerk) return NextResponse.next();
  return clerkHandler(req, evt);
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
