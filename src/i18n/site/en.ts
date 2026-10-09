// English website texts — the source dictionary. nl.ts and ar.ts must have exactly the same keys.

export const en = {
  nav: { home: "Home", about: "About us", programmes: "What we do", contact: "Contact" },
  header: { joinUs: "Join us", staff: "Staff", staffSignIn: "Staff sign in", openMenu: "Open menu", closeMenu: "Close menu", homeLabel: "home" },
  footer: {
    tagline: "A membership-based non-profit association, founded in 2017 by and for volunteers in Martil & Tetouan.",
    explore: "Explore",
    joinUs: "Join us",
    giveFeedback: "Give feedback",
    contact: "Contact",
    whatsapp: "WhatsApp us",
    location: "Tetouan & Martil, Morocco",
    follow: "Follow us",
    escLabel: "European Solidarity Corps Quality Label — hosting & supporting organisation.",
    rights: "All rights reserved.",
    privacy: "Privacy",
    staffSignIn: "Staff sign in",
  },

  // Texts may contain **bold** parts and {placeholders}; keep both markers when translating.

  // "Four ways to volunteer" — shown on the home page and on About us.
  ways: [
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
  ],

  home: {
    meta: {
      title: "Volunteer in Morocco — Be the change in Martil & Tetouan",
      description:
        "Volunteer in Morocco is a youth volunteering association in Martil & Tetouan. Join local projects, ESC volunteering and community activities.",
    },
    hero: {
      badge: "ESC Quality Label · Since 2017",
      title: "Be the Change",
      subtitle: "Start Volunteering Today!",
      text: "We empower young people to reach their potential and create positive change in the communities of Martil, Tetouan and beyond.",
      joinUs: "Join us",
      whatWeDo: "What we do",
    },
    facts: {
      label: "At a glance",
      items: [
        { value: "2017", label: "Founded by and for volunteers" },
        { value: "Martil & Tetouan", label: "Northern Morocco" },
        { value: "ESC", label: "Quality Label until 2027" },
        { value: "4 ways", label: "To volunteer with us" },
      ],
    },
    intro: {
      eyebrow: "Empowering positive change",
      title: "Introducing Volunteer in Morocco",
      moreAboutUs: "More about us",
      paragraphs: [
        "At Volunteer in Morocco, positive change starts with individual actions. We work closely with local communities in Tetouan and the surrounding area to provide meaningful volunteering opportunities that benefit both volunteers and the communities they serve.",
        "We bring together young people and organisations from different countries and are committed to making volunteering accessible to everyone — including young people with fewer opportunities.",
      ],
    },
    ways: { eyebrow: "Get involved", title: "Four ways to volunteer with us" },
    projects: { eyebrow: "What we do", title: "Our projects", allProjects: "All projects" },
    open: { eyebrow: "Now open", title: "Projects you can apply for", apply: "Apply" },
    journey: {
      eyebrow: "Join, Journey, Joy",
      title: "Exploring the volunteer experience",
      steps: [
        { title: "Get to know us", text: "Learn about Volunteer in Morocco and choose an activity or project that suits you." },
        { title: "Sign up & confirm", text: "Send your application, meet us for a short chat and join our community." },
        {
          title: "Begin your epic adventure",
          text: "Personal growth, cultural exchange and community service — creating positive change together.",
        },
        { title: "Enjoy your epic expedition", text: "Accomplishment, new connections and joyful reflection on what you achieved." },
      ],
    },
    cta: {
      eyebrow: "See the world with your own eyes",
      title: "Embrace the call of adventure — embark on your volunteer journey.",
      joinNow: "Join now",
      askQuestion: "Ask a question",
    },
  },

  about: {
    meta: {
      title: "About us",
      description: "Who we are: a membership-based volunteering association in Martil & Tetouan, founded in 2017 by and for volunteers.",
    },
    hero: {
      eyebrow: "About us",
      title: "Volunteering by and for young people",
      text: "Volunteer in Morocco is a membership-based non-profit association, founded in 2017 by and for volunteers in Martil & Tetouan. Our members proudly call themselves **Vimians**.",
    },
    missionAndVision: "Mission and vision",
    mission: {
      title: "Our mission",
      text: "To provide life-enriching volunteering experiences for young people, so they can reach their potential — for their own benefit and for that of their communities.",
    },
    vision: {
      title: "Our vision",
      text: "To be the leading Moroccan membership-based non-profit organisation for life-enriching volunteering experiences for young people.",
    },
    values: {
      eyebrow: "What we stand for",
      title: "Our values",
      items: [
        { title: "Two-way learning", text: "Volunteers and local communities learn from each other — volunteers live and work with the community." },
        { title: "Made to measure", text: "After a first meeting we match each volunteer with activities that fit their interests and learning goals." },
        { title: "Open to everyone", text: "We make volunteering accessible to young people with fewer opportunities, minorities and women." },
        { title: "Community first", text: "Everything we do starts with the needs of the people and organisations of Martil and Tetouan." },
      ],
    },
    offer: { eyebrow: "What we offer", title: "Four ways to volunteer" },
    esc: {
      title: "European Solidarity Corps Quality Label",
      text: "We hold the European Solidarity Corps (ESC) Quality Label as both a **hosting** and a **supporting** organisation. That means we can welcome international volunteers in Martil and Tetouan, and support young Moroccans who want to volunteer abroad.",
    },
    partners: {
      title: "Our partners",
      text: "We work together with organisations in Morocco and Europe — including **Stichting Cultined** in the Netherlands, with whom we run European Solidarity Corps team projects such as Malabis Share — and with local schools, care homes and associations.",
      cta: "Want to partner with us? Get in touch",
    },
  },

  programmes: {
    meta: {
      title: "What we do",
      description:
        "Our projects in Martil & Tetouan: Malabis Share clothing bank, Project Yatra, Soccer4All, beach clean-ups, Language Café and more.",
    },
    hero: {
      eyebrow: "What we do",
      title: "Projects that create positive change",
      text: "From a dignified clothing bank to football, beach clean-ups and language exchange — this is how our volunteers make a difference in Martil and Tetouan.",
    },
    listLabel: "Our projects",
    // One entry per project; the keys are fixed page anchors (see PROGRAMME_SLUGS) — do not translate them.
    items: {
      "malabis-share": {
        title: "Malabis Share",
        tag: "Clothing bank & upcycling",
        text: "A pop-up clothing bank where families choose quality second-hand clothes in a dignified, store-like setting — with collection, repair, upcycling workshops, community art and even a fashion show.",
      },
      "project-yatra": {
        title: "Project Yatra",
        tag: "Community care",
        text: "Volunteers support local organisations, from orphanages to homes for the elderly, and spend time with the people who live there.",
      },
      soccer4all: {
        title: "Soccer4All",
        tag: "Sports & life skills",
        text: "Football sessions that build confidence, teamwork and life skills for young people in Martil and Tetouan.",
      },
      "aji-triyed": {
        title: "Aji Triyed",
        tag: "Inclusion through sport",
        text: "Social inclusion through sport and coaching, with attention for a healthy and eco-conscious lifestyle.",
      },
      "we-act": {
        title: "We Act Because We Care",
        tag: "Environment",
        text: "Beach and street clean-ups — like our clean-ups at Amsa Beach — plus environmental workshops to keep our coast beautiful.",
      },
      "language-cafe": {
        title: "Language Café",
        tag: "Languages & culture",
        text: "A relaxed meeting place where locals and international volunteers practise Darija, Arabic, French, English and more.",
      },
      "english-lessons": {
        title: "English lessons",
        tag: "Education",
        text: "Volunteers give English lessons to local young people and help them gain confidence in speaking.",
      },
      "digital-skills": {
        title: "Digital skills & media",
        tag: "Digital",
        text: "Website design, online marketing, social media, photography, filming and video editing — learning by doing for real projects.",
      },
    },
    cta: {
      title: "Want to help with one of these?",
      text: "Apply for an open project, or send a general application and we'll find a match.",
      joinUs: "Join us",
    },
  },

  contact: {
    address: "Route nationale N°16, Av. Miramar, Martil, Morocco",
    meta: {
      title: "Contact",
      description: "Get in touch with Volunteer in Morocco in Martil & Tetouan by WhatsApp, phone, email or social media.",
    },
    hero: {
      eyebrow: "Contact",
      title: "Questions? Say hello",
      text: "We're a small team in Martil & Tetouan. Send us a message and we'll get back to you — usually within a few days.",
    },
    detailsLabel: "Contact details",
    whatsappMessage: "Hi! I'd like to know more about volunteering with {organization}.",
    cards: {
      whatsapp: "WhatsApp",
      whatsappDetail: "Fastest way to reach us",
      email: "Email",
      phone: "Phone",
      visit: "Visit us",
    },
    opensInNewTab: "(opens in a new tab)",
    mapTitle: "Map of Martil, Morocco",
    follow: { title: "Follow our work", text: "See our projects, volunteers and new opportunities on social media." },
    volunteer: { title: "Want to volunteer?", text: "The quickest way is our online application form.", cta: "Apply now" },
    faq: {
      eyebrow: "FAQ",
      title: "Frequently asked questions",
      items: [
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
      ],
    },
  },

  privacy: {
    meta: {
      title: "Privacy",
      description: "How Volunteer in Morocco handles the personal data you share in our application form.",
    },
    hero: {
      eyebrow: "Privacy",
      title: "Your data, handled with care",
      text: "This page explains how Volunteer in Morocco uses the information you share with us.",
    },
    sections: [
      {
        title: "Which data we collect",
        text: "When you apply, we ask for your name, contact details, date of birth, nationality, place of residence, languages, skills, your motivation and — if you choose to share it — practical information such as diet, health notes, emergency contact and availability.",
      },
      {
        title: "Why we use it",
        text: "We use your data only to process your application, contact you about volunteering, prepare your stay and activities, and meet the reporting requirements of programmes such as the European Solidarity Corps.",
      },
      {
        title: "Who we share it with",
        text: "Your application is shared with our partner organisation Stichting Cultined and with the organisers of the project you apply for. We never sell your data and never share it for marketing.",
      },
      {
        title: "How long we keep it",
        text: "We keep your data for as long as needed for your application and volunteering, and for the period required by the programmes that fund our projects. After that we delete it.",
      },
      {
        title: "Your rights",
        text: "You can ask us at any time to see, correct or delete your data, or withdraw your consent. Contact us and we will help you.",
      },
    ],
    contact: { title: "Contact", text: "Questions about your data? Email {email}." },
  },

  feedback: {
    meta: {
      title: "Feedback",
      description: "Volunteered with us? Tell us what was fun, what wasn't and what we can do better.",
    },
    hero: {
      eyebrow: "Feedback",
      title: "How was your time with us?",
      text: "Your experience helps us make volunteering better for everyone. Give your feedback if you'd like — it's optional.",
    },
    form: {
      notice:
        "**Give your feedback if you'd like — it's optional.** Would you rather talk? Feel free to speak to one of our coaches at any time — we're happy to listen.",
      optional: "(optional)",
      name: "Your name",
      namePlaceholder: "Leave empty to stay anonymous",
      about: "Project or activity",
      aboutPlaceholder: "e.g. Malabis Share, beach clean-up",
      liked: "What was fun?",
      likedPlaceholder: "What did you enjoy the most?",
      disliked: "What was not fun?",
      dislikedPlaceholder: "What didn't you like?",
      improve: "What could be better?",
      improvePlaceholder: "Your ideas and tips for us",
      hadProblems: "Were there any problems?",
      yes: "Yes",
      no: "No",
      clear: "Clear",
      problems: "Which problems?",
      problemsPlaceholder: "Tell us what happened — we treat this confidentially.",
      send: "Send feedback",
      sending: "Sending…",
    },
    thanks: {
      title: "Thank you for your feedback!",
      text: "We read every message. If you'd like to talk about it, you're always welcome to speak to one of our coaches.",
    },
    errors: {
      tooLong: "This answer is too long.",
      maxChars: "Use {max} characters or fewer.",
      chooseYesNo: "Choose yes or no.",
      atLeastOne: "Answer at least one question — even one sentence helps us.",
      unreadable: "Your feedback could not be read. Please reload the page.",
      network: "We couldn't reach our server. Check your internet connection and try again.",
      tooManyAttempts: "Too many attempts. Please try again later.",
      tooFast: "That was quick! Please check your answers and press Send again.",
      sessionExpired: "Your form session expired. Please press Send again.",
      checkAnswers: "Please check the highlighted answers.",
      tooMuchFeedback: "We've received a lot of feedback from your connection. Please try again later.",
      sendFailed: "We couldn't send your feedback right now. Please try again in a few minutes.",
    },
  },
};

/** Same shape as the English dictionary, with any text as values (arrays keep their item shape). */
type DeepStrings<T> = T extends string
  ? string
  : T extends readonly (infer Item)[]
    ? DeepStrings<Item>[]
    : { [K in keyof T]: DeepStrings<T[K]> };
export type SiteDictionary = DeepStrings<typeof en>;
