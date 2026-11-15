import { useSyncExternalStore } from "react";

import { getTrafficLayoutFromClient } from "@/utils/cookies";

import { GeoTrafficSkeleton } from "./skeleton";

const subscribeToNothing = () => () => {};

export default function Loading() {
  // The server snapshot is null so hydration matches; the cookie applies right after.
  const layout = useSyncExternalStore(
    subscribeToNothing,
    getTrafficLayoutFromClient,
    () => null
  );
  return <GeoTrafficSkeleton layout={layout} />;
}
