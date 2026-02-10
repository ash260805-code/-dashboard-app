import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { authConfig } from "./auth.config";

const prisma = new PrismaClient();

export const { handlers, signIn, signOut, auth } = NextAuth({
    ...authConfig,
    providers: [
        Credentials({
            name: "credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    return null;
                }

                const user = await prisma.user.findUnique({
                    where: { email: credentials.email as string },
                });

                if (!user) {
                    console.log("Auth Debug: User not found", credentials.email);
                    return null;
                }

                const passwordMatch = await bcrypt.compare(
                    credentials.password as string,
                    user.password
                );

                console.log("Auth Debug: Login attempt", {
                    email: credentials.email,
                    storedHash: user.password.substring(0, 10) + "...",
                    inputPassword: credentials.password,
                    match: passwordMatch
                });

                if (!passwordMatch) {
                    return null;
                }

                return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                    status: user.status,
                };
            },
        }),
    ],
});
