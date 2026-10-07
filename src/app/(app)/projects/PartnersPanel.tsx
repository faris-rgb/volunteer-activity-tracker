"use client";

import React, { useMemo, useState } from "react";
import { CircleX, ExternalLink, Handshake, LoaderCircle, Pencil, Plus, Search, Trash2, TriangleAlert } from "lucide-react";
import {
  createPartnerAction,
  deletePartnerAction,
  updatePartnerAction,
  type PartnerInput,
  type ProjectWithStats,
} from "@/app/actions/projects";
import type { Partner } from "@/lib/domain";
import { PARTNER_TYPES, PARTNER_TYPE_LABELS, type PartnerType } from "@/sanity/schemas/partner";
import {
  COUNTRY_SUGGESTIONS,
  FILTER_SELECT,
  INPUT_CLASS,
  LABEL_CLASS,
  Modal,
  NETWORK_ERROR,
  PRIMARY_BUTTON,
  SECONDARY_BUTTON,
  pluralize,
} from "./ui";

/* ---------- Table ---------- */

interface PartnersTableProps {
  partners: Partner[];
  projects: ProjectWithStats[];
  onCreate: () => void;
  onEdit: (partner: Partner) => void;
  onDelete: (partner: Partner) => void;
}

function displayHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Only http(s) links are rendered as anchors. */
function safeHref(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export function PartnersTable({ partners, projects, onCreate, onEdit, onDelete }: PartnersTableProps) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | PartnerType>("all");

  const projectsByPartner = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const project of projects) {
      for (const partnerId of project.partnerIds ?? []) {
        map.set(partnerId, [...(map.get(partnerId) ?? []), project.name]);
      }
    }
    return map;
  }, [projects]);

  const query = search.trim().toLowerCase();
  const visiblePartners = partners.filter((partner) => {
    if (typeFilter !== "all" && partner.type !== typeFilter) return false;
    if (!query) return true;
    return [partner.name, partner.country, partner.website, partner.notes, partner.type ? PARTNER_TYPE_LABELS[partner.type] : ""].some(
      (value) => value?.toLowerCase().includes(query)
    );
  });

  if (partners.length === 0) {
    return (
      <div className="py-16 px-6 border border-dashed border-slate-800 bg-slate-950/20 rounded-2xl text-center">
        <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mx-auto">
          <Handshake className="h-7 w-7" />
        </div>
        <h3 className="mt-4 text-lg font-bold text-white">No partners yet</h3>
        <p className="mt-1 text-sm text-slate-400 max-w-md mx-auto">
          Keep track of sending organisations (like Stichting Cultined in the Netherlands), schools, care homes and other
          local partners, and link them to your projects.
        </p>
        <button type="button" onClick={onCreate} className={`mt-6 inline-flex ${PRIMARY_BUTTON}`}>
          <Plus className="h-4 w-4" />
          Add First Partner
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-slate-950/40 border border-slate-900 rounded-2xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search partners by name, country, notes..."
            aria-label="Search partners"
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900/60 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value as "all" | PartnerType)}
          aria-label="Filter partners by type"
          className={`${FILTER_SELECT} sm:min-w-[190px]`}
        >
          <option value="all">All partner types</option>
          {PARTNER_TYPES.map((type) => (
            <option key={type} value={type}>
              {PARTNER_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </div>

      {visiblePartners.length === 0 ? (
        <div className="py-12 border border-slate-900 bg-slate-950/20 rounded-2xl text-center text-slate-500 text-sm space-y-3">
          <p>No partners match your search or filter.</p>
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setTypeFilter("all");
            }}
            className={SECONDARY_BUTTON}
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="bg-slate-950/40 border border-slate-900 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-900/80 text-xs font-semibold text-slate-400 uppercase bg-slate-950/20">
                  <th scope="col" className="py-4 px-4 sm:px-6">Partner</th>
                  <th scope="col" className="py-4 px-4 sm:px-6">Type</th>
                  <th scope="col" className="py-4 px-4 sm:px-6">Country</th>
                  <th scope="col" className="py-4 px-4 sm:px-6">Projects</th>
                  <th scope="col" className="py-4 px-6 hidden lg:table-cell">Notes</th>
                  <th scope="col" className="py-4 px-4 sm:px-6 text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/40 text-sm">
                {visiblePartners.map((partner) => {
                  const linkedProjects = projectsByPartner.get(partner._id) ?? [];
                  const href = safeHref(partner.website);
                  return (
                    <tr key={partner._id} className="hover:bg-slate-950/20 transition-colors">
                      <td className="py-4 px-4 sm:px-6 min-w-[12rem]">
                        <div className="font-bold text-white">{partner.name}</div>
                        {href && (
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 mt-0.5"
                          >
                            {displayHost(href)}
                            <ExternalLink className="h-3 w-3" aria-hidden="true" />
                            <span className="sr-only">(opens in a new tab)</span>
                          </a>
                        )}
                      </td>
                      <td className="py-4 px-4 sm:px-6 text-slate-300 whitespace-nowrap">
                        {partner.type ? PARTNER_TYPE_LABELS[partner.type] : <span className="text-slate-600">—</span>}
                      </td>
                      <td className="py-4 px-4 sm:px-6 text-slate-300 whitespace-nowrap">
                        {partner.country || <span className="text-slate-600">—</span>}
                      </td>
                      <td className="py-4 px-4 sm:px-6">
                        {linkedProjects.length === 0 ? (
                          <span className="text-slate-600">None</span>
                        ) : (
                          <span className="text-slate-300" title={linkedProjects.join(", ")}>
                            {pluralize(linkedProjects.length, "project")}
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 hidden lg:table-cell">
                        <span className="text-slate-500 text-xs line-clamp-2 max-w-xs">{partner.notes || "—"}</span>
                      </td>
                      <td className="py-4 px-4 sm:px-6">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => onEdit(partner)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
                            title="Edit partner"
                            aria-label={`Edit ${partner.name}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDelete(partner)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-900 transition-colors"
                            title="Delete partner"
                            aria-label={`Delete ${partner.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Create / edit modal ---------- */

interface PartnerFormModalProps {
  partner: Partner | null;
  onClose: () => void;
  onSaved: (partner: Partner, created: boolean) => void;
  onNotFound: (partnerId: string, message: string) => void;
  onResync: () => void;
}

interface PartnerFormState {
  name: string;
  type: PartnerType | "";
  country: string;
  website: string;
  notes: string;
}

type PartnerField = keyof PartnerFormState;

function looksLikeWebsite(value: string): boolean {
  const text = value.trim();
  if (!text) return true;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`);
    return (url.protocol === "https:" || url.protocol === "http:") && url.hostname.includes(".");
  } catch {
    return false;
  }
}

export function PartnerFormModal({ partner, onClose, onSaved, onNotFound, onResync }: PartnerFormModalProps) {
  const [form, setForm] = useState<PartnerFormState>(() => ({
    name: partner?.name ?? "",
    type: partner?.type ?? "",
    country: partner?.country ?? "",
    website: partner?.website ?? "",
    notes: partner?.notes ?? "",
  }));
  const [formError, setFormError] = useState<{ field: PartnerField | null; message: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const updateField = <K extends PartnerField>(field: K, value: PartnerFormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (formError?.field === field) setFormError(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;

    if (!form.name.trim()) {
      setFormError({ field: "name", message: "Partner name is required." });
      document.getElementById("partner-name")?.focus();
      return;
    }
    if (!looksLikeWebsite(form.website)) {
      setFormError({ field: "website", message: "Website must be a valid web address, e.g. https://example.org." });
      document.getElementById("partner-website")?.focus();
      return;
    }

    const payload: PartnerInput = {
      name: form.name.trim(),
      type: form.type || undefined,
      country: form.country.trim() || undefined,
      website: form.website.trim() || undefined,
      notes: form.notes.trim() || undefined,
    };

    setSaving(true);
    setFormError(null);
    try {
      const result = partner ? await updatePartnerAction(partner._id, payload) : await createPartnerAction(payload);
      if (!result.ok) {
        if (result.notFound && partner) {
          onNotFound(partner._id, result.error);
          return;
        }
        setFormError({ field: null, message: result.error });
        onResync();
        return;
      }
      onSaved(result.data, !partner);
    } catch (error) {
      console.error(error);
      setFormError({ field: null, message: NETWORK_ERROR });
    } finally {
      setSaving(false);
    }
  };

  const fieldClass = (field: PartnerField, extra = "py-2 text-white") =>
    `${INPUT_CLASS} ${extra} ${formError?.field === field ? "border-rose-500/60" : "border-slate-800"}`;

  return (
    <Modal title={partner ? "Edit Partner" : "Add Partner"} onClose={onClose} busy={saving} size="lg">
      <form onSubmit={handleSubmit} noValidate className="flex flex-col min-h-0">
        <div className="p-6 space-y-4 overflow-y-auto">
          {formError && (
            <div
              role="alert"
              className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl px-4 py-3 text-sm"
            >
              <TriangleAlert className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{formError.message}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="partner-name" className={LABEL_CLASS}>
              Name *
            </label>
            <input
              id="partner-name"
              type="text"
              required
              autoFocus
              maxLength={120}
              value={form.name}
              onChange={(event) => updateField("name", event.target.value)}
              placeholder="e.g. Stichting Cultined"
              className={fieldClass("name")}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="partner-type" className={LABEL_CLASS}>
                Type
              </label>
              <select
                id="partner-type"
                value={form.type}
                onChange={(event) => updateField("type", event.target.value as PartnerFormState["type"])}
                className={fieldClass("type", "py-2.5 text-slate-200")}
              >
                <option value="">Not set</option>
                {PARTNER_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {PARTNER_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="partner-country" className={LABEL_CLASS}>
                Country
              </label>
              <input
                id="partner-country"
                type="text"
                maxLength={80}
                list="partner-country-options"
                value={form.country}
                onChange={(event) => updateField("country", event.target.value)}
                placeholder="e.g. Netherlands"
                className={fieldClass("country")}
              />
              <datalist id="partner-country-options">
                {COUNTRY_SUGGESTIONS.map((country) => (
                  <option key={country} value={country} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="partner-website" className={LABEL_CLASS}>
              Website
            </label>
            <input
              id="partner-website"
              type="url"
              inputMode="url"
              maxLength={300}
              value={form.website}
              onChange={(event) => updateField("website", event.target.value)}
              placeholder="https://"
              className={fieldClass("website")}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="partner-notes" className={LABEL_CLASS}>
              Notes
            </label>
            <textarea
              id="partner-notes"
              rows={3}
              maxLength={2000}
              value={form.notes}
              onChange={(event) => updateField("notes", event.target.value)}
              placeholder="Contact person, agreements, what they help with..."
              className={fieldClass("notes", "py-3 text-white resize-y")}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-800/80 bg-slate-950/30 shrink-0">
          <button type="button" onClick={onClose} disabled={saving} className={SECONDARY_BUTTON}>
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-emerald-500 text-slate-950 hover:bg-emerald-400 disabled:opacity-50 transition-colors"
          >
            {saving && <LoaderCircle className="h-4 w-4 animate-spin" />}
            {saving ? "Saving..." : partner ? "Save Changes" : "Add Partner"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------- Delete dialog ---------- */

interface DeletePartnerDialogProps {
  partner: Partner;
  /** Names of projects that use this partner, as known on the client. */
  linkedProjects: string[];
  onClose: () => void;
  onDeleted: (partnerId: string) => void;
  onNotFound: (partnerId: string, message: string) => void;
  onResync: () => void;
}

export function DeletePartnerDialog({
  partner,
  linkedProjects,
  onClose,
  onDeleted,
  onNotFound,
  onResync,
}: DeletePartnerDialogProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);
  const [blockingProjects, setBlockingProjects] = useState<string[]>(linkedProjects);

  const blocked = blockingProjects.length > 0 || blockedMessage !== null;

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    setError(null);
    try {
      const result = await deletePartnerAction(partner._id);
      if (!result.ok) {
        if (result.notFound) {
          onNotFound(partner._id, result.error);
          return;
        }
        if (result.partnerLinks) {
          setBlockingProjects(result.partnerLinks.projects);
          setBlockedMessage(result.error);
          onResync();
          return;
        }
        setError(result.error);
        onResync();
        return;
      }
      onDeleted(partner._id);
    } catch (caught) {
      console.error(caught);
      setError(NETWORK_ERROR);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal
      title={blocked ? "Partner is still in use" : "Delete partner"}
      onClose={onClose}
      busy={deleting}
      size="md"
      role="alertdialog"
      describedBy="delete-partner-description"
      bare
    >
      <div className="p-6 space-y-4 overflow-y-auto">
        <div
          className={`h-12 w-12 rounded-xl border flex items-center justify-center mx-auto ${
            blocked ? "bg-amber-500/10 border-amber-500/20 text-amber-400" : "bg-rose-500/10 border-rose-500/20 text-rose-400"
          }`}
        >
          <TriangleAlert className="h-6 w-6" />
        </div>
        <div className="text-center space-y-2">
          <p className="text-lg font-bold text-white" aria-hidden="true">
            {blocked ? "Partner is still in use" : "Delete partner"}
          </p>
          {blocked ? (
            <p id="delete-partner-description" className="text-xs text-slate-400 leading-relaxed">
              {blockedMessage ?? (
                <>
                  <span className="font-semibold text-white">{partner.name}</span> is linked to{" "}
                  {pluralize(blockingProjects.length, "project")}. Remove it from{" "}
                  {blockingProjects.length === 1 ? "that project" : "those projects"} first (edit the project and untick the
                  partner), then delete it.
                </>
              )}
            </p>
          ) : (
            <p id="delete-partner-description" className="text-xs text-slate-400 leading-relaxed">
              Are you sure you want to delete <span className="font-semibold text-white">{partner.name}</span>? This
              cannot be undone.
            </p>
          )}
        </div>

        {blocked && blockingProjects.length > 0 && (
          <ul className="bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-300 space-y-1 max-h-40 overflow-y-auto">
            {blockingProjects.map((name, index) => (
              <li key={`${name}-${index}`} className="truncate">
                • {name}
              </li>
            ))}
          </ul>
        )}

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl px-4 py-3 text-xs"
          >
            <CircleX className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-center justify-center gap-3 pt-2">
          <button type="button" onClick={onClose} disabled={deleting} className={SECONDARY_BUTTON} autoFocus>
            {blocked ? "Close" : "Cancel"}
          </button>
          {!blocked && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-rose-500 text-white hover:bg-rose-400 disabled:opacity-50 transition-colors"
            >
              {deleting && <LoaderCircle className="h-4 w-4 animate-spin" />}
              {deleting ? "Deleting..." : "Delete Partner"}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
