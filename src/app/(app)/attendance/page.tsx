import { Suspense } from "react";
import { unstable_rethrow } from "next/navigation";
import AttendanceClient, { type AttendanceActivity, type AttendanceVolunteer } from "./AttendanceClient";
import { getVolunteersAction, type VolunteerData } from "@/app/actions/volunteers";
import { getActivitiesResultAction } from "@/app/actions/activities";
import { getAttendanceRecordsAction, type AttendanceRecord } from "@/app/actions/attendance";
import { requireRouteAccess } from "@/lib/auth";
import { MANAGER_ROLES } from "@/lib/roles";

function pickInitialActivityId(activities: AttendanceActivity[], requested: string | undefined): string {
  if (requested && activities.some((activity) => activity._id === requested)) {
    return requested;
  }
  const byDate = [...activities].sort((a, b) => a.date.localeCompare(b.date));
  const preferred =
    byDate.find((activity) => activity.status === "Active") ??
    byDate.find((activity) => activity.status === "Upcoming") ??
    byDate[byDate.length - 1];
  return preferred?._id ?? "";
}

async function loadOrNull<T>(load: () => Promise<T>, label: string): Promise<T | null> {
  try {
    return await load();
  } catch (error) {
    unstable_rethrow(error);
    console.error(`Attendance page: failed to load ${label}:`, error);
    return null;
  }
}

function joinLabels(labels: string[]): string {
  return labels.length > 1 ? `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}` : labels[0];
}

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await requireRouteAccess("/attendance");
  const canManage = MANAGER_ROLES.includes(user.role);

  const [params, volunteerDocs, activityResult, recordDocs] = await Promise.all([
    searchParams,
    loadOrNull<VolunteerData[]>(getVolunteersAction, "volunteers"),
    getActivitiesResultAction(),
    loadOrNull<AttendanceRecord[]>(() => getAttendanceRecordsAction(), "attendance records"),
  ]);

  if (!activityResult.ok || !volunteerDocs || !recordDocs) {
    const failed = [
      ...(activityResult.ok ? [] : ["activities"]),
      ...(volunteerDocs ? [] : ["volunteers"]),
      ...(recordDocs ? [] : ["attendance records"]),
    ];
    return (
      <Suspense>
        <AttendanceClient
          volunteers={[]}
          activities={[]}
          initialRecords={[]}
          initialActivityId=""
          canManage={canManage}
          loadError={`Could not load ${joinLabels(failed)}. Check your connection and try again.`}
        />
      </Suspense>
    );
  }

  const volunteers: AttendanceVolunteer[] = volunteerDocs.map((volunteer) => ({
    _id: volunteer._id,
    firstName: volunteer.firstName,
    lastName: volunteer.lastName,
    email: canManage ? volunteer.email : undefined,
    country: volunteer.country,
    skills: volunteer.skills,
    active: volunteer.active !== false,
  }));

  const activities: AttendanceActivity[] = activityResult.data
    .filter((activity): activity is typeof activity & { _id: string } => Boolean(activity._id))
    .map((activity) => ({
      _id: activity._id,
      title: activity.title,
      date: activity.date,
      startTime: activity.startTime,
      endTime: activity.endTime,
      location: activity.location,
      status: activity.status,
      maxVolunteers: activity.maxVolunteers,
    }));

  const records: AttendanceRecord[] = recordDocs.map((record) => ({
    _id: record._id,
    volunteerId: record.volunteerId,
    activityId: record.activityId,
    status: record.status,
    checkInTime: record.checkInTime,
    notes: canManage ? record.notes : undefined,
    recordedBy: canManage ? record.recordedBy : undefined,
    createdAt: record.createdAt,
  }));

  const requested = typeof params.activity === "string" ? params.activity : undefined;

  return (
    <Suspense>
      <AttendanceClient
        volunteers={volunteers}
        activities={activities}
        initialRecords={records}
        initialActivityId={pickInitialActivityId(activities, requested)}
        canManage={canManage}
      />
    </Suspense>
  );
}
