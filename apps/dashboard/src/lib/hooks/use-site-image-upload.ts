import {
  SITE_IMAGE_UPLOAD_INPUT_MAX_BYTES,
  SITE_IMAGE_UPLOAD_MAX_BYTES,
} from "@notra/sites-core/constants/uploads";
import type { SiteImageUploadKind } from "@notra/sites-core/types/uploads";
import type { ClipboardEvent, DragEvent } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { useSiteWorkspace } from "@/components/sites/site-workspace-context";
import type { SiteImageUploadPreview } from "@/types/site-design";
import { toErrorMessage } from "@/utils/error-message";
import { shrinkSiteImage } from "@/utils/shrink-site-image";

/** Uploads an image for one asset field via button, drop or paste. */
export function useSiteImageUpload(
  kind: SiteImageUploadKind,
  onChange: (path: string) => void
) {
  const t = useTranslations("sites.design.asset");
  const workspace = useSiteWorkspace();
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<SiteImageUploadPreview | null>(null);
  useEffect(
    () => () => {
      if (preview) {
        URL.revokeObjectURL(preview.url);
      }
    },
    [preview]
  );
  // An upload outlives the render that started it. Applying the path through
  // that render's onChange would write its stale config and draft revision.
  const latestOnChange = useRef(onChange);
  useLayoutEffect(() => {
    latestOnChange.current = onChange;
  });
  // Switching sections unmounts the field mid-upload; a preview created then
  // would never be revoked.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const enabled =
    Boolean(workspace) && !workspace?.readOnly && !workspace?.discardOpen;

  const upload = async (file: File | undefined) => {
    if (!file || !workspace || !enabled || uploading) {
      return;
    }
    if (!file.type.startsWith("image/") && !/\.ico$/i.test(file.name)) {
      toast.error(t("notImage"));
      return;
    }
    const tooLarge = () =>
      toast.error(
        t("tooLarge", { size: SITE_IMAGE_UPLOAD_MAX_BYTES / 1024 / 1024 })
      );
    if (file.size > SITE_IMAGE_UPLOAD_INPUT_MAX_BYTES) {
      tooLarge();
      return;
    }
    const finishUpload = workspace.beginImageUpload();
    setUploading(true);
    try {
      const prepared = await shrinkSiteImage(file, kind);
      if (prepared.size > SITE_IMAGE_UPLOAD_MAX_BYTES) {
        tooLarge();
      } else {
        const path = await workspace.uploadImage(prepared, kind);
        // Leaving the field also retires its config snapshot. Applying its
        // callback after unmount could overwrite edits made in another section.
        if (!mounted.current) {
          toast.error(t("uploadAbandoned"));
        } else {
          // Show the local file instead of downloading the draft again. SVGs are
          // sanitized server-side, so those still come from the draft.
          setPreview(
            prepared.type === "image/svg+xml"
              ? null
              : { path, url: URL.createObjectURL(prepared) }
          );
          latestOnChange.current(path);
          toast.success(t("uploaded"));
        }
      }
    } catch (error) {
      toast.error(toErrorMessage(error, t("uploadFailed")));
    }
    finishUpload();
    setUploading(false);
  };

  return {
    enabled,
    uploading,
    dragging,
    preview,
    upload,
    dropTarget: {
      onDragOver: (event: DragEvent<HTMLElement>) => {
        if (enabled && event.dataTransfer.types.includes("Files")) {
          event.preventDefault();
          setDragging(true);
        }
      },
      onDragLeave: (event: DragEvent<HTMLElement>) => {
        // Moving onto a child, like the thumbnail, fires a leave too.
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setDragging(false);
        }
      },
      onDrop: (event: DragEvent<HTMLElement>) => {
        const file = event.dataTransfer.files[0];
        if (enabled && file) {
          event.preventDefault();
          setDragging(false);
          void upload(file);
        }
      },
    },
    onPaste: (event: ClipboardEvent<HTMLElement>) => {
      const file = event.clipboardData.files[0];
      if (enabled && file) {
        event.preventDefault();
        void upload(file);
      }
    },
  };
}
