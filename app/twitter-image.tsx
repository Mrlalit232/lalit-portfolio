import { ogSize, renderOgImage } from "@/lib/og";

export const alt = "Lalit Kumar Saini: Technology × Business × Creativity";
export const size = ogSize;
export const contentType = "image/png";

export default function Image() {
  return renderOgImage();
}
