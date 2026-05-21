export type BulkOpKind = "complete" | "delete" | "uncomplete";

/**
 * Returns true when the number of bulk ops in the current turn meets or
 * exceeds the threshold that requires explicit confirmation from the user.
 *
 * Threshold: 3 or more complete/delete/uncomplete calls in one turn.
 * op_kind is reserved for future per-kind thresholds but is currently ignored.
 */
export function shouldRequireConfirmation(
  callCount: number,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _opKind: BulkOpKind,
): boolean {
  return callCount >= 3;
}
