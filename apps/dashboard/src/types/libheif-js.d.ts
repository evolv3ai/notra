declare module "libheif-js/wasm-bundle" {
  import type { HeicDecoder } from "./content/heic-image";

  const decoder: HeicDecoder;
  export = decoder;
}
