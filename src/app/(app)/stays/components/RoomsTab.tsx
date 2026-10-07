"use client";

import { BedDouble, CalendarDays, MapPin, Plus, SquarePen, Trash, TriangleAlert } from "lucide-react";
import type { Room, Stay } from "@/lib/domain";
import type { Lookups } from "./ArrivalsTab";
import { dayLabel, occupiesOn, roomOccupantsOn, shortDate, volunteerName } from "./stayUtils";
import { ICON_BUTTON, PRIMARY_BUTTON } from "./ui";

export default function RoomsTab({
  rooms,
  stays,
  lookups,
  date,
  today,
  onDateChange,
  onCreate,
  onEdit,
  onDelete,
  onEditStay,
}: {
  rooms: Room[];
  stays: Stay[];
  lookups: Lookups;
  date: string;
  today: string;
  onDateChange: (date: string) => void;
  onCreate: () => void;
  onEdit: (room: Room) => void;
  onDelete: (room: Room) => void;
  onEditStay: (stay: Stay) => void;
}) {
  const totalBeds = rooms.reduce((sum, room) => sum + room.beds, 0);
  const roomIds = new Set(rooms.map((room) => room._id));
  const housed = stays.filter((stay) => stay.roomId && roomIds.has(stay.roomId) && occupiesOn(stay, date)).length;
  const withoutRoom = stays.filter(
    (stay) => (!stay.roomId || !roomIds.has(stay.roomId)) && occupiesOn(stay, date)
  );
  const overCapacity = rooms.filter((room) => roomOccupantsOn(room._id, stays, date).length > room.beds);

  if (rooms.length === 0) {
    return (
      <div className="bg-slate-950/40 border border-slate-900 rounded-2xl px-6 py-16 text-center">
        <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mx-auto">
          <BedDouble className="h-7 w-7" />
        </div>
        <h2 className="mt-5 text-lg font-bold text-white">No rooms yet</h2>
        <p className="mt-2 text-sm text-slate-400 max-w-md mx-auto">
          Add the rooms of your volunteer house in Martil or Tetouan with their number of beds. You can then assign
          volunteers to a room for the nights of their stay and see free beds at a glance.
        </p>
        <button type="button" onClick={onCreate} className={`mt-6 ${PRIMARY_BUTTON}`}>
          <Plus className="h-4 w-4" />
          Add your first room
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="bg-slate-950/40 border border-slate-900 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="rooms-date" className="flex items-center gap-2 text-sm text-slate-300 font-semibold">
            <CalendarDays className="h-4 w-4 text-emerald-400" />
            Occupancy on
          </label>
          <input
            id="rooms-date"
            type="date"
            value={date}
            onChange={(event) => onDateChange(event.target.value || today)}
            className="bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
          />
          {date !== today && (
            <button type="button" onClick={() => onDateChange(today)} className="text-xs text-emerald-400 hover:text-emerald-300 px-2 py-1">
              Today
            </button>
          )}
        </div>
        <p className="text-sm text-slate-400">
          <span className="text-white font-bold">{housed}</span> of <span className="text-white font-bold">{totalBeds}</span> beds
          taken on {dayLabel(date)}
        </p>
      </div>

      {overCapacity.length > 0 && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          <TriangleAlert className="h-4 w-4 mt-0.5 shrink-0" />
          {overCapacity.map((room) => room.name).join(", ")} {overCapacity.length === 1 ? "is" : "are"} over capacity on{" "}
          {dayLabel(date)}. Move a volunteer to another room or add beds.
        </div>
      )}

      <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {rooms.map((room) => {
          const occupants = roomOccupantsOn(room._id, stays, date);
          const used = occupants.length;
          const over = used > room.beds;
          const percent = Math.min(100, Math.round((used / room.beds) * 100));
          const assignedTotal = stays.filter((stay) => stay.roomId === room._id).length;
          return (
            <li
              key={room._id}
              className={`bg-slate-950/40 border rounded-2xl p-4 space-y-3 ${over ? "border-rose-500/40" : "border-slate-900"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-bold text-white truncate">{room.name}</h3>
                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                    {room.location && (
                      <>
                        <MapPin className="h-3 w-3" />
                        {room.location} ·{" "}
                      </>
                    )}
                    {room.beds} bed{room.beds === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button type="button" onClick={() => onEdit(room)} className={ICON_BUTTON} title="Edit room" aria-label={`Edit ${room.name}`}>
                    <SquarePen className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(room)}
                    className={`${ICON_BUTTON} hover:text-rose-400`}
                    title={assignedTotal > 0 ? "Rooms with assigned stays can't be deleted" : "Delete room"}
                    aria-label={`Delete ${room.name}`}
                  >
                    <Trash className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className={over ? "text-rose-300 font-semibold" : used === room.beds ? "text-amber-300 font-semibold" : "text-slate-400"}>
                    {used}/{room.beds} beds taken
                  </span>
                  <span className="text-slate-500">
                    {over ? `${used - room.beds} over capacity` : `${room.beds - used} free`}
                  </span>
                </div>
                <div
                  className="h-2 rounded-full bg-slate-800 overflow-hidden"
                  role="progressbar"
                  aria-valuenow={used}
                  aria-valuemin={0}
                  aria-valuemax={room.beds}
                  aria-label={`${room.name} occupancy`}
                >
                  <div
                    className={`h-full rounded-full ${over ? "bg-rose-500" : used === room.beds ? "bg-amber-400" : "bg-emerald-500"}`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>

              {occupants.length === 0 ? (
                <p className="text-xs text-slate-500">Empty on this date.</p>
              ) : (
                <ul className="space-y-1.5">
                  {occupants.map((stay) => (
                    <li key={stay._id}>
                      <button
                        type="button"
                        onClick={() => onEditStay(stay)}
                        className="w-full flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-slate-900 transition-colors"
                      >
                        <span className="text-slate-200 font-semibold truncate">
                          {volunteerName(lookups.volunteers.get(stay.volunteerId))}
                        </span>
                        <span className="text-slate-500 whitespace-nowrap">
                          {shortDate(stay.arrivalDate)} → {shortDate(stay.departureDate)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {room.notes && <p className="text-xs text-slate-500 border-t border-slate-900 pt-2">{room.notes}</p>}
            </li>
          );
        })}
      </ul>

      {withoutRoom.length > 0 && (
        <section className="bg-slate-950/40 border border-amber-500/20 rounded-2xl p-4 space-y-2" aria-label="Volunteers without a room">
          <h3 className="flex items-center gap-2 text-sm font-bold text-amber-200">
            <TriangleAlert className="h-4 w-4" />
            {withoutRoom.length} volunteer{withoutRoom.length === 1 ? "" : "s"} without a room on {dayLabel(date)}
          </h3>
          <ul className="flex flex-wrap gap-2">
            {withoutRoom.map((stay) => (
              <li key={stay._id}>
                <button type="button" onClick={() => onEditStay(stay)} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors">
                  {volunteerName(lookups.volunteers.get(stay.volunteerId))}
                  <span className="text-slate-500 font-normal">assign room</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
