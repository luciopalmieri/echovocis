import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EchoVocis — Learn Languages by Voice",
  description:
    "Improve your spoken fluency through real-time conversation with Emma, your AI voice coach.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
