// Volunteer feedback: shared by the public /feedback form (client) and the server action.

export const FEEDBACK_LIMITS = { name: 80, about: 120, text: 2000 } as const;

export const PROBLEM_ANSWERS = ["yes", "no"] as const;
export type ProblemAnswer = (typeof PROBLEM_ANSWERS)[number];

export interface FeedbackInput {
  name: string;
  about: string; // project or activity
  liked: string;
  disliked: string;
  improve: string;
  hadProblems: ProblemAnswer | "";
  problems: string;
  /** Honeypot: hidden from people, must stay empty. */
  website: string;
  /** Signed render timestamp (minimum fill time). */
  formToken: string;
}

export type FeedbackField = "name" | "about" | "liked" | "disliked" | "improve" | "hadProblems" | "problems";
export type FeedbackErrors = Partial<Record<FeedbackField | "form", string>>;

export interface ParsedFeedback {
  name?: string;
  about?: string;
  liked?: string;
  disliked?: string;
  improve?: string;
  hadProblems?: ProblemAnswer;
  problems?: string;
}

export interface FeedbackEntry extends ParsedFeedback {
  _id: string;
  createdAt: string;
  handled: boolean;
}

/** English validation messages (the public form shows them translated, matched by these exact texts). */
export const FEEDBACK_MESSAGES = {
  tooLong: "This answer is too long.",
  maxChars: (max: number) => `Use ${max} characters or fewer.`,
  chooseYesNo: "Choose yes or no.",
  atLeastOne: "Answer at least one question — even one sentence helps us.",
  unreadable: "Your feedback could not be read. Please reload the page.",
} as const;

export function emptyFeedback(formToken: string): FeedbackInput {
  return { name: "", about: "", liked: "", disliked: "", improve: "", hadProblems: "", problems: "", website: "", formToken };
}

function clean(value: unknown, max: number, multiline: boolean): { value: string; error?: string } {
  if (value === undefined || value === null) return { value: "" };
  if (typeof value !== "string" || value.length > max * 2) return { value: "", error: FEEDBACK_MESSAGES.tooLong };
  let text = "";
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 32 && !(multiline && (code === 10 || code === 9))) {
      text += code === 13 ? "" : " ";
      continue;
    }
    if (code === 127 || (code >= 0x202a && code <= 0x202e) || (code >= 0x2066 && code <= 0x2069)) continue;
    text += char;
  }
  text = multiline ? text.replace(/\n{3,}/g, "\n\n").trim() : text.replace(/\s+/g, " ").trim();
  if (text.length > max) return { value: text, error: FEEDBACK_MESSAGES.maxChars(max) };
  return { value: text };
}

/** Validates feedback. Every question is optional, but at least one must be answered. */
export function validateFeedback(input: unknown): { data: ParsedFeedback | null; errors: FeedbackErrors } {
  const errors: FeedbackErrors = {};
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { data: null, errors: { form: FEEDBACK_MESSAGES.unreadable } };
  }
  const raw = input as Record<string, unknown>;
  const field = (key: FeedbackField, max: number, multiline: boolean) => {
    const result = clean(raw[key], max, multiline);
    if (result.error) errors[key] = result.error;
    return result.value;
  };

  const name = field("name", FEEDBACK_LIMITS.name, false);
  const about = field("about", FEEDBACK_LIMITS.about, false);
  const liked = field("liked", FEEDBACK_LIMITS.text, true);
  const disliked = field("disliked", FEEDBACK_LIMITS.text, true);
  const improve = field("improve", FEEDBACK_LIMITS.text, true);
  const problems = field("problems", FEEDBACK_LIMITS.text, true);

  const hadProblemsRaw = raw.hadProblems;
  let hadProblems: ProblemAnswer | undefined;
  if (hadProblemsRaw !== undefined && hadProblemsRaw !== null && hadProblemsRaw !== "") {
    if (!(PROBLEM_ANSWERS as readonly unknown[]).includes(hadProblemsRaw)) errors.hadProblems = FEEDBACK_MESSAGES.chooseYesNo;
    else hadProblems = hadProblemsRaw as ProblemAnswer;
  }

  if (!liked && !disliked && !improve && !problems && !hadProblems && Object.keys(errors).length === 0) {
    errors.form = FEEDBACK_MESSAGES.atLeastOne;
  }
  if (Object.keys(errors).length > 0) return { data: null, errors };

  return {
    data: {
      name: name || undefined,
      about: about || undefined,
      liked: liked || undefined,
      disliked: disliked || undefined,
      improve: improve || undefined,
      hadProblems,
      problems: problems || undefined,
    },
    errors: {},
  };
}
