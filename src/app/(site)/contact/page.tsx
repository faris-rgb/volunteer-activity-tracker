import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import PageHero from "@/components/site/PageHero";
import { FacebookIcon, InstagramIcon } from "@/app/join/components/BrandIcons";
import { whatsappLink } from "@/lib/domain";
import { loadPublicSettings } from "@/lib/publicJoin";
import { withContactDefaults } from "@/lib/siteContent";
import type { PublicOrgInfo } from "@/app/join/joinShared";
import { getSiteDictionary } from "@/i18n/site";
import { fill } from "@/i18n/rich";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getSiteDictionary();
  return {
    alternates: { canonical: "/contact" },
    title: t.contact.meta.title,
    description: t.contact.meta.description,
  };
}

export const dynamic = "force-dynamic";

export default async function ContactPage() {
  const { t } = await getSiteDictionary();
  const text = t.contact;
  let org: PublicOrgInfo = { organizationName: "Volunteer in Morocco" };
  try {
    org = (await loadPublicSettings()).org;
  } catch (error) {
    console.error("Contact page: could not load organisation settings:", error);
  }
  const contact = withContactDefaults(org);
  const whatsapp = whatsappLink(contact.phone, fill(text.whatsappMessage, { organization: contact.organizationName }));

  const cards = [
    whatsapp && { href: whatsapp, icon: MessageCircle, title: text.cards.whatsapp, detail: text.cards.whatsappDetail, external: true },
    { href: `mailto:${contact.email}`, icon: Mail, title: text.cards.email, detail: contact.email, external: false },
    { href: `tel:${contact.phone.replace(/\s/g, "")}`, icon: Phone, title: text.cards.phone, detail: contact.phone, external: false },
    { href: contact.mapsUrl, icon: MapPin, title: text.cards.visit, detail: text.address, external: true },
  ].filter(Boolean) as { href: string; icon: typeof Mail; title: string; detail: string; external: boolean }[];

  return (
    <>
      <PageHero id="contact-title" eyebrow={text.hero.eyebrow} title={text.hero.title}>
        {text.hero.text}
      </PageHero>

      <section aria-label={text.detailsLabel} className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map(({ href, icon: Icon, title, detail, external }) => (
              <li key={title}>
                <a
                  href={href}
                  {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-colors hover:border-red-300"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-brand-red">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="mt-4 text-lg font-bold text-slate-900">
                    {title}
                    {external && <span className="sr-only"> {text.opensInNewTab}</span>}
                  </span>
                  <span className="mt-1 break-words text-sm text-slate-600">{detail}</span>
                </a>
              </li>
            ))}
          </ul>

          <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-100">
              <iframe
                title={text.mapTitle}
                src="https://www.openstreetmap.org/export/embed.html?bbox=-5.30%2C35.58%2C-5.24%2C35.65&layer=mapnik&marker=35.616%2C-5.275"
                className="h-80 w-full border-0"
                loading="lazy"
              />
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
              <h2 className="text-2xl font-bold text-slate-900">{text.follow.title}</h2>
              <p className="mt-2 text-slate-600">{text.follow.text}</p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <a
                  href={contact.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 px-6 py-3 font-semibold text-slate-800 transition-colors hover:border-brand-red hover:text-brand-red"
                >
                  <InstagramIcon className="h-5 w-5" />
                  Instagram
                </a>
                <a
                  href={contact.facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 px-6 py-3 font-semibold text-slate-800 transition-colors hover:border-brand-red hover:text-brand-red"
                >
                  <FacebookIcon className="h-5 w-5" />
                  Facebook
                </a>
              </div>
              <div className="mt-8 rounded-2xl bg-red-50 p-5">
                <p className="font-semibold text-slate-900">{text.volunteer.title}</p>
                <p className="mt-1 text-sm text-slate-600">{text.volunteer.text}</p>
                <Link href="/join" className="mt-3 inline-flex items-center gap-2 font-semibold text-brand-red hover:underline">
                  {text.volunteer.cta}
                  <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="faq-title" className="bg-slate-50">
        <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-red">{text.faq.eyebrow}</p>
          <h2 id="faq-title" className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            {text.faq.title}
          </h2>
          <div className="mt-8 space-y-3">
            {text.faq.items.map((item) => (
              <details key={item.q} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-slate-900">
                  {item.q}
                  <span className="text-2xl leading-none text-brand-red transition-transform group-open:rotate-45" aria-hidden="true">
                    +
                  </span>
                </summary>
                <p className="mt-3 leading-relaxed text-slate-600">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
