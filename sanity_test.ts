import { sanityClient } from "./src/lib/sanity";

async function test() {
  try {
    const volunteers = await sanityClient.fetch<any>(`*[_type == "volunteer"]{_id, firstName, lastName}`);
    console.log("Fetched volunteers:", volunteers);
  } catch (e) {
    console.error("Error fetching volunteers:", e);
  }
}

test();
