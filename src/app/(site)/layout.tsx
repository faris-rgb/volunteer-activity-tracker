import SiteFooter from "@/components/site/SiteFooter";
import SiteHeader from "@/components/site/SiteHeader";
import { loadPublicSettings } from "@/lib/publicJoin";
import { withContactDefaults } from "@/lib/siteContent";
import { SITE_URL } from "@/lib/siteUrl";
import { getSiteDictionary } from "@/i18n/site";
import { LOCALE_LABELS } from "@/i18n/locales";
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
  const { locale, t } = await getSiteDictionary();

  // Structured data so Google understands who we are and where (shown in search and Maps results).
  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "NGO",
    name: contact.organizationName,
    alternateName: ["VIM", "Volunteer in Morocco Martil", "جمعية Volunteer in Morocco"],
    url: SITE_URL,
    logo: `${SITE_URL}/brand/vim-logo.jpg`,
    image: `${SITE_URL}/brand/vim-logo.jpg`,
    description:
      "Membership-based youth volunteering association in Martil & Tetouan, Morocco, founded in 2017. European Solidarity Corps Quality Label.",
    foundingDate: "2017",
    email: contact.email,
    telephone: contact.phone.replace(/\s/g, ""),
    address: {
      "@type": "PostalAddress",
      streetAddress: "Route nationale N°16, Av. Miramar",
      addressLocality: "Martil",
      addressRegion: "Tétouan",
      addressCountry: "MA",
    },
    areaServed: ["Martil", "Tetouan", "Morocco"],
    sameAs: [contact.instagramUrl, contact.facebookUrl],
  };

  return (
    <div lang={locale} dir={LOCALE_LABELS[locale].dir} className="flex min-h-screen flex-col bg-white text-slate-800">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd).replace(/</g, "\\u003c") }}
      />
      <SiteHeader organizationName={contact.organizationName} locale={locale} t={t} />
      <main className="flex-1">{children}</main>
      <SiteFooter contact={contact} year={moroccoToday().slice(0, 4)} t={t} />
    </div>
  );
}
