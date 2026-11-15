import { cn } from "@notra/ui/lib/utils";

import {
  NavbarBentoFeatureTile,
  NavbarBentoLinkTile,
} from "@/components/navbar-bento";
import { NavbarEngineLogo } from "@/components/navbar-engine-logo";
import { LeaderList } from "@/components/state-of-ai-search/report-ui";
import {
  NAVBAR_BENTO_CLASSES as CLASSES,
  NAVBAR_BENTO_TINT_CYCLE,
} from "@/constants/navbar-bento";
import {
  NAVBAR_REPORTS_ENGINES,
  NAVBAR_REPORTS_OVERVIEW,
  NAVBAR_REPORTS_OVERVIEW_STYLE,
} from "@/constants/navbar-reports";
import {
  REPORTS_NAV_EDITION,
  REPORTS_NAV_LEADERS,
} from "@/constants/reports-navigation";
import type { NavbarBentoPanelProps } from "@/types/navbar-bento";

export function NavbarReportsPanel({ group, onSelect }: NavbarBentoPanelProps) {
  return (
    <div className={CLASSES.panel}>
      <div className="grid grid-cols-3 gap-3">
        {group.rail.map((item, index) => {
          const tint =
            NAVBAR_BENTO_TINT_CYCLE[index % NAVBAR_BENTO_TINT_CYCLE.length];
          const leaders = REPORTS_NAV_LEADERS[item.href] ?? [];
          return (
            <NavbarBentoFeatureTile
              card={item}
              className="h-48"
              iconClassName={tint}
              key={item.href}
              onSelect={onSelect}
            >
              <span className={cn(CLASSES.mockCard, "w-88 py-1")}>
                <LeaderList leaders={leaders} />
              </span>
            </NavbarBentoFeatureTile>
          );
        })}
      </div>
      <div className={CLASSES.row}>
        <NavbarBentoLinkTile
          link={{
            ...NAVBAR_REPORTS_OVERVIEW,
            label: REPORTS_NAV_EDITION
              ? `${group.cardsHeading} · ${REPORTS_NAV_EDITION}`
              : group.cardsHeading,
          }}
          onSelect={onSelect}
          style={NAVBAR_REPORTS_OVERVIEW_STYLE}
        >
          <span className="absolute top-3 left-0 flex gap-2.5">
            {NAVBAR_REPORTS_ENGINES.map((engine) => (
              <span className={CLASSES.logoTile} key={engine}>
                <NavbarEngineLogo engine={engine} />
              </span>
            ))}
          </span>
        </NavbarBentoLinkTile>
      </div>
    </div>
  );
}
