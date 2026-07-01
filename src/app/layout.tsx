import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "ServeTrack - Volunteer & Activity Tracker",
  description: "A production-ready platform to track activities, manage volunteers, and record attendance.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col lg:flex-row bg-slate-950 text-slate-100 font-sans">
        <Sidebar />
        <main className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-slate-900/50">
          {children}
        </main>
      </body>
    </html>
  );
}
