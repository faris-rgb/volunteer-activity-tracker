import Sidebar from "@/components/Sidebar";
import { getDisplayName, requireAssignedRole } from "@/lib/auth";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const appUser = await requireAssignedRole();

  return (
    <div className="min-h-full flex flex-col lg:flex-row">
      <Sidebar role={appUser.role} displayName={getDisplayName(appUser)} />
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-slate-900/50">
        {children}
      </main>
    </div>
  );
}
