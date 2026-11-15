"use client";

import {
  SITE_SUSPENSION_CATEGORIES,
  SITE_SUSPENSION_CATEGORY_LABELS,
} from "@notra/sites-core/constants/sites";
import { Label } from "@notra/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@notra/ui/components/ui/select";
import { Textarea } from "@notra/ui/components/ui/textarea";

import { SITE_MAX_SUSPENSION_REASON_LENGTH } from "@/constants/sites";
import type { SuspensionFieldsProps } from "@/types/moderation";

const CATEGORY_ITEMS = SITE_SUSPENSION_CATEGORIES.map((value) => ({
  value,
  label: SITE_SUSPENSION_CATEGORY_LABELS[value],
}));

/** Category and reason inputs shared by the suspend and ban dialogs. */
export function SuspensionFields({
  id,
  category,
  onCategoryChange,
  categoryHint,
  reason,
  onReasonChange,
  reasonHint,
  reasonPlaceholder,
}: SuspensionFieldsProps) {
  return (
    <div className="flex flex-col gap-4">
      {onCategoryChange ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-category`}>Category</Label>
          <Select
            items={CATEGORY_ITEMS}
            onValueChange={(next) => {
              const match = SITE_SUSPENSION_CATEGORIES.find(
                (value) => value === next
              );
              if (match) {
                onCategoryChange(match);
              }
            }}
            value={category ?? null}
          >
            <SelectTrigger
              aria-describedby={
                categoryHint ? `${id}-category-hint` : undefined
              }
              className="w-full"
              id={`${id}-category`}
            >
              <SelectValue placeholder="Pick a category" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORY_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {categoryHint ? (
            <p
              className="text-muted-foreground text-xs"
              id={`${id}-category-hint`}
            >
              {categoryHint}
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-reason`}>Reason</Label>
        <Textarea
          aria-describedby={`${id}-reason-hint`}
          id={`${id}-reason`}
          maxLength={SITE_MAX_SUSPENSION_REASON_LENGTH}
          onChange={(event) => onReasonChange(event.target.value)}
          placeholder={reasonPlaceholder}
          required
          value={reason}
        />
        <p className="text-muted-foreground text-xs" id={`${id}-reason-hint`}>
          {reasonHint}
        </p>
      </div>
    </div>
  );
}
