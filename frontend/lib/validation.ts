import { z } from "zod";

export const createTestSchema = z.object({
  name: z.string().trim().min(3, "Enter at least 3 characters."),
  description: z.string().trim().max(500, "Keep the description under 500 characters.").optional(),
  scriptType: z.enum(["HTTP", "TruClient", "JMeter"], {
    error: "Select a script type.",
  }),
  targetUrl: z.url("Enter a valid URL, including https://."),
  virtualUsers: z.coerce
    .number()
    .int("Virtual users must be a whole number.")
    .min(1, "Use at least 1 virtual user.")
    .max(10_000, "Use 10,000 virtual users or fewer."),
});

export type CreateTestFormValues = z.infer<typeof createTestSchema>;
