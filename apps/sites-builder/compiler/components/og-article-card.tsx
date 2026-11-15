// oxlint-disable shadcn/no-inline-styles -- satori draws inline styles only; this markup never reaches a browser.
import type { CSSProperties, ReactElement } from "react";

import {
  OG_ARTICLE_AVATAR_SIZE,
  OG_ARTICLE_MAX_AVATARS,
  OG_FONT_FAMILY,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_WIDTH,
  OG_THEME,
} from "../constants/og-images";
import type { OgArticleCardContent } from "../types/og-images";
import { titleSize } from "../utils/og-card";

export function OgArticleCard(content: OgArticleCardContent): ReactElement {
  const colors = OG_THEME[content.appearance];
  const { authors } = content;
  const avatar = (index: number, fill: string): CSSProperties => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: OG_ARTICLE_AVATAR_SIZE,
    height: OG_ARTICLE_AVATAR_SIZE,
    marginLeft: index === 0 ? 0 : -12,
    borderRadius: OG_ARTICLE_AVATAR_SIZE / 2,
    border: `3px solid ${colors.background}`,
    backgroundColor: fill,
    color: "#ffffff",
    fontSize: 20,
    fontWeight: 600,
    objectFit: "cover",
  });
  return (
    <div
      style={{
        width: OG_IMAGE_WIDTH,
        height: OG_IMAGE_HEIGHT,
        display: "flex",
        flexDirection: "column",
        position: "relative",
        padding: "72px 80px",
        backgroundColor: colors.background,
        color: colors.text,
        fontFamily: OG_FONT_FAMILY,
        fontSize: 28,
        fontWeight: 500,
      }}
    >
      {content.background ? (
        <img
          alt=""
          height={OG_IMAGE_HEIGHT}
          src={content.background}
          style={{ position: "absolute", top: 0, left: 0, objectFit: "cover" }}
          width={OG_IMAGE_WIDTH}
        />
      ) : null}
      <div style={{ display: "flex", gap: 18 }}>
        <div style={{ display: "flex" }}>{content.date}</div>
        <div style={{ display: "flex", color: colors.muted }}>
          {content.category}
        </div>
      </div>
      <div
        style={{
          display: "block",
          flexGrow: 1,
          marginTop: 40,
          fontSize: titleSize(content.title),
          lineHeight: 1.1,
          letterSpacing: "-0.03em",
          lineClamp: content.description ? 2 : 3,
          wordBreak: "break-word",
        }}
      >
        {content.title}
      </div>
      {content.description ? (
        <div
          style={{
            display: "block",
            maxWidth: 920,
            marginBottom: 32,
            fontWeight: 400,
            lineHeight: 1.45,
            color: colors.muted,
            lineClamp: 2,
          }}
        >
          {content.description}
        </div>
      ) : null}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {authors.length > 0 ? (
          <div style={{ display: "flex" }}>
            {authors.slice(0, OG_ARTICLE_MAX_AVATARS).map((author, index) =>
              author.avatar ? (
                <img
                  alt=""
                  height={OG_ARTICLE_AVATAR_SIZE}
                  key={author.name}
                  src={author.avatar}
                  style={avatar(index, colors.background)}
                  width={OG_ARTICLE_AVATAR_SIZE}
                />
              ) : (
                <div key={author.name} style={avatar(index, content.accent)}>
                  {author.name.charAt(0).toUpperCase()}
                </div>
              )
            )}
          </div>
        ) : null}
        {authors.length === 0 && content.logo ? (
          <img alt="" height={44} src={content.logo} width={44} />
        ) : null}
        <div
          style={{
            display: "flex",
            color: authors.length > 0 ? colors.text : colors.muted,
          }}
        >
          {authors.length > 0
            ? authors.map((author) => author.name).join(", ")
            : content.domain}
        </div>
      </div>
    </div>
  );
}
