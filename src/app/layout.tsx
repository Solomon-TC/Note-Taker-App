import { TempoInit } from "@/components/tempo-init";
import { AuthProvider } from "@/components/auth/AuthProvider";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "StudyMate - Gamified Note-Taking",
  description:
    "A gamified note-taking platform with AI assistance for college students",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <Script src="https://api.tempo.build/proxy-asset?url=https://storage.googleapis.com/tempo-public-assets/error-handling.js" />
      <body className={inter.className}>
        <AuthProvider>{children}</AuthProvider>
        <TempoInit />
      </body>
    </html>
  );
}
