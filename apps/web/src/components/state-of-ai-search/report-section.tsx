import { InstrumentSection } from "@notra/ui/components/instrument/instrument-module";
import { TABLE_BODY_CLASS, TABLE_FRAME_CLASS } from "@notra/ui/constants/table";
import { cn } from "@notra/ui/lib/utils";
import type { ReactNode } from "react";

export function ReportBlock({
  title,
  description,
  readout,
  className,
  children,
}: {
  title: string;
  description?: ReactNode;
  readout?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <InstrumentSection
      className={className}
      description={description}
      eyebrow={title}
      readout={readout}
    >
      {children}
    </InstrumentSection>
  );
}

export function ReportPanel({
  header,
  footer,
  className,
  bodyClassName,
  children,
}: {
  header?: ReactNode;
  footer?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn(TABLE_FRAME_CLASS, "flex min-w-0 flex-col", className)}>
      {header ? (
        <div className="text-muted-foreground flex h-10 shrink-0 items-center gap-2 px-4 text-sm font-medium">
          {header}
        </div>
      ) : null}
      <div className={cn(TABLE_BODY_CLASS, "flex-1", bodyClassName)}>
        {children}
      </div>
      {footer ? <div className="shrink-0">{footer}</div> : null}
    </div>
  );
}

interface ReportPairSide {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}

function ReportHeading({
  title,
  description,
  className,
}: Omit<ReportPairSide, "children"> & { className?: string }) {
  return (
    <div className={cn("min-w-0 space-y-1", className)}>
      <h2 className="text-foreground text-sm font-medium">{title}</h2>
      {description ? (
        <p className="text-muted-foreground text-sm">{description}</p>
      ) : null}
    </div>
  );
}

export function ReportPair({
  left,
  right,
}: {
  left: ReportPairSide;
  right: ReportPairSide;
}) {
  return (
    <div className="grid gap-x-6 gap-y-3 lg:grid-cols-2 lg:grid-rows-[auto_1fr]">
      <ReportHeading
        className="lg:col-start-1 lg:row-start-1"
        description={left.description}
        title={left.title}
      />
      <div className="flex min-w-0 flex-col lg:col-start-1 lg:row-start-2">
        {left.children}
      </div>
      <ReportHeading
        className="max-lg:mt-9 lg:col-start-2 lg:row-start-1"
        description={right.description}
        title={right.title}
      />
      <div className="flex min-w-0 flex-col lg:col-start-2 lg:row-start-2">
        {right.children}
      </div>
    </div>
  );
}
