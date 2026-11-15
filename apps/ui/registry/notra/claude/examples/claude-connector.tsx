import { ClaudeMessage } from "../components/claude-message";
import { ClaudeSearch } from "../components/claude-search";

const NOTRA_LOGO = (
  <>
    <img
      alt=""
      className="[[data-theme=dark]_&]:hidden"
      src="/logo-light.svg"
    />
    <img
      alt=""
      className="hidden [[data-theme=dark]_&]:block"
      src="/logo-dark.svg"
    />
  </>
);

export default function ClaudeConnectorExample() {
  return (
    <div className="bg-claude-bg font-claude flex w-[calc(100vw-3rem)] max-w-full min-w-0 flex-col gap-4 p-6">
      <ClaudeMessage from="assistant">
        <ClaudeSearch
          items={[
            {
              detail: "getGeoOverview",
              label: "Used Notra:",
              logo: NOTRA_LOGO,
              tool: "Notra",
              type: "tool",
            },
          ]}
          logo={NOTRA_LOGO}
        />
        <p className="font-claude-serif text-claude-fg text-base leading-[1.65]">
          Acme showed up in 42% of AI answers this week, up 6 points.
        </p>
      </ClaudeMessage>
    </div>
  );
}
