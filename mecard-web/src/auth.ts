import { eq, sql } from "drizzle-orm";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { hashPassword, needsRehash, verifyPassword } from "@/lib/password";
import { onNewUser, userByLogin } from "@/lib/accounts";

// Google is optional (replaces Nextend Social Login): only wired when both env
// vars are set; the login page shows the button only then.
export const googleEnabled = !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

const byEmail = (email: string) => sql`lower(${users.email}) = ${email.toLowerCase()}`;

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  // Failed sign-ins (e.g. Google) come back to the login page with ?error=.
  pages: { signIn: "/my-account/", error: "/my-account/" },
  providers: [
    Credentials({
      credentials: {
        username: { label: "Username or email address" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const login = String(credentials?.username ?? "").trim();
        const password = String(credentials?.password ?? "");
        if (!login || !password) return null;

        const user = await userByLogin(login);
        if (!user || !(await verifyPassword(password, user.passwordHash))) return null;

        // Upgrade imported WordPress hashes to plain bcrypt on first login.
        if (needsRehash(user.passwordHash!)) {
          await db.update(users).set({ passwordHash: await hashPassword(password) }).where(eq(users.id, user.id));
        }
        return { id: String(user.id), email: user.email, name: user.displayName || null, isAdmin: user.isAdmin };
      },
    }),
    ...(googleEnabled
      ? [Google({ clientId: process.env.AUTH_GOOGLE_ID, clientSecret: process.env.AUTH_GOOGLE_SECRET })]
      : []),
  ],
  callbacks: {
    // Link-by-email for Google: an existing account (including imported
    // WordPress users) is reused; otherwise a new user gets a default workspace.
    async signIn({ user, account, profile }) {
      if (account?.provider !== "google") return true;
      const email = (profile?.email ?? user?.email ?? "").toLowerCase();
      if (!email) return false;
      if (profile && (profile as { email_verified?: boolean }).email_verified === false) return false;

      const [existing] = await db.select({ id: users.id }).from(users).where(byEmail(email)).limit(1);
      if (!existing) {
        const [created] = await db
          .insert(users)
          .values({
            email,
            firstName: (profile as { given_name?: string })?.given_name ?? "",
            lastName: (profile as { family_name?: string })?.family_name ?? "",
            displayName: user?.name ?? email,
          })
          .returning({ id: users.id });
        await onNewUser(created.id);
      }
      return true;
    },

    async jwt({ token, user, account }) {
      if (user && account?.provider === "credentials") {
        token.isAdmin = (user as { isAdmin?: boolean }).isAdmin ?? false;
        return token;
      }
      if (account && account.provider !== "credentials") {
        const email = (user?.email ?? token.email ?? "").toLowerCase();
        const [dbUser] = await db
          .select({ id: users.id, isAdmin: users.isAdmin })
          .from(users)
          .where(byEmail(email))
          .limit(1);
        if (dbUser) {
          token.sub = String(dbUser.id);
          token.isAdmin = dbUser.isAdmin;
        }
      }
      return token;
    },

    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string;
        session.user.isAdmin = Boolean(token.isAdmin);
      }
      return session;
    },
  },
});
