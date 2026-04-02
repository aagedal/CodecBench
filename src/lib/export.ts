import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile, writeFile } from "@tauri-apps/plugin-fs";

export async function saveJsonFile(json: string, defaultName: string) {
  const path = await save({
    defaultPath: defaultName,
    filters: [{ name: "JSON", extensions: ["json"] }],
  });
  if (path) {
    await writeTextFile(path, json);
  }
}

export async function savePngFile(blob: Blob, defaultName: string) {
  const path = await save({
    defaultPath: defaultName,
    filters: [{ name: "PNG Image", extensions: ["png"] }],
  });
  if (path) {
    const arrayBuffer = await blob.arrayBuffer();
    await writeFile(path, new Uint8Array(arrayBuffer));
  }
}

export async function savePdfFile(blob: Blob, defaultName: string) {
  const path = await save({
    defaultPath: defaultName,
    filters: [{ name: "PDF Document", extensions: ["pdf"] }],
  });
  if (path) {
    const arrayBuffer = await blob.arrayBuffer();
    await writeFile(path, new Uint8Array(arrayBuffer));
  }
}
