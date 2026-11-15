export interface ContentActivityEntry {
  date: string;
  count: number;
  level: number;
  drafts: number;
  published: number;
}

export interface ContentPublishingDailyCount {
  day: string;
  drafts: number;
  strictDrafts: number;
  published: number;
}

export interface ContentPublishingMetricsData {
  drafts: number;
  published: number;
  graph: {
    activity: ContentActivityEntry[];
  };
}
