import { slugSchema } from "../../schemas/dashboard/organization";

export function slugifyOrganization(value: string): string {
  return slugSchema.safeParse(value).data ?? "";
}

export function slugifyOrganizationWhileTyping(value: string): string {
  const slug = slugifyOrganization(value);
  return slug && /[-\s]$/.test(value) ? `${slug}-` : slug;
}
