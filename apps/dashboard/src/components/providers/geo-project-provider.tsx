"use client";

import { GEO_TRAFFIC_HOST_PARAM } from "@notra/geo-core/constants/geo";
import { trafficLogHostFilter } from "@notra/geo-core/utils/geo-project-domains";
import { parseAsString, useQueryState } from "nuqs";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useGeoProjectQueryState } from "@/lib/hooks/use-geo-project-query";
import type {
  GeoProjectContextValue,
  GeoProjectProviderProps,
  GeoProjectQueryProviderProps,
} from "@/types/geo";
import { normalizeGeoProjectId } from "@/utils/geo-hydration";

function ignoreTrafficHost(_value: string): void {}

const GeoProjectContext = createContext<GeoProjectContextValue>({
  projectId: undefined,
  trafficHost: "",
  setTrafficHost: ignoreTrafficHost,
});

export function GeoProjectProvider({
  projectId,
  children,
  trafficHost = "",
  setTrafficHost = ignoreTrafficHost,
}: GeoProjectProviderProps) {
  const value = useMemo(
    () => ({ projectId, trafficHost, setTrafficHost }),
    [projectId, setTrafficHost, trafficHost]
  );
  return (
    <GeoProjectContext.Provider key={projectId ?? ""} value={value}>
      {children}
    </GeoProjectContext.Provider>
  );
}

export function GeoProjectQueryProvider({
  initialProjectId,
  children,
}: GeoProjectQueryProviderProps) {
  const [projectParam] = useGeoProjectQueryState();
  const urlProjectId = normalizeGeoProjectId(projectParam);
  const projectId = urlProjectId ?? initialProjectId;
  const [hostQuery, setHostQuery] = useQueryState(
    GEO_TRAFFIC_HOST_PARAM,
    parseAsString.withDefault("").withOptions({ clearOnDefault: true })
  );
  const setTrafficHost = useCallback(
    (value: string) => {
      void setHostQuery(trafficLogHostFilter(value));
    },
    [setHostQuery]
  );
  const [hostScopeProjectId, setHostScopeProjectId] = useState(projectId);
  const [hostSuppressed, setHostSuppressed] = useState(false);
  const [seenUrlProject, setSeenUrlProject] = useState(
    () => urlProjectId !== undefined
  );

  if (urlProjectId !== undefined && !seenUrlProject) {
    setSeenUrlProject(true);
  }

  if (projectId !== hostScopeProjectId) {
    const isHydrationAlignment = urlProjectId !== undefined && !seenUrlProject;
    setHostScopeProjectId(projectId);
    if (!isHydrationAlignment && hostQuery.length > 0) {
      setHostSuppressed(true);
    }
  }

  if (hostSuppressed && hostQuery.length === 0) {
    setHostSuppressed(false);
  }

  useEffect(() => {
    if (!hostSuppressed || hostQuery.length === 0) {
      return;
    }
    void setHostQuery("");
  }, [hostQuery, hostSuppressed, setHostQuery]);

  useEffect(() => {
    if (hostSuppressed || hostQuery.length === 0) {
      return;
    }
    const canonical = trafficLogHostFilter(hostQuery);
    if (canonical !== hostQuery) {
      void setHostQuery(canonical);
    }
  }, [hostQuery, hostSuppressed, setHostQuery]);

  const trafficHost = hostSuppressed ? "" : trafficLogHostFilter(hostQuery);

  return (
    <GeoProjectProvider
      projectId={projectId}
      setTrafficHost={setTrafficHost}
      trafficHost={trafficHost}
    >
      {children}
    </GeoProjectProvider>
  );
}

export function useGeoProjectScope(): GeoProjectContextValue {
  return useContext(GeoProjectContext);
}
