import { z } from "zod";

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

// Browser-safe constants and types live in contact-shared.ts (no Zod); re-exported here for server code.
export { inquiryTypes, initialContactState } from "./contact-shared";
export type { ContactState } from "./contact-shared";
