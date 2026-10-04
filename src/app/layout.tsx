import type { ComponentProps } from "react";
import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: "ServeTrack - Volunteer & Activity Tracker",
  description: "A production-ready platform to track activities, manage volunteers, and record attendance.",
};

export const viewport: Viewport = {
  themeColor: "#020617",
  colorScheme: "dark",
};

const clerkAppearance: ComponentProps<typeof ClerkProvider>["appearance"] = {
  variables: {
    colorPrimary: "#10b981",
    colorPrimaryForeground: "#020617",
    colorBackground: "#0f172a",
    colorForeground: "#f1f5f9",
    colorMuted: "#1e293b",
    colorMutedForeground: "#94a3b8",
    colorNeutral: "#f1f5f9",
    colorInput: "#020617",
    colorInputForeground: "#f1f5f9",
    colorBorder: "#334155",
    colorRing: "#10b981",
    colorDanger: "#f43f5e",
    colorSuccess: "#10b981",
    colorWarning: "#f59e0b",
    colorModalBackdrop: "#020617",
    borderRadius: "0.75rem",
  },
  elements: {
    providerIcon__apple: { filter: "invert(1)" },
    providerIcon__github: { filter: "invert(1)" },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-screen bg-slate-950! text-slate-100! font-sans">
        <ClerkProvider
          appearance={clerkAppearance}
          signInUrl="/sign-in"
          signUpUrl="/sign-up"
          signInFallbackRedirectUrl="/"
          signUpFallbackRedirectUrl="/"
          afterSignOutUrl="/sign-in"
        >
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
