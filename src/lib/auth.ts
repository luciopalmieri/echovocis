import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import type { NextAuthConfig } from "next-auth";
import { env } from "./env";

export const authOptions: NextAuthConfig = {
  providers: [
    Google({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      if (!env.isEmailAllowed(user.email)) return false;

      const { db } = await import("./db");
      const dbUser = await db.user.upsert({
        where: { email: user.email },
        update: { name: user.name, image: user.image },
        create: {
          email: user.email,
          name: user.name,
          image: user.image,
        },
      });

      user.id = dbUser.id;
      return true;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
      }
      return token;
    },
  },
  session: {
    strategy: "jwt",
  },
  secret: env.NEXTAUTH_SECRET,
};

const result = NextAuth(authOptions);
export const { auth, handlers, signIn, signOut } = result;
