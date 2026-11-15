import { Input } from "@notra/ui/components/ui/input";
import { Label } from "@notra/ui/components/ui/label";

import type { UtmFieldInputProps } from "@/types/utm-builder";

export function UtmFieldInput({
  field,
  value,
  listId,
  onChange,
}: UtmFieldInputProps) {
  const id = `utm-${field.key}`;
  return (
    <div className="flex flex-col gap-1.5">
      <Label
        className="flex items-baseline justify-between gap-2 font-sans"
        htmlFor={id}
      >
        <span className="text-sm/4.5 font-medium text-[#1E1E1E] dark:text-white">
          {field.label}
          {field.requirement === "required" ? (
            <span aria-hidden="true" className="text-primary">
              {" *"}
            </span>
          ) : null}
        </span>
        <span className="font-mono text-[0.6875rem]/4 font-normal text-[#1E1E1E66] dark:text-white/40">
          {field.param}
        </span>
      </Label>
      <Input
        aria-describedby={`${id}-hint`}
        autoComplete="off"
        className="h-10 rounded-xl border-[#E4E4E4] bg-transparent px-3 font-mono text-[0.875rem]/5 shadow-none placeholder:text-[#1E1E1E40] dark:border-white/12 dark:placeholder:text-white/30"
        id={id}
        list={listId}
        onChange={(event) => onChange(event.target.value)}
        placeholder={field.placeholder}
        required={field.requirement === "required"}
        spellCheck={false}
        value={value}
      />
      <p
        className="font-sans text-[0.75rem]/4.5 text-[#1E1E1E80] dark:text-white/45"
        id={`${id}-hint`}
      >
        {field.description}
      </p>
    </div>
  );
}
