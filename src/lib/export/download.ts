import JSZip from "jszip";
import type { StarterFiles } from "./project";

/** Zips the starter files and hands the archive to the browser. */
export async function downloadZip(files: StarterFiles, zipName: string): Promise<void> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(files)) {
    zip.file(path, content);
  }
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = zipName;
  anchor.click();
  URL.revokeObjectURL(url);
}
