import "server-only";
import { readFile } from "fs/promises";
import path from "path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { VOLUNTEER_TYPE_LABELS } from "@/lib/domain";
import {
  DIET_LABELS,
  GENDER_LABELS,
  JOIN_SOURCE_LABELS,
  OCCUPATION_LABELS,
  formatDay,
  type JoinSource,
  type ParsedApplication,
} from "@/app/join/joinShared";

// Fonts are traced into the /join server bundle via outputFileTracingIncludes in next.config.ts.
const FONT_DIR = path.join(process.cwd(), "src", "assets", "fonts");

const PAGE = { width: 595.28, height: 841.89, margin: 50 }; // A4 in points
const COLORS = {
  text: rgb(0.1, 0.12, 0.16),
  muted: rgb(0.42, 0.45, 0.5),
  accent: rgb(0.02, 0.55, 0.42),
  rule: rgb(0.85, 0.87, 0.9),
};

interface PdfContext {
  doc: PDFDocument;
  page: PDFPage;
  y: number;
  regular: PDFFont;
  bold: PDFFont;
}

/** Replaces characters the font cannot draw (e.g. Arabic script) so pdf-lib doesn't throw. */
function drawable(font: PDFFont, value: string): string {
  const supported = new Set(font.getCharacterSet());
  let out = "";
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    out += code === 10 || supported.has(code) ? char : "?";
  }
  return out;
}

function wrap(font: PDFFont, text: string, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= width) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      // Break words that are longer than a whole line.
      let rest = word;
      while (font.widthOfTextAtSize(rest, size) > width) {
        let cut = rest.length - 1;
        while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > width) cut -= 1;
        lines.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      line = rest;
    }
    lines.push(line);
  }
  return lines;
}

function ensureSpace(ctx: PdfContext, needed: number) {
  if (ctx.y - needed >= PAGE.margin) return;
  ctx.page = ctx.doc.addPage([PAGE.width, PAGE.height]);
  ctx.y = PAGE.height - PAGE.margin;
}

function heading(ctx: PdfContext, title: string) {
  ensureSpace(ctx, 40);
  ctx.y -= 18;
  ctx.page.drawText(drawable(ctx.bold, title.toUpperCase()), {
    x: PAGE.margin,
    y: ctx.y,
    size: 10,
    font: ctx.bold,
    color: COLORS.accent,
  });
  ctx.y -= 6;
  ctx.page.drawLine({
    start: { x: PAGE.margin, y: ctx.y },
    end: { x: PAGE.width - PAGE.margin, y: ctx.y },
    thickness: 0.6,
    color: COLORS.rule,
  });
  ctx.y -= 14;
}

const LABEL_WIDTH = 170;

function row(ctx: PdfContext, label: string, value: string | undefined) {
  const text = value?.trim() ? value.trim() : "—";
  const size = 10;
  const valueWidth = PAGE.width - PAGE.margin * 2 - LABEL_WIDTH;
  const labelLines = wrap(ctx.regular, drawable(ctx.regular, label), 9, LABEL_WIDTH - 10);
  const valueLines = wrap(ctx.regular, drawable(ctx.regular, text), size, valueWidth);
  const lineHeight = 14;

  for (let index = 0; index < Math.max(labelLines.length, valueLines.length); index += 1) {
    ensureSpace(ctx, lineHeight);
    if (labelLines[index]) {
      ctx.page.drawText(labelLines[index], { x: PAGE.margin, y: ctx.y, size: 9, font: ctx.regular, color: COLORS.muted });
    }
    if (valueLines[index]) {
      ctx.page.drawText(valueLines[index], {
        x: PAGE.margin + LABEL_WIDTH,
        y: ctx.y,
        size,
        font: ctx.regular,
        color: COLORS.text,
      });
    }
    ctx.y -= lineHeight;
  }
  ctx.y -= 4;
}

const yesNo = (value: boolean) => (value ? "Yes" : "No");
const day = (value?: string) => (value ? formatDay(value) : undefined);

/**
 * Renders a submitted Join-form application as an A4 PDF.
 * `submittedAt` is shown in Morocco time.
 */
export async function renderApplicationPdf(
  application: ParsedApplication,
  { orgName, projectName, submittedAt }: { orgName: string; projectName?: string; submittedAt: Date }
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const [regularBytes, boldBytes] = await Promise.all([
    readFile(path.join(FONT_DIR, "NotoSans-Regular.ttf")),
    readFile(path.join(FONT_DIR, "NotoSans-Bold.ttf")),
  ]);
  const regular = await doc.embedFont(regularBytes, { subset: false });
  const bold = await doc.embedFont(boldBytes, { subset: false });

  const fullName = `${application.firstName} ${application.lastName}`;
  doc.setTitle(`Application – ${fullName}`);
  doc.setAuthor(orgName);
  doc.setSubject(projectName ? `Application for ${projectName}` : "General application");
  doc.setCreationDate(submittedAt);

  const ctx: PdfContext = {
    doc,
    page: doc.addPage([PAGE.width, PAGE.height]),
    y: PAGE.height - PAGE.margin,
    regular,
    bold,
  };

  // Header
  ctx.page.drawText(drawable(bold, orgName), { x: PAGE.margin, y: ctx.y - 4, size: 11, font: bold, color: COLORS.accent });
  ctx.y -= 30;
  ctx.page.drawText(drawable(bold, "Application form"), { x: PAGE.margin, y: ctx.y, size: 20, font: bold, color: COLORS.text });
  ctx.y -= 22;
  ctx.page.drawText(drawable(regular, fullName), { x: PAGE.margin, y: ctx.y, size: 13, font: regular, color: COLORS.text });
  ctx.y -= 18;
  const submitted = submittedAt.toLocaleString("en-GB", {
    timeZone: "Africa/Casablanca",
    dateStyle: "long",
    timeStyle: "short",
  });
  ctx.page.drawText(drawable(regular, `Submitted via the ServeTrack app on ${submitted} (Morocco time)`), {
    x: PAGE.margin,
    y: ctx.y,
    size: 9,
    font: regular,
    color: COLORS.muted,
  });
  ctx.y -= 6;

  heading(ctx, "Project");
  row(ctx, "Project", projectName ?? "General application (no specific project)");
  row(ctx, "Volunteer as", VOLUNTEER_TYPE_LABELS[application.volunteerType]);
  row(ctx, "European Youth Portal no.", application.escPortalId);
  row(ctx, "Sending organisation", application.sendingOrganisation);
  row(ctx, "Available from", day(application.availableFrom));
  row(ctx, "Available until", day(application.availableTo));
  row(ctx, "Travelling from", application.travelFrom);

  heading(ctx, "Personal details");
  row(ctx, "First name", application.firstName);
  row(ctx, "Last name", application.lastName);
  row(ctx, "Gender", application.gender ? GENDER_LABELS[application.gender] : undefined);
  row(ctx, "Date of birth", day(application.dateOfBirth));
  row(ctx, "Nationality", application.nationality);

  heading(ctx, "Contact");
  row(ctx, "Email", application.email);
  row(ctx, "Phone (WhatsApp)", application.phone);
  row(ctx, "Address", application.address);
  row(ctx, "City", application.city);
  row(ctx, "Country of residence", application.country);

  heading(ctx, "Emergency contact");
  row(ctx, "Name", application.emergencyName);
  row(ctx, "Phone", application.emergencyPhone);
  row(ctx, "Relation", application.emergencyRelation);

  heading(ctx, "Background");
  row(ctx, "Occupation", application.occupation ? OCCUPATION_LABELS[application.occupation] : undefined);
  row(ctx, "Education / field of study", application.education);
  row(ctx, "Languages", application.languages.join(", "));
  row(ctx, "Skills", application.skills.join(", "));
  row(ctx, "Previous volunteering", application.previousVolunteering);
  row(ctx, "Hopes to learn", application.expectations);

  heading(ctx, "Health & practical");
  row(ctx, "Diet", application.diet ? DIET_LABELS[application.diet] : undefined);
  row(ctx, "Health information", application.healthNotes);
  row(ctx, "Support needs", application.supportNeeds);

  heading(ctx, "Motivation");
  row(ctx, "Why they want to volunteer", application.motivation);
  row(
    ctx,
    "Heard about us via",
    application.source === "join_page" ? "Not specified" : JOIN_SOURCE_LABELS[application.source as JoinSource]
  );

  heading(ctx, "Consent");
  row(ctx, "Data processing and sharing", "Yes (required)");
  row(ctx, "Photos on social media", yesNo(application.photoConsent));

  return doc.save();
}
