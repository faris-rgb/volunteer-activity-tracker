import React from "react";
import AttendanceClient from "./AttendanceClient";
import { getVolunteersAction } from "@/app/actions/volunteers";
import { getActivitiesAction } from "@/app/actions/activities";
import { getAttendanceRecordsAction } from "@/app/actions/attendance";

export const revalidate = 0; // Fresh updates on demand

export default async function AttendancePage() {
  const [volunteers, activities, initialRecords] = await Promise.all([
    getVolunteersAction(),
    getActivitiesAction(),
    getAttendanceRecordsAction()
  ]);

  return (
    <AttendanceClient 
      volunteers={volunteers} 
      activities={activities} 
      initialRecords={initialRecords} 
    />
  );
}
