import {
  DITHER_FINE_POINTER_QUERY,
  DITHER_INTERACTION_EVENTS,
  DITHER_MOBILE_QUERY,
} from "@/constants/dithering";

export function subscribeToDitherViewport(onChange: () => void) {
  const query = window.matchMedia(DITHER_MOBILE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function getDitherMobileSnapshot() {
  return window.matchMedia(DITHER_MOBILE_QUERY).matches;
}

export function subscribeToFinePointer(onChange: () => void) {
  const query = window.matchMedia(DITHER_FINE_POINTER_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function getFinePointerSnapshot() {
  return window.matchMedia(DITHER_FINE_POINTER_QUERY).matches;
}

let hasUserInteracted = false;

export function subscribeToFirstInteraction(onChange: () => void) {
  if (hasUserInteracted) {
    return () => {};
  }
  const stop = () => {
    for (const event of DITHER_INTERACTION_EVENTS) {
      window.removeEventListener(event, handle);
    }
  };
  const handle = () => {
    hasUserInteracted = true;
    stop();
    onChange();
  };
  for (const event of DITHER_INTERACTION_EVENTS) {
    window.addEventListener(event, handle, { passive: true });
  }
  return stop;
}

export function getFirstInteractionSnapshot() {
  return hasUserInteracted;
}

export function subscribeToPageVisibility(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

export function getPageVisibleSnapshot() {
  return document.visibilityState === "visible";
}

export function getDitherEnvironmentServerSnapshot() {
  return false;
}

export function getDitherMobileServerSnapshot() {
  return true;
}
