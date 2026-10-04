import { requireRouteAccess } from "@/lib/auth";

export default async function VolunteersLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireRouteAccess("/volunteers");
  return children;
}
