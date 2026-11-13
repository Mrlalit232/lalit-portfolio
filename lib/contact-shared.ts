/**
 * Contact-form constants and types that are safe to import from CLIENT components.
 * Deliberately has NO runtime import of Zod: importing lib/contact.ts (which builds the Zod schema at module load)
 * from the browser would ship the whole validation library to every visitor, and the home page prefetches the
 * contact page's JavaScript. The schema stays in lib/contact.ts and is used by the server action only.
 */
import type { ContactInput } from "./contact";

export const inquiryTypes = [
  { value: "employment", label: "Employment inquiry" },
  { value: "project", label: "Website / project inquiry" },
  { value: "collaboration", label: "Business collaboration" },
  { value: "other", label: "Something else" },
] as const;

type FieldValues = Partial<Record<keyof ContactInput, string>>;

export type ContactState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string; fieldErrors?: FieldValues; values?: FieldValues }
  /** No email provider configured: nothing was sent. The UI offers a mailto fallback. */
  | { status: "unconfigured"; message: string; mailto?: string; values?: FieldValues };

export const initialContactState: ContactState = { status: "idle" };
