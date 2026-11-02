/**
 * A file name that is safe to write on every supported platform. Callers pass
 * user-facing text (an album title, a track title) and get something that can
 * only ever land inside the intended directory.
 */
export function isSafeFileName(value: unknown): value is string {
  return typeof value === "string"
    && value.length > 0
    && value !== "."
    && value !== ".."
    && value.split(/[\\/]/u).length === 1
    && !/[<>:"/\\|?*\u0000-\u001f]/u.test(value)
    && !/[. ]$/u.test(value)
    && !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(value);
}

/** Turn free text into one safe file name, keeping an extension. */
export function safeFileName(value: string | undefined, fallback: string, extension: string): string {
  const normalized = (value ?? "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .trim();
  const name = Array.from(normalized).slice(0, 80).join("").replace(/[. ]+$/g, "") || fallback;
  return `${isSafeFileName(name) ? name : `_${name}`}.${extension}`;
}
