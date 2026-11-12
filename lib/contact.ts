import { z } from "zod";

export const inquiryTypes = [
  { value: "employment", label: "Employment inquiry" },
  { value: "project", label: "Website / project inquiry" },
  { value: "collaboration", label: "Business collaboration" },
  { value: "other", label: "Something else" },
] as const;

export const contactSchema = z.object({
  type: z.enum(["employment", "project", "collaboration", "other"], {
    error: "Please choose an inquiry type.",
  }),
  name: z.string().trim().min(2, "Please enter your name.").max(100, "Name is too long."),
  email: z.email("Please enter a valid email address.").max(200, "Email is too long."),
  company: z.string().trim().max(120, "Company name is too long.").optional(),
  message: z
    .string()
    .trim()
    .min(20, "Please write at least 20 characters so I understand what you need.")
    .max(3000, "Message is too long (3000 characters maximum)."),
});

export type ContactInput = z.infer<typeof contactSchema>;

type FieldValues = Partial<Record<keyof ContactInput, string>>;

export type ContactState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string; fieldErrors?: FieldValues; values?: FieldValues }
  /** No email provider configured: nothing was sent. The UI offers a mailto fallback. */
  | { status: "unconfigured"; message: string; mailto?: string; values?: FieldValues };

export const initialContactState: ContactState = { status: "idle" };
