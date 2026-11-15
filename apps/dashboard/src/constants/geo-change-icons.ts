import {
  CancelCircleIcon,
  CheckmarkCircle01Icon,
  Link01Icon,
  SparklesIcon,
  Unlink01Icon,
  UserSwitchIcon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import type { GeoChangeKind } from "@notra/geo-core/types/geo";
import { TREND_BADGE_APPEARANCES } from "@notra/ui/constants/trend-badge";

export const GEO_CHANGE_KIND_ICONS: Record<GeoChangeKind, IconSvgElement> = {
  gained_mention: CheckmarkCircle01Icon,
  lost_mention: CancelCircleIcon,
  position_improved: TREND_BADGE_APPEARANCES.up.icon,
  position_dropped: TREND_BADGE_APPEARANCES.down.icon,
  competitor_displaced: UserSwitchIcon,
  citation_added: Link01Icon,
  citation_removed: Unlink01Icon,
  competitor_cited: Link01Icon,
  new_engine: SparklesIcon,
};

export const GEO_CHANGE_KIND_TONE_CLASSES: Record<GeoChangeKind, string> = {
  gained_mention: TREND_BADGE_APPEARANCES.up.foreground,
  lost_mention: TREND_BADGE_APPEARANCES.down.foreground,
  position_improved: TREND_BADGE_APPEARANCES.up.foreground,
  position_dropped: TREND_BADGE_APPEARANCES.down.foreground,
  competitor_displaced: TREND_BADGE_APPEARANCES.down.foreground,
  citation_added: TREND_BADGE_APPEARANCES.up.foreground,
  citation_removed: TREND_BADGE_APPEARANCES.down.foreground,
  competitor_cited: "text-muted-foreground",
  new_engine: "text-muted-foreground",
};

export const GEO_CHANGE_ICON_SIZE = 16;
