import type { ComponentProps } from "react";
import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Outfit } from "next/font/google";
import { SITE_URL } from "@/lib/siteUrl";
import "./globals.css";

// Outfit: the typeface of the original volunteerinmorocco.com website.
const outfit = Outfit({
  subsets: ["latin", "latin-ext"],
  variable: "--font-outfit",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Volunteer in Morocco · Portal",
    template: "%s · Volunteer in Morocco",
  },
  description:
    "Volunteer in Morocco is a youth volunteering association in Martil & Tetouan, Morocco. Bénévolat au Maroc · التطوع في المغرب.",
  metadataBase: new URL(SITE_URL),
  applicationName: "Volunteer in Morocco",
  keywords: [
    "volunteer in Morocco",
    "volunteering Morocco",
    "volunteer Martil",
    "volunteer Tetouan",
    "European Solidarity Corps Morocco",
    "bénévolat Maroc",
    "bénévolat Tétouan",
    "association Martil",
    "تطوع في المغرب",
    "تطوع مرتيل",
    "جمعية تطوعية تطوان",
  ],
  openGraph: {
    type: "website",
    siteName: "Volunteer in Morocco",
    locale: "en_GB",
    alternateLocale: ["fr_FR", "ar_MA"],
    images: [{ url: "/brand/vim-logo.jpg", width: 720, height: 720, alt: "Volunteer in Morocco logo" }],
  },
  twitter: { card: "summary", images: ["/brand/vim-logo.jpg"] },
  // Google Search Console ownership check (public value, not a secret).
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || "DI7qHhcfnJsDBYHv4by-ca4ypKlWk9JdE12kTtUa5mA",
  },
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
    <html lang="en" className={`h-full antialiased ${outfit.variable}`}>
      <body className="min-h-screen app-backdrop text-slate-100! font-sans">
        <ClerkProvider
          appearance={clerkAppearance}
          signInUrl="/sign-in"
          signUpUrl="/sign-up"
          signInFallbackRedirectUrl="/dashboard"
          signUpFallbackRedirectUrl="/dashboard"
          afterSignOutUrl="/sign-in"
        >
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
