"use client";

import { TempoInit } from "@/components/tempo-init";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { ErrorBoundary, AsyncErrorBoundary } from "@/components/ErrorBoundary";
import { ThemeProvider } from "next-themes";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";

function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem
        disableTransitionOnChange
      >
        <ErrorBoundary>
          <AuthProvider>
            <AsyncErrorBoundary>
              {children}
            </AsyncErrorBoundary>
          </AuthProvider>
        </ErrorBoundary>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ErrorBoundary
          onError={(error, errorInfo) => {
            console.error('🚨 Root Layout Error:', { error, errorInfo });
          }}
        >
          <ClientProviders>
            {children}
            <TempoInit />
          </ClientProviders>
        </ErrorBoundary>
      </body>
    </html>
  );
}