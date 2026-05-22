function getEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
}

export const env = {
  get DATABASE_URL() {
    return getEnv("DATABASE_URL");
  },
  get GOOGLE_CLIENT_ID() {
    return getEnv("GOOGLE_CLIENT_ID");
  },
  get GOOGLE_CLIENT_SECRET() {
    return getEnv("GOOGLE_CLIENT_SECRET");
  },
  get NEXTAUTH_SECRET() {
    return getEnv("NEXTAUTH_SECRET");
  },
  get NEXTAUTH_URL() {
    return process.env.NEXTAUTH_URL || "http://localhost:3000";
  },
  get ALLOWED_EMAILS() {
    return getEnv("ALLOWED_EMAILS");
  },
  get XAI_API_KEY() {
    return getEnv("XAI_API_KEY");
  },
  get SESSION_TTL_SECONDS() {
    return parseInt(process.env.SESSION_TTL_SECONDS || "300", 10);
  },
  get isEmailAllowed() {
    const allowed = this.ALLOWED_EMAILS.split(",").map((e) => e.trim().toLowerCase());
    return (email: string) => allowed.includes(email.toLowerCase());
  },
} as const;
