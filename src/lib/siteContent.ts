// Public website content for Volunteer in Morocco (Martil & Tetouan).
// Based on the organisation's original website, its European Youth Portal profile and its project listings.
// Plain module: safe for client and server components.

import type { PublicOrgInfo } from "@/app/join/joinShared";

/** Public contact details shown when they are not set in Portal Settings (from the original website). */
export const DEFAULT_CONTACT = {
  email: "info@volunteerinmorocco.com",
  phone: "+212 605 724 535",
  instagramUrl: "https://www.instagram.com/volunteerinmorocco/",
  facebookUrl: "https://www.facebook.com/VolunteerinMorocco",
  address: "Route nationale N°16, Av. Miramar, Martil, Morocco",
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=Av.+Miramar+Martil+Morocco",
} as const;

export function withContactDefaults(org: PublicOrgInfo) {
  return {
    organizationName: org.organizationName,
    email: org.contactEmail || DEFAULT_CONTACT.email,
    phone: org.contactPhone || DEFAULT_CONTACT.phone,
    instagramUrl: org.instagramUrl || DEFAULT_CONTACT.instagramUrl,
    facebookUrl: org.facebookUrl || DEFAULT_CONTACT.facebookUrl,
    address: DEFAULT_CONTACT.address,
    mapsUrl: DEFAULT_CONTACT.mapsUrl,
  };
}
export type SiteContact = ReturnType<typeof withContactDefaults>;

export const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About us" },
  { href: "/programmes", label: "What we do" },
  { href: "/contact", label: "Contact" },
] as const;

export const WAYS_TO_VOLUNTEER = [
  {
    title: "Local volunteering",
    text: "Live in Martil or Tetouan? Join our weekly activities, practise languages with international volunteers and become a member — a Vimian.",
  },
  {
    title: "International (ESC) volunteering",
    text: "Aged 18–30? Come to Morocco through the European Solidarity Corps — travel, housing and food are covered by the programme.",
  },
  {
    title: "Volunteers from other Moroccan cities",
    text: "We host young Moroccans from all over the country who want to volunteer, meet new people and grow.",
  },
  {
    title: "Volunteering abroad",
    text: "We support young Moroccans who want to volunteer in Europe and beyond, together with our partner organisations.",
  },
] as const;

export const PROGRAMMES = [
  {
    slug: "malabis-share",
    title: "Malabis Share",
    tag: "Clothing bank & upcycling",
    text: "A pop-up clothing bank where families choose quality second-hand clothes in a dignified, store-like setting — with collection, repair, upcycling workshops, community art and even a fashion show.",
  },
  {
    slug: "project-yatra",
    title: "Project Yatra",
    tag: "Community care",
    text: "Volunteers support local organisations, from orphanages to homes for the elderly, and spend time with the people who live there.",
  },
  {
    slug: "soccer4all",
    title: "Soccer4All",
    tag: "Sports & life skills",
    text: "Football sessions that build confidence, teamwork and life skills for young people in Martil and Tetouan.",
  },
  {
    slug: "aji-triyed",
    title: "Aji Triyed",
    tag: "Inclusion through sport",
    text: "Social inclusion through sport and coaching, with attention for a healthy and eco-conscious lifestyle.",
  },
  {
    slug: "we-act",
    title: "We Act Because We Care",
    tag: "Environment",
    text: "Beach and street clean-ups — like our clean-ups at Amsa Beach — plus environmental workshops to keep our coast beautiful.",
  },
  {
    slug: "language-cafe",
    title: "Language Café",
    tag: "Languages & culture",
    text: "A relaxed meeting place where locals and international volunteers practise Darija, Arabic, French, English and more.",
  },
  {
    slug: "english-lessons",
    title: "English lessons",
    tag: "Education",
    text: "Volunteers give English lessons to local young people and help them gain confidence in speaking.",
  },
  {
    slug: "digital-skills",
    title: "Digital skills & media",
    tag: "Digital",
    text: "Website design, online marketing, social media, photography, filming and video editing — learning by doing for real projects.",
  },
] as const;

export const JOURNEY = [
  { title: "Get to know us", text: "Learn about Volunteer in Morocco and choose an activity or project that suits you." },
  { title: "Sign up & confirm", text: "Send your application, meet us for a short chat and join our community." },
  {
    title: "Begin your epic adventure",
    text: "Personal growth, cultural exchange and community service — creating positive change together.",
  },
  { title: "Enjoy your epic expedition", text: "Accomplishment, new connections and joyful reflection on what you achieved." },
] as const;

export const FAQ = [
  {
    q: "Do I need experience to volunteer?",
    a: "No. Motivation and an open mind are what matter. We match you with activities that fit your skills and interests.",
  },
  {
    q: "What does ESC volunteering cost?",
    a: "European Solidarity Corps volunteering is funded by the EU programme: travel (up to a set amount), accommodation, food and insurance are covered. You can't be charged a fee to take part.",
  },
  {
    q: "How old do I have to be?",
    a: "ESC projects are for people aged 18–30. For local activities we also welcome younger volunteers with permission from a parent or guardian.",
  },
  {
    q: "Which languages are spoken?",
    a: "Darija, Arabic and French are spoken locally; our international volunteers often use English. Basic English helps but is not required.",
  },
  {
    q: "Do I need a visa?",
    a: "Many nationalities can visit Morocco visa-free for up to 90 days. Requirements differ per country, so please check with the Moroccan embassy in your country before you travel.",
  },
  {
    q: "Where do international volunteers stay?",
    a: "In shared volunteer accommodation in Martil or Tetouan. We welcome you on arrival, usually at Tetouan or Tangier airport.",
  },
] as const;
