import {
  ContentIcon,
  FeedbackIcon,
  ImagesIcon,
  ProjectsIcon,
  ReferencesIcon,
  RetentionIcon,
  SocialIcon,
  SupportIcon,
  TrackingIcon,
  TrafficIcon,
  ZdrIcon,
} from "@/components/landing/pricing-icons";
import type { PricingIcon, PricingIconKey } from "@/types/landing/pricing";

export const PRICING_ICONS: Record<PricingIconKey, PricingIcon> = {
  tracking: TrackingIcon,
  traffic: TrafficIcon,
  feedback: FeedbackIcon,
  images: ImagesIcon,
  content: ContentIcon,
  social: SocialIcon,
  projects: ProjectsIcon,
  references: ReferencesIcon,
  retention: RetentionIcon,
  support: SupportIcon,
  zdr: ZdrIcon,
};
