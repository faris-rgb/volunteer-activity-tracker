import { requireRouteAccess } from "@/lib/auth";

export default async function SettingsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireRouteAccess("/settings");
  return children;
}
