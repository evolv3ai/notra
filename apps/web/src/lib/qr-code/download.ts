import { QR_CODE_PNG_SIZE } from "@/constants/qr-code";
import { loadLogoFromUrl } from "@/lib/qr-code/logo";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

async function selfContainedMarkup(svg: SVGSVGElement) {
  const image = svg.querySelector("image");
  const href = image?.getAttribute("href") ?? "";
  if (!(image && href.startsWith("https:"))) {
    return svg.outerHTML;
  }
  const { logo, error } = await loadLogoFromUrl(href);
  if (!logo) {
    throw new Error(error ?? "Could not load the logo.");
  }
  image.setAttribute("href", logo.src);
  const markup = svg.outerHTML;
  image.setAttribute("href", href);
  return markup;
}

export async function downloadQrSvg(svg: SVGSVGElement) {
  downloadBlob(
    new Blob([await selfContainedMarkup(svg)], { type: "image/svg+xml" }),
    "qr-code.svg"
  );
}

export async function downloadQrPng(svg: SVGSVGElement) {
  const image = new Image();
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(await selfContainedMarkup(svg))}`;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = QR_CODE_PNG_SIZE;
  canvas.height = QR_CODE_PNG_SIZE;
  canvas
    .getContext("2d")
    ?.drawImage(image, 0, 0, QR_CODE_PNG_SIZE, QR_CODE_PNG_SIZE);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png")
  );
  if (blob) {
    downloadBlob(blob, "qr-code.png");
  }
}

export async function readSvgLogo(file: File) {
  const svg = await file.text();
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
