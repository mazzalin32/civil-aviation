import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));
const hexColor = z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #4169E1").optional().or(z.literal(""));

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(2, "Enter an organisation name").max(160),
  logoUrl: optionalText(500),
  primaryColor: hexColor,
});

export const updateOrganizationSchema = createOrganizationSchema.extend({
  id: z.string().min(1),
});

export const inviteAdminSchema = z.object({
  organizationId: z.string().min(1),
  name: z.string().trim().min(1, "Enter a name").max(120),
  email: z.email(),
});
