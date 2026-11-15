"use client";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@notra/ui/components/ui/input-group";
import { useState } from "react";
import { useTranslations } from "use-intl";

import { useSite } from "@/components/sites/site-context";
import { SITE_NAME_MAX_LENGTH } from "@/constants/sites-form";
import { useUpdateSiteSettings } from "@/lib/hooks/use-update-site-settings";
import { useRouter } from "@/lib/navigation";

export function SiteNameField() {
  const tNew = useTranslations("sites.new");
  const tCommon = useTranslations("common");
  const { site } = useSite().detail;
  const [edited, setEdited] = useState<string | null>(null);
  const draft = edited ?? site.name;
  const router = useRouter();
  const save = useUpdateSiteSettings();
  const next = draft.trim();
  const dirty = next.length > 0 && next !== site.name;
  const submit = () => {
    if (dirty && !save.isPending) {
      save.mutate(
        { name: next },
        {
          onSuccess: () => {
            setEdited(null);
            // Re-runs the site loader so the tab title shows the new name.
            return router.refresh();
          },
        }
      );
    }
  };
  return (
    <form className="w-full sm:w-64 sm:shrink-0" action={submit}>
      <InputGroup>
        <InputGroupInput
          aria-label={tNew("name")}
          readOnly={save.isPending}
          maxLength={SITE_NAME_MAX_LENGTH}
          onBlur={() => {
            if (next.length === 0) {
              setEdited(null);
              return;
            }
            submit();
          }}
          onChange={(event) => setEdited(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setEdited(null);
            }
          }}
          value={draft}
        />
        {dirty || save.isPending ? (
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              loading={save.isPending}
              onClick={submit}
              variant="secondary"
            >
              {tCommon("actions.save")}
            </InputGroupButton>
          </InputGroupAddon>
        ) : null}
      </InputGroup>
    </form>
  );
}
