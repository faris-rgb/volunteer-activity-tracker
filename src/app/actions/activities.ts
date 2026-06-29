"use server";

import { revalidatePath } from "next/cache";
import { sanityClient, sanityWriteClient } from "@/lib/sanity";

export interface ActivityData {
  _id?: string;
  title: string;
  description?: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  maxVolunteers: number;
  category: string;
  status: "Upcoming" | "Active" | "Completed";
  createdAt?: string;
  spotsFilled?: number; // Simulated / calculated in mockup
}

// In-memory mock database for fallback
let mockActivities: ActivityData[] = [
  {
    _id: 'act-1',
    title: 'Community Garden Planting',
    description: 'Help plant vegetables and herbs in the neighborhood garden.',
    category: 'Community',
    location: 'Greenfield Community Garden',
    date: '2026-06-28',
    startTime: '09:00 AM',
    endTime: '01:00 PM',
    maxVolunteers: 25,
    status: 'Upcoming',
    spotsFilled: 18,
    createdAt: '2026-06-27T10:00:00.000Z',
  },
  {
    _id: 'act-2',
    title: 'Beach Cleanup & Conservation',
    description: 'Gather plastic waste and marine debris to protect our local coastal ecosystems.',
    category: 'Environment',
    location: 'Sunset Harbor Beach',
    date: '2026-06-29',
    startTime: '10:00 AM',
    endTime: '02:00 PM',
    maxVolunteers: 15,
    status: 'Upcoming',
    spotsFilled: 12,
    createdAt: '2026-06-27T11:00:00.000Z',
  },
  {
    _id: 'act-3',
    title: 'Senior Center Companion Visits',
    description: "Spend time talking, playing board games, and reading with residents of Silver Pines.",
    category: 'Elderly Care',
    location: 'Silver Pines Residence',
    date: '2026-07-01',
    startTime: '02:00 PM',
    endTime: '05:00 PM',
    maxVolunteers: 10,
    status: 'Upcoming',
    spotsFilled: 5,
    createdAt: '2026-06-27T12:00:00.000Z',
  },
  {
    _id: 'act-4',
    title: 'Youth Soccer Coaching Clinic',
    description: 'Assist youth coaches in teaching basic soccer drills and promoting physical wellness.',
    category: 'Recreation',
    location: 'Oakridge Sports Field',
    date: '2026-07-05',
    startTime: '09:00 AM',
    endTime: '12:00 PM',
    maxVolunteers: 8,
    status: 'Active',
    spotsFilled: 6,
    createdAt: '2026-06-27T13:00:00.000Z',
  },
  {
    _id: 'act-5',
    title: 'Community Library Book Audit',
    description: "Organize the local children's section and tag books with category labels.",
    category: 'Education',
    location: 'Public Library Annex',
    date: '2026-06-25',
    startTime: '01:00 PM',
    endTime: '04:00 PM',
    maxVolunteers: 6,
    status: 'Completed',
    spotsFilled: 6,
    createdAt: '2026-06-24T09:00:00.000Z',
  },
];

const isSanityConfigured = () => {
  return (
    process.env.NEXT_PUBLIC_SANITY_PROJECT_ID &&
    process.env.NEXT_PUBLIC_SANITY_PROJECT_ID !== "mock-project-id"
  );
};

export async function getActivitiesAction(): Promise<ActivityData[]> {
  if (!isSanityConfigured()) {
    console.warn("Sanity Project ID not configured. Falling back to local mock activities.");
    return mockActivities;
  }

  try {
    const query = `*[_type == "activity"] | order(date asc)`;
    const activities = await sanityClient.fetch<ActivityData[]>(query);
    // Enrich with mock filled slots for visual consistency
    return activities.map((act, index) => ({
      ...act,
      spotsFilled: act.spotsFilled ?? Math.min(act.maxVolunteers, Math.floor((index + 2) * 3.5)),
    }));
  } catch (error) {
    console.error("Failed to fetch activities from Sanity CMS:", error);
    return mockActivities;
  }
}

export async function createActivityAction(data: ActivityData): Promise<ActivityData> {
  const newDoc = {
    _type: "activity",
    title: data.title,
    description: data.description || "",
    date: data.date,
    startTime: data.startTime,
    endTime: data.endTime,
    location: data.location,
    maxVolunteers: Number(data.maxVolunteers),
    category: data.category,
    status: data.status,
    createdAt: new Date().toISOString(),
  };

  if (!isSanityConfigured()) {
    console.warn("Sanity not configured. Saving activity to local mock data.");
    const mockDoc: ActivityData = {
      ...newDoc,
      _id: `act-${Date.now()}`,
      spotsFilled: 0,
    };
    mockActivities = [...mockActivities, mockDoc];
    revalidatePath("/activities");
    revalidatePath("/");
    return mockDoc;
  }

  try {
    const response = await sanityWriteClient.create(newDoc);
    revalidatePath("/activities");
    revalidatePath("/");
    return response as unknown as ActivityData;
  } catch (error) {
    console.error("Failed to create activity in Sanity CMS:", error);
    throw new Error("Sanity write failed. Please check credentials.");
  }
}

export async function updateActivityAction(id: string, data: ActivityData): Promise<ActivityData> {
  const updateData = {
    title: data.title,
    description: data.description || "",
    date: data.date,
    startTime: data.startTime,
    endTime: data.endTime,
    location: data.location,
    maxVolunteers: Number(data.maxVolunteers),
    category: data.category,
    status: data.status,
  };

  if (!isSanityConfigured() || id.startsWith("act-")) {
    console.warn("Updating local mock activity.");
    mockActivities = mockActivities.map((act) =>
      act._id === id ? { ...act, ...updateData } : act
    );
    revalidatePath("/activities");
    revalidatePath("/");
    return mockActivities.find((act) => act._id === id) as ActivityData;
  }

  try {
    const response = await sanityWriteClient
      .patch(id)
      .set(updateData)
      .commit();
    revalidatePath("/activities");
    revalidatePath("/");
    return response as unknown as ActivityData;
  } catch (error) {
    console.error("Failed to update activity in Sanity CMS:", error);
    throw new Error("Sanity update failed.");
  }
}

export async function deleteActivityAction(id: string): Promise<boolean> {
  if (!isSanityConfigured() || id.startsWith("act-")) {
    console.warn("Deleting local mock activity.");
    mockActivities = mockActivities.filter((act) => act._id !== id);
    revalidatePath("/activities");
    revalidatePath("/");
    return true;
  }

  try {
    await sanityWriteClient.delete(id);
    revalidatePath("/activities");
    revalidatePath("/");
    return true;
  } catch (error) {
    console.error("Failed to delete activity from Sanity CMS:", error);
    throw new Error("Sanity delete failed.");
  }
}
