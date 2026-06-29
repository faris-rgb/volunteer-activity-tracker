"use server";

import { revalidatePath } from "next/cache";
import { sanityClient, sanityWriteClient } from "@/lib/sanity";

export interface VolunteerData {
  _id?: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  country?: string;
  city?: string;
  languages?: string[];
  skills?: string[];
  notes?: string;
  active: boolean;
  createdAt?: string;
}

// In-memory mock database for fallback when Sanity is not yet configured or fails.
// This allows the app to run in standalone demo mode immediately.
// Placeholder data removed; rely on Sanity CMS for volunteers.
let mockVolunteers: VolunteerData[] = [];

const isSanityConfigured = () => {
  return (
    process.env.NEXT_PUBLIC_SANITY_PROJECT_ID &&
    process.env.NEXT_PUBLIC_SANITY_PROJECT_ID !== "placeholder_project_id"
  );
};

export async function getVolunteersAction(): Promise<VolunteerData[]> {
  if (!isSanityConfigured()) {
    console.warn("Sanity Project ID not configured. Falling back to local mock data.");
    return mockVolunteers;
  }

  try {
    const query = `*[_type == "volunteer"] | order(createdAt desc)`;
    const volunteers = await sanityClient.fetch<VolunteerData[]>(query);
    return volunteers;
  } catch (error) {
    console.error("Failed to fetch from Sanity CMS:", error);
    return mockVolunteers; // fallback
  }
}

export async function createVolunteerAction(data: VolunteerData): Promise<VolunteerData> {
  const newDoc = {
    _type: "volunteer",
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email,
    phoneNumber: data.phoneNumber || "",
    country: data.country || "",
    city: data.city || "",
    languages: data.languages || [],
    skills: data.skills || [],
    notes: data.notes || "",
    active: data.active,
    createdAt: new Date().toISOString(),
  };

  if (!isSanityConfigured()) {
    console.warn("Sanity Project ID not configured. Saving to local mock data.");
    const mockDoc: VolunteerData = {
      ...newDoc,
      _id: `mock-${Date.now()}`,
    };
    mockVolunteers = [mockDoc, ...mockVolunteers];
    revalidatePath("/volunteers");
    revalidatePath("/");
    return mockDoc;
  }

  try {
    const response = await sanityWriteClient.create(newDoc);
    revalidatePath("/volunteers");
    revalidatePath("/");
    return response as unknown as VolunteerData;
  } catch (error) {
    console.error("Failed to create volunteer in Sanity CMS:", error);
    throw new Error("Sanity write failed. Please check write token permissions.");
  }
}

export async function updateVolunteerAction(id: string, data: VolunteerData): Promise<VolunteerData> {
  const updateData = {
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email,
    phoneNumber: data.phoneNumber || "",
    country: data.country || "",
    city: data.city || "",
    languages: data.languages || [],
    skills: data.skills || [],
    notes: data.notes || "",
    active: data.active,
  };

  if (!isSanityConfigured() || id.startsWith("mock-")) {
    console.warn("Updating local mock data.");
    mockVolunteers = mockVolunteers.map((vol) =>
      vol._id === id ? { ...vol, ...updateData } : vol
    );
    revalidatePath("/volunteers");
    revalidatePath("/");
    return mockVolunteers.find((vol) => vol._id === id) as VolunteerData;
  }

  try {
    const response = await sanityWriteClient
      .patch(id)
      .set(updateData)
      .commit();
    revalidatePath("/volunteers");
    revalidatePath("/");
    return response as unknown as VolunteerData;
  } catch (error) {
    console.error("Failed to update volunteer in Sanity CMS:", error);
    throw new Error("Sanity update failed. Please check write token permissions.");
  }
}

export async function deleteVolunteerAction(id: string): Promise<boolean> {
  if (!isSanityConfigured() || id.startsWith("mock-")) {
    console.warn("Deleting from local mock data.");
    mockVolunteers = mockVolunteers.filter((vol) => vol._id !== id);
    revalidatePath("/volunteers");
    revalidatePath("/");
    return true;
  }

  try {
    await sanityWriteClient.delete(id);
    revalidatePath("/volunteers");
    revalidatePath("/");
    return true;
  } catch (error) {
    console.error("Failed to delete volunteer from Sanity CMS:", error);
    throw new Error("Sanity delete failed. Please check write token permissions.");
  }
}
