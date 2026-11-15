"use client";

import { useSyncExternalStore } from "react";

import { useIsSavingSocialVideo } from "@/lib/hooks/use-content";

const uploadCounts = new Map<string, number>();
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Marks a video upload of this post as running; call the result when it ends. */
export function trackSocialVideoUpload(contentId: string) {
  uploadCounts.set(contentId, (uploadCounts.get(contentId) ?? 0) + 1);
  emit();
  return () => {
    const next = (uploadCounts.get(contentId) ?? 1) - 1;
    if (next > 0) {
      uploadCounts.set(contentId, next);
    } else {
      uploadCounts.delete(contentId);
    }
    emit();
  };
}

/** True while this post's video is uploading or being saved, from any dialog. */
export function useSocialVideoPending(
  organizationId: string,
  contentId: string
) {
  const uploading = useSyncExternalStore(
    subscribe,
    () => (uploadCounts.get(contentId) ?? 0) > 0,
    () => false
  );
  const saving = useIsSavingSocialVideo(organizationId, contentId);
  return uploading || saving;
}
