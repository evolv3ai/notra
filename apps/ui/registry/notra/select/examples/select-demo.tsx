import { useId } from "react";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "../../select/components/select";
import { FREQUENCY_OPTIONS } from "../constants/select";

export default function SelectDemo() {
  const id = useId();

  return (
    <div className="flex min-h-80 flex-wrap items-start justify-center gap-8 p-8">
      <div className="flex flex-col gap-2">
        <label className="text-sm" htmlFor={`${id}-frequency`}>
          Frequency
        </label>
        <Select defaultValue="weekly" items={FREQUENCY_OPTIONS}>
          <SelectTrigger className="w-48" id={`${id}-frequency`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Frequency</SelectLabel>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectGroup>
            <SelectSeparator />
            <SelectItem disabled value="custom">
              Custom
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-sm" htmlFor={`${id}-inline`}>
          Compact property
        </label>
        <Select defaultValue="weekly" items={FREQUENCY_OPTIONS}>
          <SelectTrigger id={`${id}-inline`} size="sm" variant="ghost">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FREQUENCY_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
