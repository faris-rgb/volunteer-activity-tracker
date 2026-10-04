import "server-only";
import { createClient } from "@sanity/client";

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "mock-project-id";
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || "production";
const apiVersion = "2026-06-27";

/** True when a real Sanity project is configured; otherwise actions fall back to in-memory data. */
export function isSanityConfigured(): boolean {
  return (
    !!process.env.NEXT_PUBLIC_SANITY_PROJECT_ID &&
    process.env.NEXT_PUBLIC_SANITY_PROJECT_ID !== "placeholder_project_id" &&
    process.env.NEXT_PUBLIC_SANITY_PROJECT_ID !== "mock-project-id"
  );
}

// Client for reading data. Uses the token (server-side only) so private datasets
// and private documents (ids containing ".") can be read.
export const sanityClient = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: false, // Fresh data immediately after updates
  token: process.env.SANITY_API_WRITE_TOKEN,
});

// Client for writing data (requires token, must be run on server side)
export const sanityWriteClient = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: false,
  token: process.env.SANITY_API_WRITE_TOKEN,
});
