import type * as z from "zod";

import type { socialVideoAttachmentSchema } from "../../schemas/dashboard/content";

export type SocialVideoAttachment = z.infer<typeof socialVideoAttachmentSchema>;
