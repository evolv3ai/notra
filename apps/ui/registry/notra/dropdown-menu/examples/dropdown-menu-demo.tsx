import {
  DownloadIcon,
  SettingsIcon,
  Trash2Icon,
  UsersIcon,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "../../dropdown-menu/components/dropdown-menu";

export default function DropdownMenuDemo() {
  const [showActivity, setShowActivity] = useState(true);
  const [view, setView] = useState("team");

  return (
    <div className="flex min-h-112 items-start justify-center gap-3 p-8">
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" />}>
          Open menu
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Workspace</DropdownMenuLabel>
            <DropdownMenuItem>
              <SettingsIcon aria-hidden="true" />
              Settings
              <DropdownMenuShortcut>⌘,</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <UsersIcon aria-hidden="true" />
              Invite members
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <DownloadIcon aria-hidden="true" />
                Export
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem>Markdown</DropdownMenuItem>
                <DropdownMenuItem>CSV</DropdownMenuItem>
                <DropdownMenuItem disabled>PDF</DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem
            checked={showActivity}
            onCheckedChange={setShowActivity}
          >
            Show activity
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel>View</DropdownMenuLabel>
            <DropdownMenuRadioGroup onValueChange={setView} value={view}>
              <DropdownMenuRadioItem value="team">Team</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="personal">
                Personal
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive">
            <Trash2Icon aria-hidden="true" />
            Delete workspace
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <span className="text-muted-foreground py-1.5 text-sm">View: {view}</span>
    </div>
  );
}
