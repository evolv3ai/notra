"use client";

import { Button } from "@/components/ui/button";

import { InstrumentGrid } from "../components/instrument-grid";
import {
  InstrumentEmpty,
  InstrumentModule,
} from "../components/instrument-module";

const ENGINES = [
  { name: "ChatGPT", rate: "64%" },
  { name: "Claude", rate: "58%" },
  { name: "Gemini", rate: "41%" },
  { name: "Perplexity", rate: "37%" },
] as const;

export default function CardDemo() {
  return (
    <InstrumentGrid className="w-full max-w-3xl md:grid-cols-2">
      <InstrumentModule
        action={
          <Button size="sm" variant="outline">
            View all
          </Button>
        }
        eyebrow="Mention rate"
        hint="Share of answers that mention your brand, per engine."
        readout="Last 7 days"
        variant="table"
      >
        <ul className="divide-y">
          {ENGINES.map((engine) => (
            <li
              className="flex items-center justify-between py-2.5 text-sm"
              key={engine.name}
            >
              <span className="font-medium">{engine.name}</span>
              <span className="text-muted-foreground tabular-nums">
                {engine.rate}
              </span>
            </li>
          ))}
        </ul>
      </InstrumentModule>
      <InstrumentModule eyebrow="Conversations" variant="table">
        <InstrumentEmpty busy message="Collecting answers" />
      </InstrumentModule>
    </InstrumentGrid>
  );
}
