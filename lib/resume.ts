import { existsSync } from "node:fs";
import path from "node:path";
import { site } from "./site";

/** True when the real resume PDF has been added to /public. Checked at build/render time on the server. */
export function resumePdfAvailable() {
  return existsSync(path.join(process.cwd(), "public", site.resumePdf));
}
