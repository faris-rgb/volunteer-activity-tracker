// src/lib/sanityActions.ts

import { sanityClient, sanityWriteClient } from "./sanity";
import type { Volunteer, Activity, Attendance } from "../types";

/** Volunteer CRUD */
export async function getVolunteers({ search = "", sort = "firstName", active }: { search?: string; sort?: string; active?: boolean } = {}): Promise<Volunteer[]> {
  const filters: string[] = [];
  if (search) {
    filters.push(`(firstName match "${search}*" || lastName match "${search}*" || email match "${search}*")`);
  }
  if (active !== undefined) {
    filters.push(`active == ${active}`);
  }
  const where = filters.length ? ` && ${filters.join(" && ")}` : "";
  const query = `*[_type == "volunteer"${where}] | order(${sort} asc)`;
  return sanityClient.fetch(query);
}

export async function createVolunteer(data: Omit<Volunteer, "_id" | "_type" | "createdAt">): Promise<Volunteer> {
  const doc = {
    _type: "volunteer",
    ...data,
  } as any;
  const result = await sanityWriteClient.create(doc) as Volunteer;
  return result;
}

export async function updateVolunteer(id: string, data: Partial<Omit<Volunteer, "_id" | "_type" | "createdAt">>): Promise<Volunteer> {
  const result = await sanityWriteClient.patch(id).set(data).commit() as Volunteer;
  return result;
}

export async function deleteVolunteer(id: string): Promise<void> {
  await sanityWriteClient.delete(id);
}

/** Activity CRUD */
export async function getActivities({ search = "", sort = "date", status }: { search?: string; sort?: string; status?: string } = {}): Promise<Activity[]> {
  const filters: string[] = [];
  if (search) {
    filters.push(`title match "${search}*"`);
  }
  if (status) {
    filters.push(`status == "${status}"`);
  }
  const where = filters.length ? ` && ${filters.join(" && ")}` : "";
  const query = `*[_type == "activity"${where}] | order(${sort} asc)`;
  return sanityClient.fetch(query);
}

export async function createActivity(data: Omit<Activity, "_id" | "_type" | "createdAt">): Promise<Activity> {
  const doc = {
    _type: "activity",
    ...data,
  } as any;
  const result = await sanityWriteClient.create(doc) as Activity;
  return result;
}

export async function updateActivity(id: string, data: Partial<Omit<Activity, "_id" | "_type" | "createdAt">>): Promise<Activity> {
  const result = await sanityWriteClient.patch(id).set(data).commit() as Activity;
  return result;
}

export async function deleteActivity(id: string): Promise<void> {
  await sanityWriteClient.delete(id);
}

/** Attendance CRUD */
export async function getAttendance({ activityId, search = "", sort = "createdAt" }: { activityId?: string; search?: string; sort?: string } = {}): Promise<Attendance[]> {
  const filters: string[] = [];
  if (activityId) {
    filters.push(`activity._ref == "${activityId}"`);
  }
  if (search) {
    filters.push(`volunteer->firstName match "${search}*" || volunteer->lastName match "${search}*"`);
  }
  const where = filters.length ? ` && ${filters.join(" && ")}` : "";
  const query = `*[_type == "attendance"${where}] | order(${sort} desc)`;
  return sanityClient.fetch(query);
}

export async function createAttendance(data: Omit<Attendance, "_id" | "_type" | "createdAt">): Promise<Attendance> {
  const doc = {
    _type: "attendance",
    ...data,
  } as any;
  const result = await sanityWriteClient.create(doc) as Attendance;
  return result;
}

export async function updateAttendance(id: string, data: Partial<Omit<Attendance, "_id" | "_type" | "createdAt">>): Promise<Attendance> {
  const result = await sanityWriteClient.patch(id).set(data).commit() as Attendance;
  return result;
}

export async function deleteAttendance(id: string): Promise<void> {
  await sanityWriteClient.delete(id);
}

/** Dashboard aggregates */
export async function getDashboardStats() {
  const [volCount, actCount, attCount, upcoming] = await Promise.all([
    sanityClient.fetch(`count(*[_type == "volunteer"])`),
    sanityClient.fetch(`count(*[_type == "activity"])`),
    sanityClient.fetch(`count(*[_type == "attendance"])`),
    sanityClient.fetch(`*[_type == "activity" && status == "Upcoming"] | order(date asc)[0]`),
  ]);
  const attendanceRate = attCount > 0 ? (attCount / volCount) * 100 : 0;
  return { volCount, actCount, attCount, attendanceRate: Math.round(attendanceRate), upcoming };
}
