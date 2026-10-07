import SiteFooter from "@/components/site/SiteFooter";
import SiteHeader from "@/components/site/SiteHeader";
import { loadPublicSettings } from "@/lib/publicJoin";
import { withContactDefaults } from "@/lib/siteContent";
import { moroccoToday, type PublicOrgInfo } from "@/app/join/joinShared";

// Public website (no sign-in): Home, About, What we do, Contact, Privacy.
export default async function SiteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  let org: PublicOrgInfo = { organizationName: "Volunteer in Morocco" };
  try {
    org = (await loadPublicSettings()).org;
  } catch (error) {
    console.error("Public site: could not load organisation settings:", error);
  }
  const contact = withContactDefaults(org);

  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-800">
      <SiteHeader organizationName={contact.organizationName} />
      <main className="flex-1">{children}</main>
      <SiteFooter contact={contact} year={moroccoToday().slice(0, 4)} />
    </div>
  );
}
