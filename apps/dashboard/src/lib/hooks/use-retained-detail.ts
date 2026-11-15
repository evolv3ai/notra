"use client";

import { useState } from "react";

export function useRetainedDetail<T>(value: T | null) {
  const [retained, setRetained] = useState(value);
  if (value !== null && value !== retained) {
    setRetained(value);
  }
  return value ?? retained;
}
