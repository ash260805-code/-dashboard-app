import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";

// Auth configuration for middleware (without Prisma - runs in Edge)
export const authConfig: NextAuthConfig = {
    providers: [
        Credentials({
            name: "credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            // Authorize is handled in the full auth.ts, not here
            authorize: async () => null,
        }),
    ],
    callbacks: {
        jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                token.role = (user as { role?: string }).role;
                token.status = (user as { status?: string }).status;
            }
            return token;
        },
        session({ session, token }) {
            if (session.user) {
                session.user.id = token.id as string;
                session.user.role = token.role as string;
                session.user.status = token.status as string;
            }
            return session;
        },
        authorized({ auth, request }) {
            const { nextUrl } = request;
            const isLoggedIn = !!auth?.user;
            const user = auth?.user as { role?: string; status?: string } | undefined;

            const isAuthPage = nextUrl.pathname.startsWith("/login") ||
                nextUrl.pathname.startsWith("/signup");
            const isAdminPage = nextUrl.pathname.startsWith("/admin");
            const isDashboardPage = nextUrl.pathname.startsWith("/dashboard");
            const isPendingPage = nextUrl.pathname.startsWith("/pending");
            const isApiRoute = nextUrl.pathname.startsWith("/api");
            const isPublicPage = nextUrl.pathname === "/";

            // Allow API routes and public pages
            if (isApiRoute || isPublicPage) return true;

            // Auth pages only for unauthenticated users
            if (isAuthPage) return !isLoggedIn;

            // Require authentication for protected routes
            if (!isLoggedIn) return false;

            // Handle user status
            if (user?.status === "PENDING") {
                if (isPendingPage) return true;
                return Response.redirect(new URL("/pending", nextUrl));
            }

            if (user?.status === "REJECTED") {
                return Response.redirect(new URL("/login?error=rejected", nextUrl));
            }

            // Admin-only pages
            if (isAdminPage && user?.role !== "ADMIN") {
                return Response.redirect(new URL("/dashboard", nextUrl));
            }

            // Dashboard requires approval
            if (isDashboardPage && user?.status !== "APPROVED") {
                return Response.redirect(new URL("/pending", nextUrl));
            }

            return true;
        },
    },
    pages: {
        signIn: "/login",
    },
    session: {
        strategy: "jwt",
    },
};

// export const { auth: middleware } = NextAuth(authConfig);
