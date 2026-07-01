import { sanityClient } from "./src/lib/sanity";

interface VolunteerPreview {
  _id: string;
  firstName?: string;
  lastName?: string;
}

async function test() {
  try {
    const volunteers = await sanityClient.fetch<VolunteerPreview[]>(`*[_type == "volunteer"]{_id, firstName, lastName}`);
    console.log("Fetched volunteers:", volunteers);
  } catch (e) {
    console.error("Error fetching volunteers:", e);
  }
}

test();
