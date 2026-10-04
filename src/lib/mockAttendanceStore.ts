import "server-only";
import type { AttendanceRecord } from "@/app/actions/attendance";

// In-memory attendance used only when no Sanity project is configured. Deliberately NOT a
// "use server" module: these helpers have no auth checks and must never be callable from the browser.
const mockAttendance: AttendanceRecord[] = [];

export function listMockAttendance(activityId?: string): AttendanceRecord[] {
  return activityId ? mockAttendance.filter((record) => record.activityId === activityId) : [...mockAttendance];
}

export function findMockAttendance(activityId: string, volunteerId: string): AttendanceRecord | undefined {
  return mockAttendance.find((record) => record.activityId === activityId && record.volunteerId === volunteerId);
}

export function upsertMockAttendance(record: AttendanceRecord): void {
  const index = mockAttendance.findIndex(
    (item) => item.activityId === record.activityId && item.volunteerId === record.volunteerId
  );
  if (index >= 0) {
    mockAttendance[index] = record;
  } else {
    mockAttendance.push(record);
  }
}

/** Removes every record for the given volunteer and/or activity and returns how many were removed. */
export function removeMockAttendance(match: { volunteerId?: string; activityId?: string }): number {
  if (!match.volunteerId && !match.activityId) {
    return 0;
  }
  let removed = 0;
  for (let index = mockAttendance.length - 1; index >= 0; index -= 1) {
    const record = mockAttendance[index];
    if (
      (!match.volunteerId || record.volunteerId === match.volunteerId) &&
      (!match.activityId || record.activityId === match.activityId)
    ) {
      mockAttendance.splice(index, 1);
      removed += 1;
    }
  }
  return removed;
}
