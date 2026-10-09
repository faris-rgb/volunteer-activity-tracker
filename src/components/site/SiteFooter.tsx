import Link from "next/link";
import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { BrandLogo } from "@/components/BrandMark";
import { FacebookIcon, InstagramIcon } from "@/app/join/components/BrandIcons";
import { whatsappLink } from "@/lib/domain";
import { NAV_LINKS, type SiteContact } from "@/lib/siteContent";
import type { SiteDictionary } from "@/i18n/site/en";

export default function SiteFooter({
  contact,
  year,
  t,
}: {
  contact: SiteContact;
  year: string;
  t: Pick<SiteDictionary, "nav" | "footer">;
}) {
  const whatsapp = whatsappLink(contact.phone, `Hi! I'd like to know more about volunteering with ${contact.organizationName}.`);

  return (
    <footer className="bg-slate-950 text-slate-300 print:hidden">
      <div className="h-1.5 brand-rainbow" aria-hidden="true" />
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-4">
          <BrandLogo className="w-28" />
          <p className="text-sm leading-relaxed text-slate-400">
            {t.footer.tagline}
          </p>
        </div>

        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-white">{t.footer.explore}</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="hover:text-white">
                  {t.nav[link.key]}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/join" className="hover:text-white">
                {t.footer.joinUs}
              </Link>
            </li>
            <li>
              <Link href="/feedback" className="hover:text-white">
                {t.footer.giveFeedback}
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-white">{t.footer.contact}</h2>
          <ul className="mt-4 space-y-3 text-sm">
            <li className="flex items-start gap-2">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden="true" />
              <a href={`mailto:${contact.email}`} className="hover:text-white">
                {contact.email}
              </a>
            </li>
            <li className="flex items-start gap-2">
              <Phone className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden="true" />
              <a href={`tel:${contact.phone.replace(/\s/g, "")}`} className="hover:text-white">
                {contact.phone}
              </a>
            </li>
            {whatsapp && (
              <li className="flex items-start gap-2">
                <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden="true" />
                <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="hover:text-white">
                  {t.footer.whatsapp}
                </a>
              </li>
            )}
            <li className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden="true" />
              <a href={contact.mapsUrl} target="_blank" rel="noopener noreferrer" className="hover:text-white">
                {t.footer.location}
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-white">{t.footer.follow}</h2>
          <div className="mt-4 flex gap-2">
            <a
              href={contact.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram (opens in a new tab)"
              className="rounded-full border border-slate-700 p-2.5 transition-colors hover:border-red-400 hover:text-white"
            >
              <InstagramIcon className="h-5 w-5" />
            </a>
            <a
              href={contact.facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook (opens in a new tab)"
              className="rounded-full border border-slate-700 p-2.5 transition-colors hover:border-red-400 hover:text-white"
            >
              <FacebookIcon className="h-5 w-5" />
            </a>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-slate-500">
            {t.footer.escLabel}
          </p>
        </div>
      </div>
      <div className="border-t border-slate-800">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            © {year} {contact.organizationName}. {t.footer.rights}
          </p>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-slate-300">
              {t.footer.privacy}
            </Link>
            <Link href="/sign-in" className="hover:text-slate-300">
              {t.footer.staffSignIn}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
