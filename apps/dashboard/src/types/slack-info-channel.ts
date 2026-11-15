export interface SlackInfoChannelEvent {
  emoji: string;
  title: string;
  /** Empty values are left out of the message. */
  fields: Record<string, string | null | undefined>;
  /** Link buttons under the message; they only open a URL. */
  links?: SlackInfoChannelLink[];
}

interface SlackInfoChannelLink {
  label: string;
  url: string;
  danger?: boolean;
}
