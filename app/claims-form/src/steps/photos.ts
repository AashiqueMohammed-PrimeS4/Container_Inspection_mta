// Section 5: six photo tiles and four document inputs.
import { busy } from "../lib/dom";
import { compressImage } from "../lib/compress";
import { clearFieldError, note } from "../lib/errors";
import { log } from "../lib/log";
import { DOCUMENT_TYPES, LIMITS, PHOTO_TYPES, type FileInput, type FileSlot, type UploadItem } from "../models/claim";
import * as files from "../state/files";

const MAX_PHOTOS = LIMITS.photosPerSlot;
const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const kb = (bytes: number) => `${Math.round(bytes / 1024)} KB`;

/** Opens the lightbox on files.list(slot)[index]. */
let preview: (slot: FileSlot, index: number) => void = () => {};

/** Thumbnails, counter and the add button state of one tile. */
function renderTile(tile: HTMLElement): void {
  const slot = tile.dataset.slot as FileSlot;
  const items = files.list(slot);
  const thumbs = tile.querySelector<HTMLElement>(".thumbs")!;
  thumbs.replaceChildren(
    ...items.map((f, i) => {
      const box = document.createElement("div");
      box.className = "thumb";
      const open = document.createElement("button");
      open.type = "button";
      open.className = "open";
      open.title = `${f.name}, ${kb(f.size)}`;
      open.setAttribute("aria-label", `Preview ${f.name}`);
      open.addEventListener("click", () => preview(slot, i));
      const img = document.createElement("img");
      img.src = f.url ?? "";
      img.alt = f.name; // set as a property, the name never goes through innerHTML
      open.append(img);
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "remove";
      remove.title = `Remove ${f.name}`;
      remove.setAttribute("aria-label", `Remove ${f.name}`);
      remove.textContent = "×";
      remove.addEventListener("click", (e) => {
        e.stopPropagation();
        files.remove(slot, i);
        renderTile(tile);
      });
      box.append(open, remove);
      return box;
    }),
  );
  tile.querySelector(".count")!.textContent = `${items.length} of ${MAX_PHOTOS}`;
  const add = tile.querySelector<HTMLElement & { disabled: boolean }>(".add")!;
  add.disabled = items.length >= MAX_PHOTOS;
}

/** Change handler of a tile input: type check, the 5 limit, compression, then the thumbnails. */
async function addPhotos(tile: HTMLElement, input: HTMLInputElement): Promise<void> {
  const slot = tile.dataset.slot as FileSlot;
  const picked = [...(input.files ?? [])]; // copied now, the FileList is reset below
  input.value = "";
  if (!picked.length) return;

  const messages: string[] = [];
  const typed = picked.filter((f) => (PHOTO_TYPES as readonly string[]).includes(f.type));
  if (typed.length < picked.length) messages.push("Only JPG or PNG photos are accepted.");
  const room = MAX_PHOTOS - files.count(slot);
  const chosen = typed.slice(0, Math.max(0, room));
  if (typed.length > chosen.length)
    messages.push(
      `Only ${MAX_PHOTOS} photos per category. ${chosen.length ? `The first ${chosen.length} were added.` : "This category is full."}`,
    );

  const add = tile.querySelector<HTMLElement & { disabled: boolean }>(".add")!;
  const counter = tile.querySelector(".count")!;
  busy(true);
  add.disabled = true;
  try {
    for (const [i, f] of chosen.entries()) {
      counter.textContent = `Compressing ${i + 1} of ${chosen.length}...`;
      try {
        const c = await compressImage(f);
        log.debug("compressed", f.name, f.size, "->", c.size);
        files.add(slot, { name: c.name, type: c.type, size: c.size, blob: c, url: URL.createObjectURL(c) });
      } catch (e) {
        log.warn("compress failed", f.name, e);
        messages.push(`${f.name} could not be read as an image.`);
      }
    }
  } finally {
    busy(false);
    renderTile(tile);
  }
  if (files.count(slot)) clearFieldError("files"); // "At least one photo is required" is met
  if (messages.length) note("msgFiles", messages.join(" "));
}

/** The names under a document input, one line per file with its size and a Preview link. */
function renderDocuments(slot: FileSlot): void {
  const line = document.querySelector(`ui5-file-uploader[data-slot="${slot}"]`)?.parentElement?.querySelector(".file");
  if (!line) return;
  line.replaceChildren(
    ...files.list(slot).map((f, i) => {
      const row = document.createElement("span");
      row.className = "doc";
      row.append(`${f.name} (${kb(f.size)}) `); // a text node, names come from the customer's disk
      const link = document.createElement("ui5-link") as HTMLElement & { href?: string; target?: string };
      link.textContent = "Preview";
      link.setAttribute("accessible-name", `Preview ${f.name}`);
      if (f.type.startsWith("image/")) link.addEventListener("click", () => preview(slot, i));
      else {
        link.href = f.url ?? ""; // a real link: the browser opens it on the click, no popup blocker
        link.target = "_blank";
      }
      row.append(link);
      return row;
    }),
  );
}

/** Draws a slot again after its state changed outside this module. */
export function renderSlot(slot: FileSlot): void {
  const tile = document.querySelector<HTMLElement>(`.tile[data-slot="${slot}"]`);
  if (tile) renderTile(tile);
  else renderDocuments(slot);
}

/** Change handler of a document input: type and size check, then the names under the control. */
function pickDocuments(up: HTMLElement, picked: File[]): void {
  const slot = up.dataset.slot as FileSlot;
  const messages: string[] = [];
  const ok = picked.filter((f) => {
    if (!(DOCUMENT_TYPES as readonly string[]).includes(f.type)) {
      messages.push(`${f.name}: only PDF, JPG or PNG.`);
      return false;
    }
    if (f.size > LIMITS.documentMaxBytes) {
      messages.push(`${f.name} is ${mb(f.size)}, the limit is ${mb(LIMITS.documentMaxBytes)}.`);
      return false;
    }
    return true;
  });
  files.replace(
    slot,
    // the object URL backs the Preview link, replace() and remove() revoke it.
    ok.map((f) => ({ name: f.name, type: f.type, size: f.size, blob: f, url: URL.createObjectURL(f) })),
  );
  renderDocuments(slot);
  if (messages.length) note("msgFiles", messages.join(" "));
}

export function initPhotos(options: { onPreview: (slot: FileSlot, index: number) => void }): void {
  preview = options.onPreview;
  for (const tile of document.querySelectorAll<HTMLElement>(".tile[data-slot]")) {
    const input = tile.querySelector<HTMLInputElement>("input[type=file]")!;
    tile.querySelector(".add")!.addEventListener("click", () => input.click());
    input.addEventListener("change", () => void addPhotos(tile, input));
    renderTile(tile);
  }
  for (const up of document.querySelectorAll<HTMLElement>("ui5-file-uploader[data-slot]"))
    up.addEventListener("change", (e) => {
      // UI5 fires change with detail.files, and with an empty list when the selection is cleared.
      const list = (e as CustomEvent<{ files?: FileList | null }>).detail?.files;
      pickDocuments(up, [...(list ?? [])]);
    });
}

/** Metadata of every picked file for submitClaim: slot, name, type, size after compression. */
export function readFiles(): FileInput[] {
  return files.all().map((f) => ({
    slot: f.slot,
    fileName: f.name,
    mimeType: f.type || undefined,
    size: f.size,
  }));
}

/** The bytes for the upload loop after submit, in the same order as readFiles(). */
export function readUploads(): UploadItem[] {
  return files.all().map((f) => ({ slot: f.slot, name: f.name, type: f.type, blob: f.blob }));
}
