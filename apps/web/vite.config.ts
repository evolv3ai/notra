import { fileURLToPath } from "node:url";

import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { consentManifest } from "c15t/tanstack-start/build";
import mdx from "fumadocs-mdx/vite";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

import * as sourceConfig from "./source.config";
import { DOCS_PROXY_ORIGIN, OAUTH_ISSUER_ORIGIN } from "./src/constants/proxy";
import { buildSecurityHeaders } from "./src/utils/security-headers";

const SERVER_ONLY_PACKAGES = [
  "@remotion/bundler",
  "@remotion/renderer",
  "@resvg/resvg-js",
  "satori",
  "sharp",
];

const RAW_QUERY_REGEX = /\?(.*&)?raw(&|$)/;

async function contentMdx(): ReturnType<typeof mdx> {
  const plugin = await mdx(sourceConfig);
  const { transform } = plugin;
  if (typeof transform !== "function") {
    return plugin;
  }
  return {
    ...plugin,
    transform(code, id, options) {
      if (RAW_QUERY_REGEX.test(id)) {
        return;
      }
      return transform.call(this, code, id, options);
    },
  };
}

export default defineConfig(({ command }) => ({
  envPrefix: ["VITE_", "NEXT_PUBLIC_"],
  resolve: {
    tsconfigPaths: true,
    alias: [
      {
        find: /^@\/components\/ui\//,
        replacement: fileURLToPath(
          new URL("../../packages/ui/src/components/ui/", import.meta.url)
        ),
      },
      {
        find: "next/image",
        replacement: fileURLToPath(
          new URL("src/lib/shims/next-image.tsx", import.meta.url)
        ),
      },
    ],
  },
  server: {
    port: 3001,
    allowedHosts: [".trycloudflare.com"],
  },
  optimizeDeps: {
    exclude: SERVER_ONLY_PACKAGES,
  },
  ssr: {
    external: SERVER_ONLY_PACKAGES,
    noExternal: [
      "@notra/ui",
      "@notra/email",
      "@notra/kiwi",
      "@scritto/react",
      "@scritto/core",
      "react-fast-marquee",
      "react-tweet",
    ],
  },
  environments: {
    ssr: {
      resolve: {
        external: [...SERVER_ONLY_PACKAGES, "react", "react-dom"],
      },
      optimizeDeps: {
        include: [
          "@notra/ui > react-fast-marquee",
          "@notra/kiwi > opentype.js",
        ],
        rolldownOptions: {
          external: ["react", "react-dom", "react/jsx-runtime"],
        },
      },
    },
  },
  plugins: [
    contentMdx(),
    tailwindcss(),
    consentManifest({
      backendURL: "https://notra-prod-notra.inth.app",
    }),
    tanstackStart(),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    nitro({
      compressPublicAssets:
        process.env.VERCEL === "1" ? false : { gzip: true, brotli: true },
      traceDeps: [
        "@resvg/resvg-js",
        "harfbuzzjs*",
        "satori",
        "sharp",
        "react",
        "react-dom",
      ],
      rolldownConfig: {
        external: ["@remotion/bundler", "@remotion/renderer"],
      },
      routeRules: {
        "/**": { headers: buildSecurityHeaders(command === "serve") },
      },
      devProxy: {
        "/docs": { target: DOCS_PROXY_ORIGIN, changeOrigin: true },
        "/docs/**": { target: DOCS_PROXY_ORIGIN, changeOrigin: true },
      },
      vercel: {
        config: {
          version: 3,
          routes: [
            { src: "^/docs(/.*)?$", dest: `${DOCS_PROXY_ORIGIN}/docs$1` },
            {
              src: "^/\\.well-known/(oauth-authorization-server|openid-configuration)$",
              dest: `${OAUTH_ISSUER_ORIGIN}/.well-known/$1`,
            },
          ],
        },
      },
    }),
  ],
}));
