import { Card } from "@/components/ui/card";

import { ChatgptAppCall } from "../components/chatgpt-app-call";
import { ChatgptMessage } from "../components/chatgpt-message";

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

export default function ChatgptAppCallExample() {
  return (
    <Card className="border-chatgpt-border bg-chatgpt-bg font-chatgpt text-chatgpt-fg w-full min-w-0 items-start gap-2 rounded-2xl border p-6 text-base ring-0">
      <ChatgptAppCall logo={NOTRA_LOGO} name="Notra" />
      <ChatgptMessage from="assistant">
        Acme showed up in 42% of AI answers this week, up 6 points.
      </ChatgptMessage>
    </Card>
  );
}
