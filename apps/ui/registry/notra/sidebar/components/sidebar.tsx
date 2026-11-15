"use client";

import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible";
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { PanelLeftCloseIcon, PanelLeftOpenIcon } from "lucide-react";
import * as React from "react";

import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

import { Button } from "../../button/components/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../../tooltip/components/tooltip";

const SIDEBAR_COOKIE_NAME = "sidebar_state";
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
const SIDEBAR_WIDTH = 256;
const SIDEBAR_MIN_WIDTH = 240;
const SIDEBAR_MAX_WIDTH = 400;
const SIDEBAR_WIDTH_MOBILE = "18rem";
const SIDEBAR_MOBILE_BREAKPOINT = 768;
const SIDEBAR_WIDTH_ICON = "3rem";
const SIDEBAR_KEYBOARD_SHORTCUT = "b";
const SIDEBAR_RESIZE_STEP = 8;
// A drag shorter than this is a click, past this it collapses or reopens.
const SIDEBAR_DRAG_SLOP = 4;
const SIDEBAR_SNAP_DISTANCE = 40;
const SIDEBAR_TRANSITION =
  "duration-(--sidebar-duration) ease-(--sidebar-ease) in-data-[resizing=true]:transition-none motion-reduce:transition-none";

type SidebarContextProps = {
  state: "expanded" | "collapsed";
  open: boolean;
  setOpen: (open: boolean) => void;
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  isMobile: boolean;
  toggleSidebar: () => void;
  width: number;
  setWidth: (width: number) => void;
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
  resizing: boolean;
  setResizing: (resizing: boolean) => void;
  contentRef: React.RefObject<HTMLDivElement | null>;
};

const SidebarContext = React.createContext<SidebarContextProps | null>(null);

function useSidebar() {
  const context = React.use(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.");
  }

  return context;
}

function SidebarProvider({
  defaultOpen = true,
  open: openProp,
  onOpenChange,
  defaultWidth = SIDEBAR_WIDTH,
  width: widthProp,
  onWidthChange,
  minWidth = SIDEBAR_MIN_WIDTH,
  maxWidth = SIDEBAR_MAX_WIDTH,
  keyboardShortcut = SIDEBAR_KEYBOARD_SHORTCUT,
  mobileBreakpoint = SIDEBAR_MOBILE_BREAKPOINT,
  className,
  style,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Expanded width in px. Drag the rail or use the arrow keys to resize. */
  defaultWidth?: number;
  width?: number;
  onWidthChange?: (width: number) => void;
  minWidth?: number;
  maxWidth?: number;
  /** Toggles the sidebar with ⌘ or Ctrl. Pass `null` to disable. */
  keyboardShortcut?: string | null;
  /**
   * Below this width in px the sidebar opens as a sheet. It is measured on the
   * provider rather than the viewport, so an embedded layout switches too.
   */
  mobileBreakpoint?: number;
}) {
  const [isMobile, setIsMobile] = React.useState(false);
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  React.useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) {
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      if (entry) {
        setIsMobile(entry.contentRect.width < mobileBreakpoint);
      }
    });
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [mobileBreakpoint]);
  const [openMobile, setOpenMobile] = React.useState(false);
  const [resizing, setResizing] = React.useState(false);
  const contentRef = React.useRef<HTMLDivElement | null>(null);

  const [openState, setOpenState] = React.useState(defaultOpen);
  const open = openProp ?? openState;
  const setOpen = React.useCallback(
    (value: boolean) => {
      if (onOpenChange) {
        onOpenChange(value);
      } else {
        setOpenState(value);
      }
      document.cookie = `${SIDEBAR_COOKIE_NAME}=${value}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
    },
    [onOpenChange]
  );

  const [widthState, setWidthState] = React.useState(defaultWidth);
  const width = widthProp ?? widthState;
  const setWidth = React.useCallback(
    (value: number) => {
      const next = Math.min(maxWidth, Math.max(minWidth, Math.round(value)));
      if (onWidthChange) {
        onWidthChange(next);
      } else {
        setWidthState(next);
      }
    },
    [maxWidth, minWidth, onWidthChange]
  );

  const toggleSidebar = React.useCallback(() => {
    if (isMobile) {
      setOpenMobile((value) => !value);
    } else {
      setOpen(!open);
    }
  }, [isMobile, open, setOpen]);

  const onShortcut = React.useEffectEvent(() => toggleSidebar());

  React.useEffect(() => {
    if (!keyboardShortcut) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === keyboardShortcut &&
        (event.metaKey || event.ctrlKey) &&
        !event.altKey &&
        !event.shiftKey
      ) {
        event.preventDefault();
        onShortcut();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [keyboardShortcut]);

  const state = open ? "expanded" : "collapsed";

  const contextValue = React.useMemo<SidebarContextProps>(
    () => ({
      state,
      open,
      setOpen,
      isMobile,
      openMobile,
      setOpenMobile,
      toggleSidebar,
      width,
      setWidth,
      defaultWidth,
      minWidth,
      maxWidth,
      resizing,
      setResizing,
      contentRef,
    }),
    [
      state,
      open,
      setOpen,
      isMobile,
      openMobile,
      toggleSidebar,
      width,
      setWidth,
      defaultWidth,
      minWidth,
      maxWidth,
      resizing,
    ]
  );

  return (
    <SidebarContext value={contextValue}>
      <div
        ref={wrapperRef}
        data-slot="sidebar-wrapper"
        data-resizing={resizing || undefined}
        style={
          {
            "--sidebar-width": `${width}px`,
            "--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
            "--sidebar-rail-content": "calc(var(--sidebar-width-icon) - 1rem)",
            "--sidebar-duration": "300ms",
            "--sidebar-ease": "cubic-bezier(0.22, 1, 0.36, 1)",
            ...style,
          } as React.CSSProperties
        }
        className={cn(
          "group/sidebar-wrapper has-data-[variant=inset]:bg-sidebar flex min-h-svh w-full min-w-0 data-resizing:cursor-col-resize data-resizing:select-none",
          className
        )}
        {...props}
      >
        {children}
      </div>
    </SidebarContext>
  );
}

function Sidebar({
  side = "left",
  variant = "sidebar",
  collapsible = "offcanvas",
  mobileTitle = "Sidebar",
  mobileDescription = "Displays the mobile sidebar.",
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  side?: "left" | "right";
  variant?: "sidebar" | "floating" | "inset";
  collapsible?: "offcanvas" | "icon" | "none";
  mobileTitle?: string;
  mobileDescription?: string;
}) {
  const { isMobile, state, openMobile, setOpenMobile } = useSidebar();

  if (collapsible === "none") {
    return (
      <div
        data-slot="sidebar"
        className={cn(
          "bg-sidebar text-sidebar-foreground flex h-full w-(--sidebar-width) flex-col",
          className
        )}
        {...props}
      >
        <TooltipProvider>{children}</TooltipProvider>
      </div>
    );
  }

  if (isMobile) {
    return (
      <Sheet open={openMobile} onOpenChange={setOpenMobile}>
        <SheetContent
          data-sidebar="sidebar"
          data-slot="sidebar"
          data-mobile="true"
          side={side}
          showCloseButton={false}
          style={
            { "--sidebar-width": SIDEBAR_WIDTH_MOBILE } as React.CSSProperties
          }
          className={cn(
            "bg-sidebar text-sidebar-foreground border-sidebar-border w-(--sidebar-width) gap-0 p-0",
            className
          )}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>{mobileTitle}</SheetTitle>
            <SheetDescription>{mobileDescription}</SheetDescription>
          </SheetHeader>
          <div className="flex h-full w-full flex-col">
            <TooltipProvider>{children}</TooltipProvider>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <div
      className="group peer text-sidebar-foreground block"
      data-state={state}
      data-collapsible={state === "collapsed" ? collapsible : ""}
      data-variant={variant}
      data-side={side}
      data-slot="sidebar"
    >
      <div
        data-slot="sidebar-gap"
        className={cn(
          "relative w-(--sidebar-width) bg-transparent transition-[width]",
          SIDEBAR_TRANSITION,
          "group-data-[collapsible=offcanvas]:w-0 group-data-[side=right]:rotate-180",
          variant === "floating" || variant === "inset"
            ? "group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4)))]"
            : "group-data-[collapsible=icon]:w-(--sidebar-width-icon)"
        )}
      />
      <div
        data-slot="sidebar-container"
        className={cn(
          "fixed inset-y-0 z-10 flex h-svh w-(--sidebar-width) transition-[left,right,width]",
          SIDEBAR_TRANSITION,
          side === "left"
            ? "left-0 group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]"
            : "right-0 group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]",
          variant === "floating" || variant === "inset"
            ? "p-2 [--sidebar-rail-content:calc(var(--sidebar-width-icon)-1rem+2px)] group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4))+2px)]"
            : "border-sidebar-border group-data-[collapsible=icon]:w-(--sidebar-width-icon) group-data-[side=left]:border-r group-data-[side=right]:border-l",
          className
        )}
        {...props}
      >
        <div
          data-sidebar="sidebar"
          data-slot="sidebar-inner"
          className="bg-sidebar group-data-[variant=floating]:ring-sidebar-border flex size-full flex-col group-data-[variant=floating]:rounded-xl group-data-[variant=floating]:shadow-sm group-data-[variant=floating]:ring-1"
        >
          <TooltipProvider>{children}</TooltipProvider>
        </div>
      </div>
    </div>
  );
}

function SidebarTrigger({
  className,
  onClick,
  ...props
}: React.ComponentProps<typeof Button>) {
  const { isMobile, open, openMobile, toggleSidebar } = useSidebar();
  const isOpen = isMobile ? openMobile : open;
  const Icon = isOpen ? PanelLeftCloseIcon : PanelLeftOpenIcon;

  return (
    <Button
      data-sidebar="trigger"
      data-slot="sidebar-trigger"
      variant="ghost"
      size="icon-sm"
      aria-expanded={isOpen}
      aria-label={isOpen ? "Hide sidebar" : "Show sidebar"}
      className={cn("text-muted-foreground hover:text-foreground", className)}
      onClick={(event) => {
        onClick?.(event);
        toggleSidebar();
      }}
      {...props}
    >
      <Icon />
    </Button>
  );
}

/**
 * The edge of the sidebar. Drag it to resize, drag it far enough past the
 * minimum to collapse, and double-click to restore the default width. Arrow
 * keys resize while it has focus. Pass `resizable={false}` for a plain toggle.
 */
function SidebarRail({
  resizable = true,
  className,
  ...props
}: React.ComponentProps<"button"> & { resizable?: boolean }) {
  const {
    state,
    setOpen,
    toggleSidebar,
    width,
    setWidth,
    defaultWidth,
    minWidth,
    maxWidth,
    setResizing,
  } = useSidebar();
  const dragRef = React.useRef<{ startX: number; startWidth: number } | null>(
    null
  );
  const collapsed = state === "collapsed";

  if (!resizable) {
    return (
      <button
        data-sidebar="rail"
        data-slot="sidebar-rail"
        aria-label="Toggle sidebar"
        tabIndex={-1}
        onClick={toggleSidebar}
        title="Toggle sidebar"
        className={cn(
          "hover:after:bg-sidebar-border absolute inset-y-0 z-20 flex w-4 -translate-x-1/2 cursor-pointer transition-all ease-linear group-data-[side=left]:-right-4 group-data-[side=right]:left-0 after:absolute after:inset-y-0 after:start-1/2 after:w-[2px]",
          className
        )}
        {...props}
      />
    );
  }

  const endDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current) {
      return;
    }
    dragRef.current = null;
    setResizing(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <button
      type="button"
      role="separator"
      data-sidebar="rail"
      data-slot="sidebar-rail"
      aria-label="Resize sidebar"
      aria-orientation="vertical"
      aria-valuemin={0}
      aria-valuemax={maxWidth}
      aria-valuenow={collapsed ? 0 : width}
      aria-valuetext={collapsed ? "Collapsed" : `${width} pixels`}
      title="Drag to resize, double-click to reset"
      className={cn(
        "hover:after:bg-sidebar-border focus-visible:after:bg-sidebar-ring in-data-resizing:after:bg-sidebar-ring absolute inset-y-0 z-20 flex w-4 -translate-x-1/2 cursor-col-resize touch-none outline-none group-data-[collapsible=icon]:cursor-e-resize group-data-[side=left]:-right-4 group-data-[side=right]:left-0 after:absolute after:inset-y-2 after:start-1/2 after:w-[2px] after:rounded-full after:transition-colors",
        "group-data-[collapsible=offcanvas]:hidden",
        className
      )}
      onPointerDown={(event) => {
        if (event.button !== 0) {
          return;
        }
        event.preventDefault();
        dragRef.current = { startX: event.clientX, startWidth: width };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const drag = dragRef.current;
        if (!drag) {
          return;
        }
        // Dragging away from the sidebar's edge always grows it.
        const delta = (event.clientX - drag.startX) * railDirection(event);
        if (Math.abs(delta) < SIDEBAR_DRAG_SLOP) {
          return;
        }
        if (collapsed) {
          if (delta >= SIDEBAR_SNAP_DISTANCE) {
            endDrag(event);
            setOpen(true);
          }
          return;
        }
        setResizing(true);
        const dragged = drag.startWidth + delta;
        setWidth(dragged);
        if (dragged < minWidth - SIDEBAR_SNAP_DISTANCE) {
          endDrag(event);
          setOpen(false);
        }
      }}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onLostPointerCapture={endDrag}
      onClick={(event) => {
        // Enter or Space on the focused rail toggles it.
        if (event.detail === 0) {
          toggleSidebar();
        }
      }}
      onDoubleClick={() => {
        setOpen(true);
        setWidth(defaultWidth);
      }}
      onKeyDown={(event) => {
        let next: number | undefined;
        const grow = railDirection(event) === 1 ? "ArrowRight" : "ArrowLeft";
        const shrink = grow === "ArrowRight" ? "ArrowLeft" : "ArrowRight";
        if (event.key === shrink) {
          if (collapsed) {
            return;
          }
          if (width <= minWidth) {
            event.preventDefault();
            setOpen(false);
            return;
          }
          next = width - SIDEBAR_RESIZE_STEP;
        } else if (event.key === grow) {
          next = collapsed ? width : width + SIDEBAR_RESIZE_STEP;
        } else if (event.key === "Home") {
          next = minWidth;
        } else if (event.key === "End") {
          next = maxWidth;
        }
        if (next === undefined) {
          return;
        }
        event.preventDefault();
        setOpen(true);
        setWidth(next);
      }}
      {...props}
    />
  );
}

/** 1 when the sidebar grows to the right (left side), -1 for a right-side one. */
function railDirection(event: React.SyntheticEvent<HTMLElement>) {
  return event.currentTarget
    .closest("[data-side]")
    ?.getAttribute("data-side") === "right"
    ? -1
    : 1;
}

function SidebarInset({ className, ...props }: React.ComponentProps<"main">) {
  return (
    <main
      data-slot="sidebar-inset"
      className={cn(
        "bg-background relative flex w-full min-w-0 flex-1 flex-col transition-[margin]",
        SIDEBAR_TRANSITION,
        // The peer only renders on desktop; the mobile sidebar is a sheet.
        "peer-data-[variant=inset]:border-sidebar-border peer-data-[variant=inset]:m-2 peer-data-[variant=inset]:ml-0 peer-data-[variant=inset]:rounded-xl peer-data-[variant=inset]:border peer-data-[variant=inset]:shadow-[0_1px_2px_rgba(0,0,0,0.04)] peer-data-[variant=inset]:peer-data-[state=collapsed]:ml-2 dark:peer-data-[variant=inset]:shadow-none",
        className
      )}
      {...props}
    />
  );
}

function SidebarInput({
  className,
  ...props
}: React.ComponentProps<typeof Input>) {
  return (
    <Input
      data-slot="sidebar-input"
      data-sidebar="input"
      className={cn("bg-background h-8 w-full shadow-none", className)}
      {...props}
    />
  );
}

/** Wheel events over the header and footer scroll the content between them. */
function useProxyWheel(onWheel?: React.WheelEventHandler<HTMLDivElement>) {
  const { contentRef } = useSidebar();

  return (event: React.WheelEvent<HTMLDivElement>) => {
    onWheel?.(event);
    const content = contentRef.current;
    if (!content || event.deltaY === 0 || event.defaultPrevented) {
      return;
    }
    content.scrollTop += event.deltaY;
  };
}

function SidebarHeader({
  className,
  onWheel,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-header"
      data-sidebar="header"
      className={cn("flex flex-col gap-2 overflow-x-hidden p-2", className)}
      onWheel={useProxyWheel(onWheel)}
      {...props}
    />
  );
}

function SidebarFooter({
  className,
  onWheel,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-footer"
      data-sidebar="footer"
      className={cn("flex flex-col gap-2 overflow-x-hidden p-2", className)}
      onWheel={useProxyWheel(onWheel)}
      {...props}
    />
  );
}

function SidebarSeparator({
  className,
  ...props
}: React.ComponentProps<typeof Separator>) {
  return (
    <Separator
      data-slot="sidebar-separator"
      data-sidebar="separator"
      className={cn("bg-sidebar-border mx-2 w-auto", className)}
      {...props}
    />
  );
}

function SidebarContent({
  className,
  ref,
  ...props
}: React.ComponentProps<"div">) {
  const { contentRef } = useSidebar();
  const composedRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      contentRef.current = node;
      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    },
    [contentRef, ref]
  );

  return (
    <div
      ref={composedRef}
      data-slot="sidebar-content"
      data-sidebar="content"
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-0 overflow-x-hidden overflow-y-auto overscroll-contain [scrollbar-width:none] group-data-[collapsible=icon]:overflow-hidden [&::-webkit-scrollbar]:hidden",
        className
      )}
      {...props}
    />
  );
}

function SidebarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-group"
      data-sidebar="group"
      className={cn("relative flex w-full min-w-0 flex-col p-2", className)}
      {...props}
    />
  );
}

function SidebarGroupLabel({
  className,
  render,
  ...props
}: useRender.ComponentProps<"div"> & React.ComponentProps<"div">) {
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        className: cn(
          "text-sidebar-foreground/60 ring-sidebar-ring flex h-8 shrink-0 items-center overflow-hidden rounded-md px-2 text-xs font-medium whitespace-nowrap outline-hidden transition-[margin,opacity] group-data-[collapsible=icon]:pointer-events-none group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0 focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
          SIDEBAR_TRANSITION,
          className
        ),
      },
      props
    ),
    render,
    state: { slot: "sidebar-group-label", sidebar: "group-label" },
  });
}

function SidebarGroupAction({
  className,
  render,
  ...props
}: useRender.ComponentProps<"button"> & React.ComponentProps<"button">) {
  return useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(
      {
        className: cn(
          "text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground absolute top-3.5 right-3 flex aspect-square w-5 items-center justify-center rounded-md p-0 outline-hidden transition-transform group-data-[collapsible=icon]:hidden after:absolute after:-inset-2 focus-visible:ring-2 md:after:hidden [&>svg]:size-4 [&>svg]:shrink-0",
          className
        ),
      },
      props
    ),
    render,
    state: { slot: "sidebar-group-action", sidebar: "group-action" },
  });
}

function SidebarGroupContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-group-content"
      data-sidebar="group-content"
      className={cn("w-full text-sm", className)}
      {...props}
    />
  );
}

function SidebarMenu({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="sidebar-menu"
      data-sidebar="menu"
      className={cn("flex w-full min-w-0 flex-col gap-0.5", className)}
      {...props}
    />
  );
}

function SidebarMenuItem({ className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="sidebar-menu-item"
      data-sidebar="menu-item"
      className={cn("group/menu-item relative", className)}
      {...props}
    />
  );
}

/**
 * Collapsing to the icon rail keeps the button's width animation intact: the
 * row clips to the rail and everything after the leading icon fades out.
 */
const sidebarMenuButtonVariants = cva(
  "peer/menu-button group/menu-button ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:bg-sidebar-accent data-active:bg-sidebar-accent data-active:text-foreground data-popup-open:bg-sidebar-accent flex w-full items-center gap-2 overflow-hidden rounded-lg p-2 text-left text-sm outline-hidden transition-[background-color,color] duration-75 group-has-data-[sidebar=menu-action]/menu-item:pr-8 focus-visible:ring-2 focus-visible:ring-inset disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-active:font-medium [&_svg]:size-4 [&_svg]:shrink-0 [&>*:not(:first-child)]:transition-opacity [&>*:not(:first-child)]:duration-150 [&>*:not(:first-child)]:ease-(--sidebar-ease) group-data-[collapsible=icon]:[&>*:not(:first-child)]:pointer-events-none group-data-[collapsible=icon]:[&>*:not(:first-child)]:opacity-0 [&>span:last-child]:truncate",
  {
    variants: {
      variant: {
        default: "",
        outline:
          "bg-background hover:bg-sidebar-accent shadow-[0_0_0_1px_var(--sidebar-border)] hover:shadow-[0_0_0_1px_var(--sidebar-accent)]",
      },
      size: {
        default: "h-8",
        sm: "h-7 text-xs",
        lg: "h-12 transition-[background-color,color,padding] group-data-[collapsible=icon]:p-0! group-data-[collapsible=icon]:pl-[calc((var(--sidebar-rail-content)-var(--sidebar-lg-icon,2rem))/2)]!",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function SidebarMenuButton({
  render,
  isActive = false,
  variant = "default",
  size = "default",
  tooltip,
  className,
  ...props
}: useRender.ComponentProps<"button"> &
  React.ComponentProps<"button"> & {
    isActive?: boolean;
    /** Shown beside the icon rail while the sidebar is collapsed. */
    tooltip?: string | React.ComponentProps<typeof TooltipContent>;
  } & VariantProps<typeof sidebarMenuButtonVariants>) {
  const { isMobile, state } = useSidebar();
  // The mobile sheet shows labels, and focusing its first row must not open
  // an empty tooltip.
  const withTooltip = Boolean(tooltip) && !isMobile;
  const button = useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(
      {
        className: cn(sidebarMenuButtonVariants({ variant, size }), className),
      },
      props
    ),
    render: withTooltip ? <TooltipTrigger render={render} /> : render,
    state: {
      slot: "sidebar-menu-button",
      sidebar: "menu-button",
      size,
      active: isActive,
    },
  });

  if (!(withTooltip && tooltip)) {
    return button;
  }

  const tooltipProps =
    typeof tooltip === "string" ? { children: tooltip } : tooltip;

  return (
    <Tooltip>
      {button}
      <TooltipContent
        side="right"
        align="center"
        sideOffset={8}
        hidden={state !== "collapsed"}
        {...tooltipProps}
      />
    </Tooltip>
  );
}

function SidebarMenuAction({
  className,
  render,
  showOnHover = false,
  ...props
}: useRender.ComponentProps<"button"> &
  React.ComponentProps<"button"> & {
    showOnHover?: boolean;
  }) {
  return useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(
      {
        className: cn(
          "text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground peer-hover/menu-button:text-sidebar-accent-foreground absolute top-1.5 right-1 flex aspect-square w-5 items-center justify-center rounded-md p-0 outline-hidden transition-transform group-data-[collapsible=icon]:hidden peer-data-[size=default]/menu-button:top-1.5 peer-data-[size=lg]/menu-button:top-3.5 peer-data-[size=sm]/menu-button:top-1 after:absolute after:-inset-2 focus-visible:ring-2 md:after:hidden [&>svg]:size-4 [&>svg]:shrink-0",
          showOnHover &&
            "peer-data-active/menu-button:text-sidebar-accent-foreground group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 data-popup-open:opacity-100 md:opacity-0",
          className
        ),
      },
      props
    ),
    render,
    state: { slot: "sidebar-menu-action", sidebar: "menu-action" },
  });
}

function SidebarMenuBadge({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-menu-badge"
      data-sidebar="menu-badge"
      className={cn(
        "text-muted-foreground peer-hover/menu-button:text-sidebar-accent-foreground pointer-events-none absolute right-1.5 flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-xs font-medium tabular-nums select-none group-data-[collapsible=icon]:hidden peer-data-[size=default]/menu-button:top-1.5 peer-data-[size=lg]/menu-button:top-3.5 peer-data-[size=sm]/menu-button:top-1",
        className
      )}
      {...props}
    />
  );
}

function SidebarMenuSkeleton({
  className,
  showIcon = false,
  width = "70%",
  ...props
}: React.ComponentProps<"div"> & {
  showIcon?: boolean;
  width?: string;
}) {
  return (
    <div
      data-slot="sidebar-menu-skeleton"
      data-sidebar="menu-skeleton"
      className={cn("flex h-8 items-center gap-2 rounded-lg px-2", className)}
      {...props}
    >
      {showIcon && (
        <Skeleton
          className="size-4 rounded-md"
          data-sidebar="menu-skeleton-icon"
        />
      )}
      <Skeleton
        className="h-4 max-w-(--skeleton-width) flex-1"
        data-sidebar="menu-skeleton-text"
        style={{ "--skeleton-width": width } as React.CSSProperties}
      />
    </div>
  );
}

/** A menu item that can reveal sub-rows, built on the Base UI Collapsible. */
function SidebarMenuCollapsible({
  className,
  ...props
}: CollapsiblePrimitive.Root.Props) {
  return (
    <CollapsiblePrimitive.Root
      data-slot="sidebar-menu-item"
      data-sidebar="menu-item"
      render={<li />}
      className={cn("group/menu-item relative", className)}
      {...props}
    />
  );
}

/**
 * Animates the sub-rows open and closed, and folds them away while the sidebar
 * is collapsed to the icon rail so the rows never show beside an icon.
 */
function SidebarMenuSubPanel({
  className,
  children,
  ...props
}: CollapsiblePrimitive.Panel.Props) {
  return (
    <CollapsiblePrimitive.Panel
      data-slot="sidebar-menu-sub-panel"
      className={cn(
        "h-(--collapsible-panel-height) overflow-hidden transition-[height,opacity] duration-200 ease-(--sidebar-ease) data-ending-style:h-0 data-ending-style:opacity-0 data-starting-style:h-0 data-starting-style:opacity-0 motion-reduce:transition-none",
        className
      )}
      {...props}
    >
      <div
        className={cn(
          "grid grid-rows-[1fr] transition-[grid-template-rows,opacity] group-data-[collapsible=icon]:grid-rows-[0fr] group-data-[collapsible=icon]:opacity-0",
          SIDEBAR_TRANSITION
        )}
      >
        <div className="min-h-0 overflow-hidden">
          {children as React.ReactNode}
        </div>
      </div>
    </CollapsiblePrimitive.Panel>
  );
}

function SidebarMenuSub({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="sidebar-menu-sub"
      data-sidebar="menu-sub"
      className={cn(
        "border-sidebar-border mx-3.5 flex min-w-0 translate-x-px flex-col gap-0.5 border-l px-2.5 py-0.5",
        className
      )}
      {...props}
    />
  );
}

function SidebarMenuSubItem({
  className,
  ...props
}: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="sidebar-menu-sub-item"
      data-sidebar="menu-sub-item"
      className={cn("group/menu-sub-item relative", className)}
      {...props}
    />
  );
}

function SidebarMenuSubButton({
  render,
  size = "md",
  isActive = false,
  className,
  ...props
}: useRender.ComponentProps<"a"> &
  React.ComponentProps<"a"> & {
    size?: "sm" | "md";
    isActive?: boolean;
  }) {
  return useRender({
    defaultTagName: "a",
    props: mergeProps<"a">(
      {
        className: cn(
          "text-sidebar-foreground/80 ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:bg-sidebar-accent data-active:bg-sidebar-accent data-active:text-foreground flex h-7 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-md px-2 outline-hidden transition-colors duration-75 focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-active:font-medium data-[size=md]:text-sm data-[size=sm]:text-xs [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0",
          className
        ),
      },
      props
    ),
    render,
    state: {
      slot: "sidebar-menu-sub-button",
      sidebar: "menu-sub-button",
      size,
      active: isActive,
    },
  });
}

/**
 * A label that fades out instead of disappearing when the sidebar collapses.
 * Use it for text nested deeper than a direct child of a menu button.
 */
function SidebarLabel({ className, children }: React.ComponentProps<"span">) {
  return (
    <span className={cn("min-w-0 whitespace-nowrap", className)}>
      <span
        data-slot="sidebar-label"
        className="block truncate transition-[opacity,translate] duration-150 ease-(--sidebar-ease) group-data-[collapsible=icon]:translate-x-0.5 group-data-[collapsible=icon]:opacity-0 motion-reduce:transition-none"
      >
        {children}
      </span>
    </span>
  );
}

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuCollapsible,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarMenuSubPanel,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  sidebarMenuButtonVariants,
  useSidebar,
};
