"use client";

import { GeoPromptAnswerSkeleton } from "@/components/geo/geo-prompt-answer-skeleton";
import type { GeoPromptAnswerThreadProps } from "@/types/geo";
import dynamic from "@/utils/lazy-component";
import {
  loadGeoPromptAnswerThread,
  renderLoadedGeoPromptAnswerThread,
} from "@/utils/prompt-answer-thread-chunk";

const SuspendingGeoPromptAnswerThread = dynamic(
  () =>
    loadGeoPromptAnswerThread().then((module) => module.GeoPromptAnswerThread),
  {
    ssr: false,
    loading: () => <GeoPromptAnswerSkeleton view="raw" />,
  }
);

export function LazyGeoPromptAnswerThread(props: GeoPromptAnswerThreadProps) {
  return (
    renderLoadedGeoPromptAnswerThread(props) ?? (
      <SuspendingGeoPromptAnswerThread {...props} />
    )
  );
}
