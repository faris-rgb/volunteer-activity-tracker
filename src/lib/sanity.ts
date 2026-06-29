import { createClient } from "@sanity/client";

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "mock-project-id";
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || "production";
const apiVersion = "2026-06-27";

// Client for reading data (can be cached or uncached)
export const sanityClient = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: false, // Set to false to ensure we get fresh data immediately upon updates
});

// Client for writing data (requires token, must be run on server side)
export const sanityWriteClient = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: false,
  token: process.env.SANITY_API_WRITE_TOKEN,
});
