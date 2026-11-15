import { expect, mock, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import type { SocialVideoAttachment as VideoDraft } from "@notra/schemas/types/dashboard/content";
import {
  Children,
  isValidElement,
  type ChangeEvent,
  type ComponentProps,
  type ElementType,
  type ReactElement,
  type ReactNode,
} from "react";

import type { UploadFileProps } from "@/types/upload/client";

if (!process.env.NOTRA_SOCIAL_VIDEO_LIFECYCLE_TEST_WORKER) {
  test("social video upload lifecycle regressions run in isolation", () => {
    const result = spawnSync(
      process.execPath,
      ["--no-env-file", "test", fileURLToPath(import.meta.url)],
      {
        env: {
          PATH: process.env.PATH,
          NOTRA_SOCIAL_VIDEO_LIFECYCLE_TEST_WORKER: "1",
        },
        timeout: 30_000,
      }
    );
    expect(result.status, result.stderr?.toString()).toBe(0);
  });
} else {
  const react = await import("react");
  let states: unknown[] = [];
  let stateIndex = 0;
  mock.module("react", () => ({
    ...react,
    useState(initial: unknown) {
      const owner = states;
      const index = stateIndex++;
      if (index === owner.length) {
        owner.push(typeof initial === "function" ? initial() : initial);
      }
      return [
        owner[index],
        (update: unknown) => {
          owner[index] =
            typeof update === "function" ? update(owner[index]) : update;
        },
      ];
    },
    useRef: (initial: unknown) => ({ current: initial }),
  }));
  mock.module("use-intl", () => ({
    useTranslations: () => (key: string) => key,
  }));
  mock.module("sonner", () => ({ toast: { error: mock() } }));
  mock.module("@notra/ui/components/shared/responsive-dialog", () =>
    Object.fromEntries(
      ["", "Close", "Content", "Footer", "Header", "Title", "Trigger"].map(
        (suffix) => [`ResponsiveDialog${suffix}`, `dialog-${suffix}`]
      )
    )
  );
  mock.module("../src/components/button", () => ({
    Button: "button",
    buttonVariants: () => "",
  }));
  for (const [path, name] of [
    ["../src/components/confetti", "Confetti"],
    ["../src/components/content/add-reference-control", "AddReferenceControl"],
    [
      "../src/components/content/post-social-error-notice",
      "PostSocialErrorNotice",
    ],
    [
      "../src/components/content/post-social-intent-button",
      "PostSocialIntentButton",
    ],
    ["../src/components/linkedin-post", "LinkedInPost"],
    ["../src/components/twitter-post", "TwitterPost"],
  ] as const) {
    mock.module(path, () => ({ [name]: () => null }));
  }
  mock.module("../src/lib/navigation", () => ({
    useParams: () => ({}),
    useRouter: () => ({}),
  }));
  mock.module("../src/lib/hooks/use-brand-analysis", () => ({
    useBrandSettings: () => ({}),
  }));
  mock.module("../src/lib/hooks/use-brand-references", () => ({
    useCreateReferenceForVoice: () => ({}),
  }));
  mock.module("../src/lib/hooks/use-selected-social-account", () => ({
    useSelectedSocialAccount: () => ({
      accounts: [],
      selectedAccount: { id: "account-test", username: "test" },
    }),
  }));
  mock.module("../src/utils/social-publish", () => ({
    getPublishErrorInfo: () => ({}),
    buildReferenceInput: mock(),
    isReferenceLimitError: () => false,
  }));
  mock.module("../src/utils/twitter", () => ({
    getTwitterCharLimit: () => 280,
    getWeightedTweetLength: (text: string) => text.length,
    twitterAuthorFromAccount: () => ({}),
  }));
  mock.module("../src/utils/linkedin", () => ({
    linkedInAuthorFromAccount: () => ({}),
  }));
  const publish = { isPending: false, reset: mock(), mutate: mock() };
  const save = {
    isPending: false,
    mutate: mock((_video: VideoDraft | null) => {
      save.isPending = true;
    }),
  };
  mock.module("../src/lib/hooks/use-connected-accounts", () => ({
    usePublishSocialPost: () => publish,
  }));
  mock.module("../src/lib/hooks/use-content", () => ({
    useIsSavingSocialVideo: () => false,
    useSaveSocialVideo: () => save,
  }));
  let startUpload!: () => void;
  const started = new Promise<void>((resolve) => {
    startUpload = resolve;
  });
  let completeUpload!: (result: { key: string; url: string }) => void;
  const uploaded = new Promise<{ key: string; url: string }>((resolve) => {
    completeUpload = resolve;
  });
  const uploadFile = mock((_input: UploadFileProps) => {
    startUpload();
    return uploaded;
  });
  mock.module("../src/lib/upload/client", () => ({ uploadFile }));

  const { Button } = await import("../src/components/button");
  const { PostSocialButton } =
    await import("../src/components/content/post-social-button");
  const { SocialVideoAttachment } =
    await import("../src/components/content/social-video-attachment");

  const find = <T extends ElementType>(
    node: ReactNode,
    type: T
  ): ReactElement<ComponentProps<T>> => {
    const search = (
      current: ReactNode
    ): ReactElement<{ children?: ReactNode }> | undefined => {
      for (const child of Children.toArray(current)) {
        if (!isValidElement<{ children?: ReactNode }>(child)) {
          continue;
        }
        const found =
          child.type === type ? child : search(child.props.children);
        if (found) {
          return found;
        }
      }
    };
    const found = search(node);
    if (!found) {
      throw new Error(`Missing element: ${String(type)}`);
    }
    return found as ReactElement<ComponentProps<T>>;
  };

  test("an upload survives close/reopen without a text-only publish or second upload", async () => {
    const parentState: unknown[] = [];
    const onUploadingChange = mock();
    const props = {
      platform: "twitter" as const,
      organizationId: "org-test",
      contentId: "post-test",
      content: "Test post",
      initialVideo: null as VideoDraft | null,
      onUploadingChange,
    };
    const render = () => {
      states = parentState;
      stateIndex = 0;
      return PostSocialButton(props);
    };
    const renderAttachment = (
      attachment: ReactElement<ComponentProps<typeof SocialVideoAttachment>>
    ) => {
      states = [];
      stateIndex = 0;
      return SocialVideoAttachment(attachment.props);
    };
    const click = {} as Parameters<
      NonNullable<ComponentProps<typeof Button>["onClick"]>
    >[0];
    let tree = render();
    tree.props.onOpenChange(true);
    tree = render();
    const uploadingAttachment = find(tree, SocialVideoAttachment);
    const bytes = new Uint8Array(5016);
    bytes.set([0x1a, 0x45, 0xdf, 0xa3, 0x53, 0x92]);
    bytes.set([0x42, 0x82, 0x84, 0x77, 0x65, 0x62, 0x6d], 6);
    bytes.set([0xec, 0x53, 0x88], 13);
    const file = new File([bytes], "clip.webm", {
      type: "application/octet-stream",
    });
    find(renderAttachment(uploadingAttachment), "input").props.onChange?.({
      target: { files: [file] },
    } as unknown as ChangeEvent<HTMLInputElement>);
    await started;
    expect(uploadFile.mock.calls[0]?.[0].file.type).toBe("video/webm");
    tree = render();
    expect(find(tree, Button).props.disabled).toBe(true);
    expect(onUploadingChange).toHaveBeenLastCalledWith(true);
    tree.props.onOpenChange(false);
    tree = render();
    tree.props.onOpenChange(true);
    tree = render();

    const reopenedAttachment = find(tree, SocialVideoAttachment);
    expect(reopenedAttachment.props.disabled).toBe(true);
    expect(find(tree, Button).props.disabled).toBe(true);
    find(tree, Button).props.onClick?.(click);
    expect(publish.mutate).not.toHaveBeenCalled();

    expect(onUploadingChange).toHaveBeenLastCalledWith(true);
    const remounted = renderAttachment(reopenedAttachment);
    expect(find(remounted, "input").props.disabled).toBe(true);
    expect(find(remounted, Button).props.disabled).toBe(true);
    expect(uploadFile).toHaveBeenCalledTimes(1);

    const video = {
      key: "organization/org-test/content/clip.webm",
      url: "https://cdn.example.com/organization/org-test/content/clip.webm",
      mimeType: "video/webm" as const,
      size: file.size,
    };
    completeUpload({ key: video.key, url: video.url });
    await uploaded;
    tree = render();
    expect(save.mutate).toHaveBeenCalledTimes(1);
    expect(onUploadingChange).toHaveBeenLastCalledWith(false);
    expect(save.mutate.mock.calls[0]?.[0]).toEqual(video);
    expect(find(tree, SocialVideoAttachment).props.value).toEqual(video);
    expect(find(tree, Button).props.disabled).toBe(true);
    find(tree, Button).props.onClick?.(click);
    expect(publish.mutate).not.toHaveBeenCalled();

    save.isPending = false;
    props.initialVideo = video;
    tree = render();
    expect(find(tree, SocialVideoAttachment).props.disabled).toBe(false);
    expect(find(tree, Button).props.disabled).toBe(false);
    find(tree, Button).props.onClick?.(click);
    expect(publish.mutate).toHaveBeenCalledTimes(1);
    expect(publish.mutate.mock.calls[0]?.[0]).toMatchObject({
      accountId: "account-test",
      content: "Test post",
      mediaUrls: [video.url],
    });
    expect(uploadFile).toHaveBeenCalledTimes(1);
  });
}
