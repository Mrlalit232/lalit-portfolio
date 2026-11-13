/**
 * Converts between HTML form values and structured content objects.
 * Pure functions (no server imports) so they are unit-testable and safe to share with client code.
 */
export type FieldKind = "text" | "textarea" | "paragraphs" | "lines" | "tuples" | "select" | "boolean";

export type FieldDef = {
  /** Dot path into the data object, e.g. "caseStudy.overview". */
  name: string;
  label: string;
  kind: FieldKind;
  help?: string;
  placeholder?: string;
  rows?: number;
  options?: { value: string; label: string }[]; // select
  keys?: string[]; // tuples: object keys, one per "|"-separated column
  required?: boolean;
  group?: string; // section heading shown above the field when it changes
};

export type FormValues = Record<string, string | boolean>;

const getPath = (obj: unknown, path: string) =>
  path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), obj);

function setPath(obj: Record<string, unknown>, path: string, value: unknown) {
  const keys = path.split(".");
  let cur = obj;
  keys.slice(0, -1).forEach((k) => {
    cur[k] = (cur[k] as Record<string, unknown>) ?? {};
    cur = cur[k] as Record<string, unknown>;
  });
  cur[keys[keys.length - 1]] = value;
}

const splitLines = (v: string) => v.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);

/** Raw submitted strings, used to refill the form after a validation error. */
export function rawValues(fields: FieldDef[], fd: FormData): FormValues {
  const out: FormValues = {};
  for (const f of fields) out[f.name] = f.kind === "boolean" ? fd.get(f.name) === "on" : String(fd.get(f.name) ?? "").replace(/\u0000/g, "");
  return out;
}

/** Form values -> structured object. Empty optional values are omitted, not stored as "". */
export function valuesToData(fields: FieldDef[], values: FormValues): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const f of fields) {
    const raw = values[f.name];
    if (f.kind === "boolean") {
      setPath(data, f.name, raw === true);
      continue;
    }
    const str = String(raw ?? "");
    switch (f.kind) {
      case "lines":
        setPath(data, f.name, splitLines(str));
        break;
      case "paragraphs":
        setPath(data, f.name, str.split(/\r?\n\s*\r?\n/).map((s) => s.trim()).filter(Boolean));
        break;
      case "tuples": {
        const keys = f.keys ?? [];
        setPath(
          data,
          f.name,
          splitLines(str).map((line) => {
            const parts = line.split("|").map((s) => s.trim());
            // Last column absorbs any extra "|" characters.
            const row: Record<string, string> = {};
            keys.forEach((k, i) => (row[k] = i === keys.length - 1 ? parts.slice(i).join(" | ") : (parts[i] ?? "")));
            return row;
          }),
        );
        break;
      }
      default:
        if (str.trim() !== "" || f.required) setPath(data, f.name, str.trim());
    }
  }
  return data;
}

/** Structured object -> form values for editing. */
export function dataToValues(fields: FieldDef[], data: Record<string, unknown> | null | undefined): FormValues {
  const out: FormValues = {};
  for (const f of fields) {
    const v = data ? getPath(data, f.name) : undefined;
    if (f.kind === "boolean") out[f.name] = v === true;
    else if (f.kind === "lines") out[f.name] = Array.isArray(v) ? v.join("\n") : "";
    else if (f.kind === "paragraphs") out[f.name] = Array.isArray(v) ? v.join("\n\n") : "";
    else if (f.kind === "tuples")
      out[f.name] = Array.isArray(v)
        ? v.map((row) => (f.keys ?? []).map((k) => String((row as Record<string, unknown>)[k] ?? "")).join(" | ")).join("\n")
        : "";
    else out[f.name] = v == null ? "" : String(v);
  }
  return out;
}

/** Maps Zod issue paths (e.g. ["links", 0, "href"]) onto the form field that owns them. */
export function issuesToFieldErrors(
  fields: FieldDef[],
  issues: { path: PropertyKey[]; message: string }[],
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const path = issue.path.filter((p) => typeof p !== "symbol").map(String);
    const candidates = fields
      .filter((f) => {
        const fp = f.name.split(".");
        return fp.every((seg, i) => path[i] === seg);
      })
      .sort((a, b) => b.name.length - a.name.length);
    const owner = candidates[0]?.name ?? "_form";
    const prefix = path.length > owner.split(".").length ? `Line ${Number(path[owner.split(".").length]) + 1}: ` : "";
    if (!errors[owner]) errors[owner] = `${prefix}${issue.message}`;
  }
  return errors;
}
