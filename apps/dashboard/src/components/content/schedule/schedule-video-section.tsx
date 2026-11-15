"use client";

import type { SocialVideoAttachment as SocialVideoDraft } from "@notra/schemas/types/dashboard/content";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { SocialVideoAttachment } from "@/components/content/social-video-attachment";
import { SOCIAL_VIDEO } from "@/constants/social-video";
import { useContent, useSaveSocialVideo } from "@/lib/hooks/use-content";
import { useSocialVideoPending } from "@/lib/hooks/use-social-video-pending";
import type { ScheduleVideoSectionProps } from "@/types/content/schedule";

export function ScheduleVideoSection({
  organizationId,
  contentId,
  contentType,
  destinations,
  disabled,
}: ScheduleVideoSectionProps) {
  const t = useTranslations("content.calendar.schedule");
  const tPost = useTranslations("content.postSocial");
  const { data } = useContent(organizationId, contentId);
  const saveVideo = useSaveSocialVideo(organizationId, contentId);
  const pending = useSocialVideoPending(organizationId, contentId);

  const socialEnabled = destinations.social?.checked;
  if (!(socialEnabled && SOCIAL_VIDEO.contentTypes.has(contentType) && data)) {
    return null;
  }

  const saved = data.content.sourceMetadata?.socialVideo ?? null;
  const video = saveVideo.isPending ? (saveVideo.variables ?? null) : saved;

  const handleChange = (next: SocialVideoDraft | null) => {
    saveVideo.mutate(next, {
      onError: () => toast.error(tPost("attachmentSaveFailed")),
    });
  };

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-medium">{t("video")}</h3>
      <SocialVideoAttachment
        contentId={contentId}
        disabled={disabled || pending}
        onChange={handleChange}
        value={video}
      />
    </section>
  );
}
