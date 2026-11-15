"use client";

import { FileExportIcon, UnfoldMoreIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { GEO_FILTER_TRIGGER_CLASS } from "@notra/geo-core/constants/geo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@notra/ui/components/ui/dropdown-menu";
import { useState } from "react";
import { useTranslations } from "use-intl";

import { TrafficEmbedDialog } from "@/components/geo/traffic-embed-dialog";
import type { TrafficExportMenuProps } from "@/types/geo";
import { downloadTrafficCsv } from "@/utils/traffic-export";

/** CSV download and the embed dialog, kept behind one trigger. */
export function TrafficExportMenu({
  organizationId,
  traffic,
  web,
  range,
  path,
}: TrafficExportMenuProps) {
  const t = useTranslations("geo.trafficExport");
  const [embedOpen, setEmbedOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<button className={GEO_FILTER_TRIGGER_CLASS} type="button" />}
        >
          <HugeiconsIcon
            className="text-muted-foreground"
            icon={FileExportIcon}
            size={12}
          />
          {t("menu")}
          <HugeiconsIcon
            className="text-muted-foreground"
            icon={UnfoldMoreIcon}
            size={12}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem
            disabled={!(traffic && web)}
            onClick={() => {
              if (traffic && web) {
                downloadTrafficCsv(traffic, web, range, path);
              }
            }}
          >
            {t("csv")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setEmbedOpen(true)}>
            {t("embed")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <TrafficEmbedDialog
        onOpenChange={setEmbedOpen}
        open={embedOpen}
        organizationId={organizationId}
      />
    </>
  );
}
