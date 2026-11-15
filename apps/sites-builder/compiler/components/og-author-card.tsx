// oxlint-disable shadcn/no-inline-styles -- satori draws inline styles only; this markup never reaches a browser.
import type { ReactElement } from "react";

import {
  OG_AUTHOR_AVATAR_SIZE,
  OG_AUTHOR_LOGO_SIZE,
  OG_FONT_FAMILY,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_WIDTH,
  OG_THEME,
} from "../constants/og-images";
import type { OgAuthorCardContent } from "../types/og-images";

export function OgAuthorCard(content: OgAuthorCardContent): ReactElement {
  const colors = OG_THEME[content.appearance];
  const { author } = content;
  return (
    <div
      style={{
        width: OG_IMAGE_WIDTH,
        height: OG_IMAGE_HEIGHT,
        display: "flex",
        flexDirection: "column",
        position: "relative",
        padding: 80,
        backgroundColor: colors.background,
        color: colors.text,
        fontFamily: OG_FONT_FAMILY,
      }}
    >
      {content.background ? (
        <img
          alt=""
          height={OG_IMAGE_HEIGHT / 2}
          src={content.background}
          style={{ position: "absolute", bottom: 0, left: 0 }}
          width={OG_IMAGE_WIDTH}
        />
      ) : null}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: OG_AUTHOR_LOGO_SIZE,
        }}
      >
        {content.logo ? (
          <img
            alt=""
            height={OG_AUTHOR_LOGO_SIZE}
            src={content.logo}
            width={OG_AUTHOR_LOGO_SIZE}
          />
        ) : (
          <div style={{ display: "flex" }} />
        )}
        <div
          style={{
            display: "flex",
            color: colors.muted,
            fontSize: 16,
            fontWeight: 600,
            letterSpacing: "0.24em",
            textTransform: "uppercase",
          }}
        >
          {content.label}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          flex: 1,
          minHeight: 0,
          marginTop: 56,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "block",
            width: "100%",
            fontSize: 64,
            fontWeight: 600,
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            lineClamp: 3,
            wordBreak: "break-word",
          }}
        >
          {content.title}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {author ? (
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {author.avatar ? (
              <img
                alt=""
                height={OG_AUTHOR_AVATAR_SIZE}
                src={author.avatar}
                style={{
                  borderRadius: OG_AUTHOR_AVATAR_SIZE / 2,
                  objectFit: "cover",
                }}
                width={OG_AUTHOR_AVATAR_SIZE}
              />
            ) : null}
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontSize: 24, fontWeight: 600 }}>
                {author.name}
              </div>
              {author.title ? (
                <div
                  style={{
                    display: "flex",
                    marginTop: 2,
                    color: colors.muted,
                    fontSize: 18,
                  }}
                >
                  {author.title}
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex" }} />
        )}
        <div
          style={{
            display: "flex",
            color: colors.muted,
            fontSize: 20,
            fontWeight: 600,
          }}
        >
          {content.domain}
        </div>
      </div>
    </div>
  );
}
