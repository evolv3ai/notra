"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

import type { HeaderActionsPortalProps } from "@/types/components/header-actions-portal";

let outlet: HTMLDivElement | null = null;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getOutlet = () => outlet;

const getServerOutlet = () => null;

const setOutlet = (node: HTMLDivElement | null) => {
  if (outlet === node) {
    return;
  }
  outlet = node;
  for (const listener of listeners) {
    listener();
  }
};

export function HeaderActionsOutlet() {
  return (
    <div
      className="flex min-w-0 shrink-0 items-center gap-1 empty:hidden"
      ref={(node) => {
        setOutlet(node);
        return () => {
          if (outlet === node) {
            setOutlet(null);
          }
        };
      }}
    />
  );
}

export function HeaderActionsPortal({ children }: HeaderActionsPortalProps) {
  const target = useSyncExternalStore(subscribe, getOutlet, getServerOutlet);

  if (!target) {
    return null;
  }

  return createPortal(children, target);
}
