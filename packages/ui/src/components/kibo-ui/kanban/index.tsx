"use client";


import type {
  Announcements,
  DndContextProps,
  DragCancelEvent,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  UniqueIdentifier,
} from "@dnd-kit/core";
import {
  closestCenter,
  type CollisionDetection,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  pointerWithin,
  rectIntersection,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  createContext,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import tunnel from "tunnel-rat";

import { Card } from "@notra/ui/components/ui/card";
import { cn } from "@notra/ui/lib/utils";

const t = tunnel();

const POINTER_ACTIVATION_DISTANCE = 6;
const TOUCH_ACTIVATION_DELAY_MS = 150;
const TOUCH_ACTIVATION_TOLERANCE = 8;

const KEYBOARD_CODES = {
  start: ["Space"],
  cancel: ["Escape"],
  end: ["Space", "Tab"],
};

const EMPTY_DROP_DISABLED_COLUMN_IDS: ReadonlySet<string> = new Set<string>();

const columnCollision: CollisionDetection = (args) => {
  const withinPointer = pointerWithin(args);
  if (withinPointer.length > 0) {
    return withinPointer;
  }
  const intersecting = rectIntersection(args);
  if (intersecting.length > 0) {
    return intersecting;
  }
  return closestCenter(args);
};

export type { DragEndEvent } from "@dnd-kit/core";

export type KanbanItemProps = {
  id: string;
  name: string;
  column: string;
} & Record<string, unknown>;

export type KanbanColumnProps = {
  id: string;
  name: string;
} & Record<string, unknown>;

/** A drag end event enriched with the destination the provider actually accepted. */
export type KanbanDragEndEvent = DragEndEvent & {
  /** Resolved destination column, or `null` when the drop was rejected and reverted. */
  targetColumnId: string | null;
};

export type KanbanContextProps<
  T extends KanbanItemProps = KanbanItemProps,
  C extends KanbanColumnProps = KanbanColumnProps,
> = {
  columns: C[];
  data: T[];
  dropDisabledColumnIds: ReadonlySet<string>;
};

const KanbanContext = createContext<KanbanContextProps>({
  columns: [],
  data: [],
  dropDisabledColumnIds: EMPTY_DROP_DISABLED_COLUMN_IDS,
});

const KanbanActiveCardContext = createContext<string | null>(null);

export type KanbanBoardProps = {
  id: string;
  children: ReactNode;
  className?: string;
};

export const KanbanBoard = ({ id, children, className }: KanbanBoardProps) => {
  const { dropDisabledColumnIds } = useContext(KanbanContext);
  const dropDisabled = dropDisabledColumnIds.has(id);
  const { isOver, setNodeRef } = useDroppable({ id });
  const rejectsDrop = isOver && dropDisabled;

  return (
    <div
      className={cn(
        "bg-secondary flex size-full min-h-40 flex-col divide-y overflow-hidden rounded-md border text-xs shadow-sm ring-2 transition-all",
        isOver && !dropDisabled && "ring-primary",
        rejectsDrop && "ring-muted-foreground/40",
        !isOver && "ring-transparent",
        className
      )}
      ref={setNodeRef}
    >
      {children}
    </div>
  );
};

export type KanbanCardProps<T extends KanbanItemProps = KanbanItemProps> = T & {
  children?: ReactNode;
  className?: string;
  /** Locks dragging, e.g. while the row this card represents is being saved. */
  disabled?: boolean;
  /** Called on click or `Enter` when the card is not being dragged. */
  onActivate?: () => void;
};

export const KanbanCard = <T extends KanbanItemProps = KanbanItemProps>({
  id,
  name,
  children,
  className,
  disabled = false,
  onActivate,
}: KanbanCardProps<T>) => {
  const activeCardId = useContext(KanbanActiveCardContext);
  const sortableDisabled = useMemo(
    () => ({ draggable: disabled, droppable: true }),
    [disabled]
  );
  const {
    attributes,
    listeners,
    setNodeRef,
    transition,
    transform,
    isDragging,
  } = useSortable({ id, disabled: sortableDisabled });

  const style = {
    transition,
    transform: CSS.Translate.toString(transform),
  };

  // dnd-kit swallows the `click` that follows a pointer drag (it registers a
  // capture phase document listener once the activation constraint is met), so a
  // click only reaches us when no drag happened. The `isDragging` guard covers
  // keyboard drags, where no pointer event is involved at all.
  const activate = () => {
    if (isDragging) {
      return;
    }
    onActivate?.();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    listeners?.onKeyDown?.(event);
    if (event.defaultPrevented || event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    activate();
  };

  return (
    <>
      {/* react-doctor-disable-next-line react-doctor/no-static-element-interactions -- dnd-kit attributes provide button semantics */}
      <div
        className={cn(
          // `touch-manipulation` rather than `touch-none`: the touch sensor
          // activates on a delay, so vertical scrolling by dragging a card has
          // to keep working.
          "group/kanban-card touch-manipulation select-none outline-none",
          disabled
            ? "cursor-default"
            : "cursor-grab active:cursor-grabbing data-[dragging=true]:cursor-grabbing"
        )}
        data-dragging={isDragging}
        style={style}
        {...listeners}
        {...attributes}
        onClick={activate}
        onKeyDown={handleKeyDown}
        ref={setNodeRef}
      >
        <Card
          className={cn(
            "group-focus-visible/kanban-card:ring-ring cursor-[inherit] gap-4 rounded-md p-3 shadow-sm group-focus-visible/kanban-card:ring-2",
            isDragging && "pointer-events-none opacity-30",
            className
          )}
        >
          {children ?? <p className="m-0 text-sm font-medium">{name}</p>}
        </Card>
      </div>
      {activeCardId === id && (
        <t.In>
          <Card
            className={cn(
              "ring-primary cursor-grabbing gap-4 rounded-md p-3 shadow-sm ring-2",
              className
            )}
          >
            {children ?? <p className="m-0 text-sm font-medium">{name}</p>}
          </Card>
        </t.In>
      )}
    </>
  );
};

export type KanbanCardsProps<T extends KanbanItemProps = KanbanItemProps> =
  Omit<HTMLAttributes<HTMLDivElement>, "children" | "id"> & {
    children: (item: T) => ReactNode;
    id: string;
  };

export const KanbanCards = <T extends KanbanItemProps = KanbanItemProps>({
  children,
  className,
  ...props
}: KanbanCardsProps<T>) => {
  const { data } = useContext(KanbanContext) as KanbanContextProps<T>;
  const filteredData = data.filter((item) => item.column === props.id);
  const items = filteredData.map((item) => item.id);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SortableContext items={items}>
        <div
          className={cn("flex flex-grow flex-col gap-2 p-2", className)}
          {...props}
        >
          {filteredData.map(children)}
        </div>
      </SortableContext>
    </div>
  );
};

export type KanbanHeaderProps = HTMLAttributes<HTMLDivElement>;

export const KanbanHeader = ({ className, ...props }: KanbanHeaderProps) => (
  <div className={cn("m-0 p-2 text-sm font-semibold", className)} {...props} />
);

export type KanbanProviderProps<
  T extends KanbanItemProps = KanbanItemProps,
  C extends KanbanColumnProps = KanbanColumnProps,
> = Omit<
  DndContextProps,
  "children" | "onDragCancel" | "onDragEnd" | "onDragOver" | "onDragStart"
> & {
  children: (column: C) => ReactNode;
  className?: string;
  columns: C[];
  data: T[];
  /** Columns that render as targets but never accept a card. */
  dropDisabledColumnIds?: readonly string[];
  onDataChange?: (data: T[]) => void;
  onDragStart?: (event: DragStartEvent) => void;
  onDragEnd?: (event: KanbanDragEndEvent) => void;
  onDragOver?: (event: DragOverEvent) => void;
  onDragCancel?: (event: DragCancelEvent) => void;
};

export const KanbanProvider = <
  T extends KanbanItemProps = KanbanItemProps,
  C extends KanbanColumnProps = KanbanColumnProps,
>({
  children,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragCancel,
  className,
  columns,
  data,
  dropDisabledColumnIds,
  onDataChange,
  ...props
}: KanbanProviderProps<T, C>) => {
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const snapshotRef = useRef<T[] | null>(null);

  const dropDisabled = useMemo(
    () =>
      dropDisabledColumnIds
        ? new Set(dropDisabledColumnIds)
        : EMPTY_DROP_DISABLED_COLUMN_IDS,
    [dropDisabledColumnIds]
  );

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: POINTER_ACTIVATION_DISTANCE },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: TOUCH_ACTIVATION_DELAY_MS,
        tolerance: TOUCH_ACTIVATION_TOLERANCE,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: KEYBOARD_CODES,
    })
  );

  const columnIdFor = (overId: UniqueIdentifier | undefined): string | null => {
    if (overId === undefined) {
      return null;
    }
    const id = String(overId);
    const overItem = data.find((item) => item.id === id);
    if (overItem) {
      return overItem.column;
    }
    return columns.find((entry) => entry.id === id)?.id ?? null;
  };

  const columnNameFor = (columnId: string | null): string =>
    columns.find((entry) => entry.id === columnId)?.name ?? "unknown";

  const cardNameFor = (cardId: UniqueIdentifier): string =>
    data.find((item) => item.id === cardId)?.name ?? "card";

  const moveTo = (cardId: string, columnId: string) => {
    onDataChange?.(
      data.map((item) =>
        item.id === cardId ? { ...item, column: columnId } : item
      )
    );
  };

  const takeSnapshot = () => {
    const snapshot = snapshotRef.current;
    snapshotRef.current = null;
    return snapshot;
  };

  const handleDragStart = (event: DragStartEvent) => {
    const cardId = String(event.active.id);
    if (data.some((item) => item.id === cardId)) {
      setActiveCardId(cardId);
      snapshotRef.current = data;
    }
    onDragStart?.(event);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    const activeItem = data.find((item) => item.id === active.id);
    const overColumn = over ? columnIdFor(over.id) : null;

    if (
      activeItem &&
      overColumn &&
      overColumn !== activeItem.column &&
      !dropDisabled.has(overColumn)
    ) {
      moveTo(activeItem.id, overColumn);
    }

    onDragOver?.(event);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveCardId(null);
    const snapshot = takeSnapshot();

    const cardId = String(event.active.id);
    const overColumn = columnIdFor(event.over?.id);
    const accepted = overColumn !== null && !dropDisabled.has(overColumn);

    if (accepted) {
      const activeItem = data.find((item) => item.id === cardId);
      if (activeItem && activeItem.column !== overColumn) {
        moveTo(cardId, overColumn);
      }
    } else if (snapshot) {
      onDataChange?.(snapshot);
    }

    onDragEnd?.({ ...event, targetColumnId: accepted ? overColumn : null });
  };

  const handleDragCancel = (event: DragCancelEvent) => {
    setActiveCardId(null);
    const snapshot = takeSnapshot();
    if (snapshot) {
      onDataChange?.(snapshot);
    }
    onDragCancel?.(event);
  };

  const announcements: Announcements = {
    onDragStart({ active }) {
      const item = data.find((entry) => entry.id === active.id);
      return `Picked up the card "${cardNameFor(active.id)}" from the "${columnNameFor(item?.column ?? null)}" column.`;
    },
    onDragOver({ active, over }) {
      const name = cardNameFor(active.id);
      const overColumn = columnIdFor(over?.id);
      if (overColumn === null) {
        return `The card "${name}" is not over a column.`;
      }
      if (dropDisabled.has(overColumn)) {
        return `The card "${name}" cannot be dropped into the "${columnNameFor(overColumn)}" column.`;
      }
      return `Dragged the card "${name}" over the "${columnNameFor(overColumn)}" column.`;
    },
    onDragEnd({ active, over }) {
      const name = cardNameFor(active.id);
      const overColumn = columnIdFor(over?.id);
      if (overColumn === null) {
        return `The card "${name}" was dropped outside of the board and returned to its column.`;
      }
      if (dropDisabled.has(overColumn)) {
        return `The card "${name}" cannot be dropped into the "${columnNameFor(overColumn)}" column and returned to its column.`;
      }
      return `Dropped the card "${name}" into the "${columnNameFor(overColumn)}" column.`;
    },
    onDragCancel({ active }) {
      return `Cancelled dragging the card "${cardNameFor(active.id)}". It returned to its column.`;
    },
  };

  const contextValue = useMemo(
    () => ({ columns, data, dropDisabledColumnIds: dropDisabled }),
    [columns, data, dropDisabled]
  );

  return (
    <KanbanContext.Provider value={contextValue}>
      <KanbanActiveCardContext.Provider value={activeCardId}>
        <DndContext
          accessibility={{ announcements }}
          collisionDetection={columnCollision}
          onDragCancel={handleDragCancel}
          onDragEnd={handleDragEnd}
          onDragOver={handleDragOver}
          onDragStart={handleDragStart}
          sensors={sensors}
          {...props}
        >
          <div
            className={cn(
              "grid size-full auto-cols-fr grid-flow-col gap-4",
              className
            )}
          >
            {columns.map((column) => children(column))}
          </div>
          {typeof window !== "undefined" &&
            createPortal(
              <DragOverlay dropAnimation={null}>
                <t.Out />
              </DragOverlay>,
              document.body
            )}
        </DndContext>
      </KanbanActiveCardContext.Provider>
    </KanbanContext.Provider>
  );
};
