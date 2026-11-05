// Photo lightbox: previous / next within a slot, Remove and Close.
import { $ } from "../lib/dom";
import type { FileSlot } from "../models/claim";
import * as files from "../state/files";

type Options = {
  /** Called after Remove took a file out of the slot state. */
  onRemoved: (slot: FileSlot) => void;
};

type Dialog = HTMLElement & { open: boolean; stretch: boolean; headerText: string };
type Button = HTMLElement & { disabled: boolean };

const kb = (bytes: number) => `${Math.round(bytes / 1024)} KB`;
const isImage = (type: string) => type.startsWith("image/");

let onRemoved: Options["onRemoved"] = () => {};
let slot: FileSlot | null = null;
let pos = 0; // position among the images of the slot, not the index in the slot list

const dialog = () => $("preview") as Dialog;

/** Images of the open slot with their index in files.list(slot), the index Remove needs. */
const images = () =>
  slot
    ? files
        .list(slot)
        .map((f, index) => ({ ...f, index }))
        .filter((f) => isImage(f.type) && f.url)
    : [];

/** Tile title for photos, the field label for documents. */
const category = (s: FileSlot): string =>
  (document.querySelector(`.tile[data-slot="${s}"] .name`) ?? document.querySelector(`ui5-label[for="${s}"]`))?.textContent?.trim() ?? "";

function render(): void {
  const items = images();
  if (!slot || !items.length) {
    dialog().open = false;
    return;
  }
  pos = Math.min(Math.max(pos, 0), items.length - 1);
  const f = items[pos]!;
  dialog().headerText = category(slot);
  const img = $("previewImg") as HTMLImageElement & { src: string };
  img.src = f.url!;
  img.alt = f.name; // property, the name never goes through innerHTML
  $("previewName").textContent = f.name;
  $("previewMeta").textContent = `${kb(f.size)}, ${pos + 1} of ${items.length}`;
  ($("previewPrev") as Button).disabled = pos === 0;
  ($("previewNext") as Button).disabled = pos === items.length - 1;
}

function step(by: number): void {
  const next = pos + by;
  if (next < 0 || next >= images().length) return;
  pos = next;
  render();
}

/** Opens the lightbox on files.list(s)[index]. */
export function openPreview(s: FileSlot, index: number): void {
  slot = s;
  const at = images().findIndex((f) => f.index === index);
  if (at < 0) return;
  pos = at;
  // Full screen on a phone, the default centred dialog elsewhere.
  dialog().stretch = matchMedia("(max-width: 600px)").matches;
  render();
  dialog().open = true;
}

export function initPreview(options: Options): void {
  onRemoved = options.onRemoved;
  $("previewPrev").addEventListener("click", () => step(-1));
  $("previewNext").addEventListener("click", () => step(1));
  $("previewClose").addEventListener("click", () => {
    dialog().open = false;
  });
  $("previewRemove").addEventListener("click", () => {
    const f = images()[pos];
    if (!slot || !f) return;
    files.remove(slot, f.index); // also revokes the object URL the <img> shows
    onRemoved(slot);
    render(); // the next image takes its place, the dialog closes when the slot is empty
  });
  // Escape is handled by ui5-dialog itself (it closes the topmost popup).
  document.addEventListener("keydown", (e) => {
    if (!dialog().open) return;
    if (e.key === "ArrowLeft") step(-1);
    else if (e.key === "ArrowRight") step(1);
    else return;
    e.preventDefault();
  });
  dialog().addEventListener("close", () => {
    slot = null;
    $("previewImg").removeAttribute("src");
  });
}
