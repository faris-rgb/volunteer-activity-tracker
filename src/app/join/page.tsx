import type { Metadata } from "next";
import { connection } from "next/server";
import { getPublicJoinData, issueFormToken } from "@/lib/publicJoin";
import { moroccoToday } from "./joinShared";
import JoinClient from "./JoinClient";

// Public "Join us" page (no sign-in; src/proxy.ts allows /join). It lives outside the (app) route group,
// so it never renders the staff layout. Only public project fields and organisation contact details are
// loaded here (src/lib/publicJoin.ts) — never volunteer data.

const DESCRIPTION =
  "Volunteer with us in Martil & Tetouan: community projects, European Solidarity Corps (ESC) placements and local volunteering. Apply online in a few minutes.";

export const metadata: Metadata = {
  title: "Join us — Volunteer in Morocco",
  description: DESCRIPTION,
  openGraph: {
    title: "Volunteer in Morocco — Martil & Tetouan",
    description: DESCRIPTION,
    type: "website",
  },
};

type SearchParams = Record<string, string | string[] | undefined>;

export default async function JoinPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  // The form token records when the form was rendered, so this page must render per request.
  await connection();
  const params = await searchParams;
  const today = moroccoToday();
  const data = await getPublicJoinData(today);
  const formToken = issueFormToken();

  // /join?project=<id> (e.g. from an Instagram post) preselects that project when it is open.
  const requested = typeof params.project === "string" ? params.project : undefined;
  const initialProjectId =
    data.projects.find((project) => project.id === requested && project.acceptingApplications)?.id ?? "";

  return <JoinClient data={data} today={today} formToken={formToken} initialProjectId={initialProjectId} />;
}
