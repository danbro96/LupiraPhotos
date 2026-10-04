/** Mutation errors arrive as ApiError but the generated hooks type TError as void — unwrap safely. */
export function errText(error: unknown): string | null {
  return error instanceof Error ? error.message : null;
}
