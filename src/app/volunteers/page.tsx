import React from "react";
import VolunteersClient from "./VolunteersClient";
import { getVolunteersAction } from "@/app/actions/volunteers";

export const revalidate = 0; // Disable server caching for this page to ensure fresh queries

export default async function VolunteersPage() {
  const initialVolunteers = await getVolunteersAction();

  return <VolunteersClient initialVolunteers={initialVolunteers} />;
}
