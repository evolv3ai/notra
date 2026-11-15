import { useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  HORIZONTAL_OVERFLOW_TOLERANCE_PX,
  INFINITE_TABLE_END_THRESHOLD_ROWS,
} from "../constants/data-table";
import {
  getTableScrollbarHeight,
  getTableViewportLayout,
} from "../lib/data-table";
import type { UseTableViewportOptions } from "../types/data-table";

export function useTableViewport<T>({
  rows,
  rowHeight,
  headerHeight,
  rowSizing,
  height,
  minHeight,
  autoHeight,
  overscan,
  loading,
  onEndReached,
}: UseTableViewportOptions<T>) {
  "use no memo";
  const scrollRef = useRef<HTMLDivElement>(null);
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const endReachedRef = useRef(false);
  const [horizontalScrollbarHeight, setHorizontalScrollbarHeight] = useState(0);
  const [overflowsX, setOverflowsX] = useState(false);

  const virtualizer = useVirtualizer({
    enabled: rowSizing === "fixed",
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    initialRect: { height, width: 0 },
    overscan,
  });
  const layout = getTableViewportLayout({
    rowCount: rows.length,
    rowHeight,
    headerHeight,
    rowSizing,
    height,
    minHeight,
    autoHeight,
    horizontalScrollbarHeight,
  });
  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();
  const paddingTop = virtualItems[0]?.start ?? 0;
  const lastVirtualItem = virtualItems.at(-1);
  const paddingBottom = lastVirtualItem ? totalSize - lastVirtualItem.end : 0;
  const renderedRows = layout.scrolls
    ? virtualItems.flatMap((item) => {
        const entry = rows[item.index];
        return entry ? [{ entry, index: item.index }] : [];
      })
    : rows.map((entry, index) => ({ entry, index }));

  useEffect(() => {
    if (!loading) {
      endReachedRef.current = false;
    }
  }, [loading]);

  useEffect(() => {
    endReachedRef.current = false;
  }, [rows.length]);

  const [atEnd, setAtEnd] = useState(true);
  const [atStart, setAtStart] = useState(true);

  const requestMoreIfNearEnd = useCallback(
    (element: HTMLDivElement) => {
      if (!onEndReached || loading || endReachedRef.current) {
        return;
      }
      if (
        element.scrollHeight - element.scrollTop - element.clientHeight <
        rowHeight * INFINITE_TABLE_END_THRESHOLD_ROWS
      ) {
        endReachedRef.current = true;
        onEndReached();
      }
    },
    [onEndReached, loading, rowHeight]
  );

  const handleScroll = useCallback(() => {
    const element = scrollRef.current;
    if (!element) {
      return;
    }
    if (headerScrollRef.current) {
      headerScrollRef.current.scrollLeft = element.scrollLeft;
    }
    setAtEnd(
      element.scrollTop + element.clientHeight + 1 >= element.scrollHeight
    );
    setAtStart(element.scrollTop <= 1);
    requestMoreIfNearEnd(element);
  }, [requestMoreIfNearEnd]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) {
      return;
    }
    const measure = () => {
      setAtEnd(
        element.scrollTop + element.clientHeight + 1 >= element.scrollHeight
      );
      setAtStart(element.scrollTop <= 1);
      requestMoreIfNearEnd(element);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [rows.length, requestMoreIfNearEnd]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) {
      return;
    }
    const measure = () => {
      const styles = getComputedStyle(element);
      setHorizontalScrollbarHeight(
        getTableScrollbarHeight(
          element.offsetHeight,
          element.clientHeight,
          styles.borderTopWidth,
          styles.borderBottomWidth
        )
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const element = scrollRef.current;
    const table = element?.querySelector("table");
    if (!(element && table)) {
      return;
    }
    const measure = () => {
      setOverflowsX(
        element.scrollWidth - element.clientWidth >
          HORIZONTAL_OVERFLOW_TOLERANCE_PX
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    observer.observe(table);
    return () => observer.disconnect();
  }, []);

  return {
    ...layout,
    overflowClass: overflowsX
      ? layout.overflowClass
      : layout.overflowClass
          .replace("overflow-x-auto", "overflow-x-hidden")
          .replace("overflow-auto", "overflow-x-hidden overflow-y-auto"),
    scrollRef,
    headerScrollRef,
    handleScroll,
    renderedRows,
    paddingTop,
    paddingBottom,
    atEnd,
    atStart,
    overflowsX,
  };
}
