"use server";

import { revalidatePath } from "next/cache";
import { sanityClient, sanityWriteClient } from "@/lib/sanity";

export interface AttendanceRecord {
  _id?: string;
  volunteerId: string;
  activityId: string;
  status: "Present" | "Absent" | "Late";
  checkInTime?: string;
  notes?: string;
  recordedBy?: string;
  createdAt?: string;
  
  // Dereferenced fields for frontend
  volunteer?: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    country?: string;
    skills?: string[];
  };
  activity?: {
    _id: string;
    title: string;
    date: string;
  };
}

// In-memory mock database for fallback
const mockAttendance: AttendanceRecord[] = [
  {
    _id: "att-1",
    volunteerId: "mock-1", // Sarah Jenkins
    activityId: "act-1",   // Community Food Drive
    status: "Present",
    checkInTime: "08:52 AM",
    recordedBy: "John Doe",
    createdAt: "2026-06-28T08:52:00.000Z",
    volunteer: {
      _id: "mock-1",
      firstName: "Sarah",
      lastName: "Jenkins",
      email: "sarah.j@example.com",
      country: "United States",
      skills: ["Event Planning", "Teaching"],
    },
    activity: {
      _id: "act-1",
      title: "Community Food Drive",
      date: "2026-06-28",
    }
  },
  {
    _id: "att-2",
    volunteerId: "mock-2", // David Chen
    activityId: "act-1",   // Community Food Drive
    status: "Present",
    checkInTime: "08:55 AM",
    recordedBy: "John Doe",
    createdAt: "2026-06-28T08:55:00.000Z",
    volunteer: {
      _id: "mock-2",
      firstName: "David",
      lastName: "Chen",
      email: "d.chen@example.com",
      country: "Canada",
      skills: ["First Aid", "Driving"],
    },
    activity: {
      _id: "act-1",
      title: "Community Food Drive",
      date: "2026-06-28",
    }
  },
  {
    _id: "att-3",
    volunteerId: "mock-3", // Elena Rostova
    activityId: "act-1",   // Community Food Drive
    status: "Late",
    checkInTime: "09:12 AM",
    recordedBy: "John Doe",
    createdAt: "2026-06-28T09:12:00.000Z",
    volunteer: {
      _id: "mock-3",
      firstName: "Elena",
      lastName: "Rostova",
      email: "elena.r@example.com",
      country: "United Kingdom",
      skills: ["Social Media", "Art"],
    },
    activity: {
      _id: "act-1",
      title: "Community Food Drive",
      date: "2026-06-28",
    }
  },
  {
    _id: "att-4",
    volunteerId: "mock-4", // Marcus Aurelius
    activityId: "act-1",   // Community Food Drive
    status: "Absent",
    checkInTime: "",
    recordedBy: "John Doe",
    createdAt: "2026-06-28T09:00:00.000Z",
    volunteer: {
      _id: "mock-4",
      firstName: "Marcus",
      lastName: "Aurelius",
      email: "marcus.a@example.com",
      country: "Italy",
      skills: ["Philosophy", "Leadership", "Public Speaking"],
    },
    activity: {
      _id: "act-1",
      title: "Community Food Drive",
      date: "2026-06-28",
    }
  }
];

const isSanityConfigured = () => {
  return (
    process.env.NEXT_PUBLIC_SANITY_PROJECT_ID &&
    process.env.NEXT_PUBLIC_SANITY_PROJECT_ID !== "mock-project-id"
  );
};

export async function getAttendanceRecordsAction(activityId?: string): Promise<AttendanceRecord[]> {
  if (!isSanityConfigured()) {
    console.warn("Sanity not configured. Returning fallback attendance records.");
    if (activityId) {
      return mockAttendance.filter((att) => att.activityId === activityId);
    }
    return mockAttendance;
  }

  try {
    const query = activityId 
      ? `*[_type == "attendance" && activity._ref == $activityId]{
          _id,
          "volunteerId": volunteer._ref,
          "activityId": activity._ref,
          status,
          checkInTime,
          notes,
          recordedBy,
          createdAt,
          volunteer->{_id, firstName, lastName, email, country, skills},
          activity->{_id, title, date}
        }`
      : `*[_type == "attendance"]{
          _id,
          "volunteerId": volunteer._ref,
          "activityId": activity._ref,
          status,
          checkInTime,
          notes,
          recordedBy,
          createdAt,
          volunteer->{_id, firstName, lastName, email, country, skills},
          activity->{_id, title, date}
        }`;

    const params = activityId ? { activityId } : {};
    const records = await sanityClient.fetch<AttendanceRecord[]>(query, params);
    return records;
  } catch (error) {
    console.error("Failed to fetch attendance logs from Sanity:", error);
    return mockAttendance;
  }
}

export async function recordAttendanceAction(data: AttendanceRecord): Promise<AttendanceRecord> {
  const checkInTimeStr = data.status === "Present" || data.status === "Late" 
    ? new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) 
    : "";

  const sanityDoc = {
    _type: "attendance",
    volunteer: { _type: "reference", _ref: data.volunteerId },
    activity: { _type: "reference", _ref: data.activityId },
    status: data.status,
    checkInTime: checkInTimeStr,
    notes: data.notes || "",
    recordedBy: data.recordedBy || "Administrator",
    createdAt: new Date().toISOString(),
  };

  if (!isSanityConfigured() || data.volunteerId.startsWith("mock-") || data.activityId.startsWith("act-")) {
    console.warn("Saving to mock attendance database.");
    
    // Uniqueness validation check: check if it already exists
    const existingIndex = mockAttendance.findIndex(
      (att) => att.volunteerId === data.volunteerId && att.activityId === data.activityId
    );

    const mockRecord: AttendanceRecord = {
      _id: existingIndex >= 0 ? mockAttendance[existingIndex]._id : `att-${Date.now()}`,
      volunteerId: data.volunteerId,
      activityId: data.activityId,
      status: data.status,
      checkInTime: checkInTimeStr,
      notes: data.notes || "",
      recordedBy: data.recordedBy || "Administrator",
      createdAt: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      mockAttendance[existingIndex] = {
        ...mockAttendance[existingIndex],
        ...mockRecord
      };
    } else {
      mockAttendance.push(mockRecord);
    }

    revalidatePath("/attendance");
    revalidatePath("/");
    return mockRecord;
  }

  try {
    // Uniqueness query validation
    const query = `*[_type == "attendance" && volunteer._ref == $volId && activity._ref == $actId][0]._id`;
    const params = { volId: data.volunteerId, actId: data.activityId };
    const existingId = await sanityClient.fetch<string | null>(query, params);

    let result;
    if (existingId) {
      // Update existing record
      result = await sanityWriteClient
        .patch(existingId)
        .set({
          status: data.status,
          checkInTime: checkInTimeStr,
          notes: data.notes || "",
          recordedBy: data.recordedBy || "Administrator",
        })
        .commit();
    } else {
      // Create new record
      result = await sanityWriteClient.create(sanityDoc);
    }

    revalidatePath("/attendance");
    revalidatePath("/");
    return result as unknown as AttendanceRecord;
  } catch (error) {
    console.error("Failed to save attendance in Sanity:", error);
    throw new Error("Sanity write failed.");
  }
}

export async function bulkRecordAttendanceAction(
  activityId: string, 
  volunteerIds: string[], 
  status: "Present" | "Absent" | "Late"
): Promise<boolean> {
  const checkInTimeStr = status === "Present" || status === "Late" 
    ? new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) 
    : "";

  if (!isSanityConfigured() || activityId.startsWith("act-")) {
    console.warn("Bulk recording to mock database.");
    volunteerIds.forEach((volId) => {
      const existingIndex = mockAttendance.findIndex(
        (att) => att.volunteerId === volId && att.activityId === activityId
      );

      const mockRecord: AttendanceRecord = {
        _id: existingIndex >= 0 ? mockAttendance[existingIndex]._id : `att-${Date.now()}-${volId}`,
        volunteerId: volId,
        activityId,
        status,
        checkInTime: checkInTimeStr,
        recordedBy: "Administrator",
        createdAt: new Date().toISOString(),
      };

      if (existingIndex >= 0) {
        mockAttendance[existingIndex] = {
          ...mockAttendance[existingIndex],
          ...mockRecord
        };
      } else {
        mockAttendance.push(mockRecord);
      }
    });

    revalidatePath("/attendance");
    revalidatePath("/");
    return true;
  }

  try {
    // Process serial or parallel checks
    const promises = volunteerIds.map(async (volId) => {
      const query = `*[_type == "attendance" && volunteer._ref == $volId && activity._ref == $actId][0]._id`;
      const params = { volId, actId: activityId };
      const existingId = await sanityClient.fetch<string | null>(query, params);

      if (existingId) {
        await sanityWriteClient
          .patch(existingId)
          .set({ status, checkInTime: checkInTimeStr, recordedBy: "Administrator" })
          .commit();
      } else {
        await sanityWriteClient.create({
          _type: "attendance",
          volunteer: { _type: "reference", _ref: volId },
          activity: { _type: "reference", _ref: activityId },
          status,
          checkInTime: checkInTimeStr,
          recordedBy: "Administrator",
          createdAt: new Date().toISOString(),
        });
      }
    });

    await Promise.all(promises);
    revalidatePath("/attendance");
    revalidatePath("/");
    return true;
  } catch (error) {
    console.error("Bulk attendance write failed in Sanity:", error);
    throw new Error("Bulk write failed.");
  }
}
