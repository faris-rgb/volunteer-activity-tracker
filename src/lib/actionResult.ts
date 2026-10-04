/**
 * Return shape for mutating server actions. Thrown errors are masked by Next.js in
 * production, so actions return their error message instead of throwing it.
 */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export function actionOk<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function actionError(error: unknown, fallback = "Something went wrong. Please try again."): ActionResult<never> {
  const message = error instanceof Error && error.message ? error.message : fallback;
  return { ok: false, error: message };
}
