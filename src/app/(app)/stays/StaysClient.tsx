"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BedDouble, List, Plane, PlaneLanding, Plus, RefreshCw, TriangleAlert } from "lucide-react";
import type { PickupStatus, Room, Stay } from "@/lib/domain";
import { deleteStayAction, updateStayPickupAction } from "@/app/actions/stays";
import { deleteRoomAction } from "@/app/actions/rooms";
import ArrivalsTab, { type Lookups } from "./components/ArrivalsTab";
import StaysTable, { type StayFilters } from "./components/StaysTable";
import RoomsTab from "./components/RoomsTab";
import StayModal from "./components/StayModal";
import RoomModal from "./components/RoomModal";
import ConfirmDialog from "./components/ConfirmDialog";
import {
  PICKUP_STATUS_LABELS,
  addDays,
  documentsCompleteness,
  isInCountry,
  plural,
  visaCounter,
  volunteerName,
  type StayProjectOption,
  type StayVolunteerOption,
} from "./components/stayUtils";
import { PRIMARY_BUTTON, SECONDARY_BUTTON, Toast, callAction, useTodayKey, type Notice } from "./components/ui";

export type StaysTab = "arrivals" | "all" | "rooms";

interface StaysClientProps {
  initialStays: Stay[];
  initialRooms: Room[];
  volunteers: StayVolunteerOption[];
  projects: StayProjectOption[];
  loadErrors: string[];
  serverToday: string;
  initialTab: StaysTab;
  initialProject: string;
  pickupTemplate: string;
  organizationName: string;
  locations: string[];
}

const TABS: { id: StaysTab; label: string; icon: typeof Plane }[] = [
  { id: "arrivals", label: "Arrivals", icon: PlaneLanding },
  { id: "all", label: "All stays", icon: List },
  { id: "rooms", label: "Rooms", icon: BedDouble },
];

type StayModalState = { stayId: string | null; defaults: { volunteerId?: string; projectId?: string } };

export default function StaysClient({
  initialStays,
  initialRooms,
  volunteers,
  projects,
  loadErrors,
  serverToday,
  initialTab,
  initialProject,
  pickupTemplate,
  organizationName,
  locations,
}: StaysClientProps) {
  const router = useRouter();
  const today = useTodayKey(serverToday);

  const [stays, setStays] = useState<Stay[]>(initialStays);
  const [syncedStays, setSyncedStays] = useState(initialStays);
  if (initialStays !== syncedStays) {
    setSyncedStays(initialStays);
    setStays(initialStays);
  }
  const [rooms, setRooms] = useState<Room[]>(initialRooms);
  const [syncedRooms, setSyncedRooms] = useState(initialRooms);
  if (initialRooms !== syncedRooms) {
    setSyncedRooms(initialRooms);
    setRooms(initialRooms);
  }

  const [tab, setTab] = useState<StaysTab>(initialTab);
  const [filters, setFilters] = useState<StayFilters>({
    search: "",
    project: initialProject,
    status: "all",
    sort: "arrival-desc",
  });
  const [roomsDate, setRoomsDate] = useState<string | null>(null);

  const [stayModal, setStayModal] = useState<StayModalState | null>(null);
  const [roomModal, setRoomModal] = useState<{ room: Room | null } | null>(null);

  const [deleteStayId, setDeleteStayId] = useState<string | null>(null);
  const [deleteRoomId, setDeleteRoomId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [pickupBusy, setPickupBusy] = useState<{ stayId: string; status: PickupStatus } | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const dismissNotice = useCallback(() => setNotice(null), []);
  const [isRefreshing, startRefresh] = useTransition();

  // Keep ?tab= and ?project= in the address bar so the view can be shared or reloaded.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (tab === "arrivals") params.delete("tab");
    else params.set("tab", tab);
    if (filters.project === "all") params.delete("project");
    else params.set("project", filters.project);
    const query = params.toString();
    const next = `${window.location.pathname}${query ? `?${query}` : ""}`;
    if (next !== `${window.location.pathname}${window.location.search}`) {
      window.history.replaceState(null, "", next);
    }
  }, [tab, filters.project]);

  const lookups: Lookups = useMemo(
    () => ({
      volunteers: new Map(volunteers.map((item) => [item._id, item])),
      projects: new Map(projects.map((item) => [item._id, item])),
      rooms: new Map(rooms.map((item) => [item._id, item])),
    }),
    [volunteers, projects, rooms]
  );

  const stats = useMemo(() => {
    const live = stays.filter((stay) => stay.status !== "cancelled" && stay.status !== "completed");
    const horizon = addDays(today, 14);
    const soon = addDays(today, 30);
    const inCountry = live.filter((stay) => isInCountry(stay, today));
    return {
      arrivingToday: live.filter((stay) => stay.arrivalDate === today).length,
      nextTwoWeeks: live.filter((stay) => stay.arrivalDate && stay.arrivalDate > today && stay.arrivalDate <= horizon).length,
      inCountry: inCountry.length,
      visaAlerts: inCountry.filter((stay) => {
        const counter = visaCounter(stay, lookups.volunteers.get(stay.volunteerId), today);
        return counter !== null && counter.level !== "ok";
      }).length,
      missingDocs: live.filter(
        (stay) =>
          (isInCountry(stay, today) || (!!stay.arrivalDate && stay.arrivalDate > today && stay.arrivalDate <= soon)) &&
          documentsCompleteness(stay.documents) < 100
      ).length,
    };
  }, [stays, today, lookups]);

  const upsertStay = useCallback((stay: Stay) => {
    setStays((prev) => (prev.some((item) => item._id === stay._id) ? prev.map((item) => (item._id === stay._id ? stay : item)) : [...prev, stay]));
  }, []);

  const openCreateStay = (defaults: StayModalState["defaults"] = {}) => {
    const projectId = defaults.projectId ?? (filters.project !== "all" && filters.project !== "none" ? filters.project : undefined);
    setStayModal({ stayId: null, defaults: { ...defaults, projectId } });
  };
  const openEditStay = (stay: Stay) => setStayModal({ stayId: stay._id, defaults: {} });
  const closeStayModal = useCallback(() => setStayModal(null), []);
  const closeRoomModal = useCallback(() => setRoomModal(null), []);

  const editingStay = stayModal?.stayId ? stays.find((stay) => stay._id === stayModal.stayId) ?? null : null;

  const handleStaySaved = (stay: Stay, created: boolean) => {
    upsertStay(stay);
    setStayModal(null);
    const name = volunteerName(lookups.volunteers.get(stay.volunteerId));
    setNotice({ type: "success", message: created ? `Stay added for ${name}.` : `Saved the stay of ${name}.` });
  };

  const handlePickup = async (stay: Stay, status: PickupStatus) => {
    if (pickupBusy) return;
    setPickupBusy({ stayId: stay._id, status });
    const result = await callAction(() => updateStayPickupAction(stay._id, status));
    setPickupBusy(null);
    if (!result.ok) {
      setNotice({ type: "error", message: result.error });
      return;
    }
    upsertStay(result.data);
    const name = volunteerName(lookups.volunteers.get(stay.volunteerId));
    const arrived = result.data.status === "arrived" && stay.status !== "arrived";
    setNotice({
      type: "success",
      message: `${name}: pickup ${PICKUP_STATUS_LABELS[status].toLowerCase()}${arrived ? " — stay marked as arrived" : ""}.`,
    });
  };

  const stayToDelete = deleteStayId ? stays.find((stay) => stay._id === deleteStayId) ?? null : null;
  const roomToDelete = deleteRoomId ? rooms.find((room) => room._id === deleteRoomId) ?? null : null;

  const requestDeleteStay = (stay: Stay) => {
    setDeleteError(null);
    setDeleteStayId(stay._id);
  };

  const requestDeleteRoom = (room: Room) => {
    const assigned = stays.filter((stay) => stay.roomId === room._id).length;
    if (assigned > 0) {
      setNotice({
        type: "error",
        message: `${room.name} can't be deleted: ${plural(assigned, "stay")} ${assigned === 1 ? "is" : "are"} still assigned to it. Move ${assigned === 1 ? "it" : "them"} to another room first.`,
      });
      return;
    }
    setDeleteError(null);
    setDeleteRoomId(room._id);
  };

  const cancelDelete = useCallback(() => {
    if (deleting) return;
    setDeleteStayId(null);
    setDeleteRoomId(null);
  }, [deleting]);

  const confirmDeleteStay = async () => {
    if (!stayToDelete || deleting) return;
    const target = stayToDelete;
    setDeleting(true);
    setDeleteError(null);
    const result = await callAction(() => deleteStayAction(target._id));
    setDeleting(false);
    if (!result.ok) {
      setDeleteError(result.error);
      return;
    }
    setStays((prev) => prev.filter((stay) => stay._id !== target._id));
    setDeleteStayId(null);
    setNotice({ type: "success", message: `Deleted the stay of ${volunteerName(lookups.volunteers.get(target.volunteerId))}.` });
  };

  const confirmDeleteRoom = async () => {
    if (!roomToDelete || deleting) return;
    const target = roomToDelete;
    setDeleting(true);
    setDeleteError(null);
    const result = await callAction(() => deleteRoomAction(target._id));
    setDeleting(false);
    if (!result.ok) {
      setDeleteError(result.error);
      return;
    }
    setRooms((prev) => prev.filter((room) => room._id !== target._id));
    setDeleteRoomId(null);
    setNotice({ type: "success", message: `${target.name} was deleted.` });
  };

  const handleRoomSaved = (room: Room, created: boolean) => {
    setRooms((prev) =>
      (prev.some((item) => item._id === room._id) ? prev.map((item) => (item._id === room._id ? room : item)) : [...prev, room]).sort(
        (a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" })
      )
    );
    setRoomModal(null);
    setNotice({ type: "success", message: created ? `${room.name} was added.` : `Saved ${room.name}.` });
  };

  const statCards = [
    { label: "Arriving today", value: stats.arrivingToday, tone: "text-emerald-400", tab: "arrivals" as StaysTab },
    { label: "Next 14 days", value: stats.nextTwoWeeks, tone: "text-sky-300", tab: "arrivals" as StaysTab },
    { label: "In Morocco now", value: stats.inCountry, tone: "text-white", tab: "all" as StaysTab },
    { label: "90-day alerts", value: stats.visaAlerts, tone: stats.visaAlerts > 0 ? "text-rose-300" : "text-slate-400", tab: "all" as StaysTab },
    { label: "Documents missing", value: stats.missingDocs, tone: stats.missingDocs > 0 ? "text-amber-300" : "text-slate-400", tab: "all" as StaysTab },
  ];

  const tabCounts: Record<StaysTab, number> = {
    arrivals: stats.arrivingToday + stats.nextTwoWeeks,
    all: stays.length,
    rooms: rooms.length,
  };

  return (
    <div className="flex-1 p-4 sm:p-6 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <PlaneLanding className="h-7 w-7 sm:h-8 sm:w-8 text-emerald-400" />
            Stays &amp; Arrivals
          </h1>
          <p className="text-slate-400 mt-1 text-sm sm:text-base">
            Airport pickups, rooms, documents, allowances and the 90-day counter for every volunteer stay.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {tab === "rooms" && (
            <button type="button" onClick={() => setRoomModal({ room: null })} className={SECONDARY_BUTTON}>
              <BedDouble className="h-4 w-4" />
              Add room
            </button>
          )}
          <button type="button" onClick={() => openCreateStay()} className={PRIMARY_BUTTON}>
            <Plus className="h-4 w-4" />
            Add stay
          </button>
        </div>
      </div>

      {loadErrors.length > 0 && (
        <div
          role="alert"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300"
        >
          <span className="flex items-start gap-2">
            <TriangleAlert className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{loadErrors.join(" ")}</span>
          </span>
          <button
            type="button"
            onClick={() => startRefresh(() => router.refresh())}
            disabled={isRefreshing}
            className="flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border border-rose-500/30 text-rose-200 hover:bg-rose-500/20 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            {isRefreshing ? "Retrying..." : "Retry"}
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {statCards.map((card) => (
          <button
            key={card.label}
            type="button"
            onClick={() => setTab(card.tab)}
            className="text-left bg-slate-950/40 border border-slate-900 hover:border-slate-800 rounded-xl p-4 transition-colors"
          >
            <span className="text-[11px] text-slate-500 uppercase tracking-wider block font-semibold">{card.label}</span>
            <span className={`text-2xl font-bold block mt-1 ${card.tone}`}>{card.value}</span>
          </button>
        ))}
      </div>

      <div role="tablist" aria-label="Stays views" className="flex gap-1 overflow-x-auto border-b border-slate-800 -mx-1 px-1">
        {TABS.map((item) => {
          const Icon = item.icon;
          const selected = tab === item.id;
          return (
            <button
              key={item.id}
              id={`stays-tab-${item.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`stays-panel-${item.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setTab(item.id)}
              onKeyDown={(event) => {
                if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
                const index = TABS.findIndex((entry) => entry.id === item.id);
                const next = TABS[(index + (event.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length];
                setTab(next.id);
                document.getElementById(`stays-tab-${next.id}`)?.focus();
              }}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap transition-colors ${
                selected ? "border-emerald-400 text-white" : "border-transparent text-slate-400 hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
              <span className="text-[11px] font-semibold text-slate-500 bg-slate-900 border border-slate-800 rounded-full px-1.5">
                {tabCounts[item.id]}
              </span>
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`stays-panel-${tab}`} aria-labelledby={`stays-tab-${tab}`}>
        {tab === "arrivals" && (
          <ArrivalsTab
            stays={stays}
            lookups={lookups}
            today={today}
            busy={pickupBusy}
            hasVolunteers={volunteers.length > 0}
            pickupTemplate={pickupTemplate}
            organizationName={organizationName}
            onPickup={handlePickup}
            onEdit={openEditStay}
            onCreate={() => openCreateStay()}
          />
        )}
        {tab === "all" && (
          <StaysTable
            stays={stays}
            lookups={lookups}
            projects={projects}
            today={today}
            filters={filters}
            hasVolunteers={volunteers.length > 0}
            onFiltersChange={setFilters}
            onEdit={openEditStay}
            onDelete={requestDeleteStay}
            onCreate={() => openCreateStay()}
          />
        )}
        {tab === "rooms" && (
          <RoomsTab
            rooms={rooms}
            stays={stays}
            lookups={lookups}
            date={roomsDate ?? today}
            today={today}
            onDateChange={(date) => setRoomsDate(date === today ? null : date)}
            onCreate={() => setRoomModal({ room: null })}
            onEdit={(room) => setRoomModal({ room })}
            onDelete={requestDeleteRoom}
            onEditStay={openEditStay}
          />
        )}
      </div>

      {stayModal && (stayModal.stayId === null || editingStay) && (
        <StayModal
          key={stayModal.stayId ?? "new"}
          stay={editingStay}
          defaults={stayModal.defaults}
          stays={stays}
          volunteers={volunteers}
          projects={projects}
          rooms={rooms}
          today={today}
          onClose={closeStayModal}
          onSaved={handleStaySaved}
          onStayChanged={upsertStay}
          onNotice={setNotice}
        />
      )}

      {roomModal && (
        <RoomModal
          key={roomModal.room?._id ?? "new-room"}
          room={roomModal.room}
          rooms={rooms}
          locations={locations}
          onClose={closeRoomModal}
          onSaved={handleRoomSaved}
        />
      )}

      {stayToDelete && (
        <ConfirmDialog
          id="delete-stay"
          title="Delete stay"
          confirmLabel="Delete stay"
          busyLabel="Deleting..."
          busy={deleting}
          error={deleteError}
          onConfirm={confirmDeleteStay}
          onCancel={cancelDelete}
        >
          Delete the stay of{" "}
          <span className="font-semibold text-white">{volunteerName(lookups.volunteers.get(stayToDelete.volunteerId))}</span>? Its
          pickup plan, documents checklist
          {(stayToDelete.allowances?.length ?? 0) > 0
            ? ` and ${plural(stayToDelete.allowances?.length ?? 0, "allowance payment")}`
            : ""}{" "}
          are removed permanently. To keep the history, set the status to Cancelled instead.
        </ConfirmDialog>
      )}

      {roomToDelete && (
        <ConfirmDialog
          id="delete-room"
          title="Delete room"
          confirmLabel="Delete room"
          busyLabel="Deleting..."
          busy={deleting}
          error={deleteError}
          onConfirm={confirmDeleteRoom}
          onCancel={cancelDelete}
        >
          Delete <span className="font-semibold text-white">{roomToDelete.name}</span> ({plural(roomToDelete.beds, "bed")})? This
          cannot be undone.
        </ConfirmDialog>
      )}

      <Toast notice={notice} onDismiss={dismissNotice} />
    </div>
  );
}
