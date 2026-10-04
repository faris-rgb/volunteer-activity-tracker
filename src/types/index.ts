// src/types/index.ts

export type { AppUserData as AppUser } from "@/lib/appUsers";

export interface Volunteer {
  _id: string;
  _type: 'volunteer';
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
  createdAt: string;
}

export interface Activity {
  _id: string;
  _type: 'activity';
  title: string;
  description?: string;
  date: string; // ISO date string
  startTime: string; // ISO time
  endTime: string; // ISO time
  location?: string;
  maximumVolunteers?: number;
  category?: string;
  status: 'Upcoming' | 'Active' | 'Completed';
  createdAt: string;
}

export interface Attendance {
  _id: string;
  _type: 'attendance';
  volunteer: { _ref: string; _type: 'reference' };
  activity: { _ref: string; _type: 'reference' };
  status: 'Present' | 'Absent' | 'Late';
  checkInTime?: string;
  notes?: string;
  recordedBy?: string;
  createdAt: string;
}
