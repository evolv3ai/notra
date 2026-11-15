import { MockFrame } from "@/components/landing/mock-frame";
import {
  SITES_CONFIG_CARD,
  SITES_JSON_TOKEN_CLASS,
} from "@/constants/feature-pages/sites";
import { tokenizeJson } from "@/utils/json-tokens";

const TOKENS = tokenizeJson(SITES_CONFIG_CARD.source);

export function SitesCardConfig() {
  const { frame } = SITES_CONFIG_CARD;

  return (
    <MockFrame heading={frame.heading} subhead={frame.subhead}>
      <pre className="m-0 overflow-hidden p-4 font-mono text-xs/5.5">
        {TOKENS.map((token, index) => (
          <span
            className={SITES_JSON_TOKEN_CLASS[token.kind]}
            // biome-ignore lint/suspicious/noArrayIndexKey: tokens are a fixed, ordered list
            key={index}
          >
            {token.text}
          </span>
        ))}
      </pre>
    </MockFrame>
  );
}
