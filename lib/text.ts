/**
 * Postgres text and JSON columns cannot store the NUL character (U+0000): a single one in a search box, form field or
 * contact message would otherwise surface as a server error. It is never meaningful in this app's content, so it is
 * removed at every input boundary.
 */
export const stripNul = (s: string) => s.replace(/\u0000/g, "");

/** Recursively removes NUL characters from every string in plain data (objects, arrays, strings). */
export function stripNulDeep<T>(value: T): T {
  if (typeof value === "string") return stripNul(value) as T;
  if (Array.isArray(value)) return value.map((v) => stripNulDeep(v)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, stripNulDeep(v)])) as T;
  }
  return value;
}
