// Page state for picked files, one list per slot. input.files is replaced on every selection.
import type { FileSlot } from "../models/claim";

/** A picked file, after compression for photos. url is an object URL for the thumbnail or the Preview link. */
export type PickedFile = {
  name: string;
  type: string;
  size: number;
  blob: Blob;
  url: string | null;
};

const picked = new Map<FileSlot, PickedFile[]>();

/** The live list for a slot. */
export const list = (slot: FileSlot): readonly PickedFile[] => picked.get(slot) ?? [];

export const count = (slot: FileSlot): number => list(slot).length;

export function add(slot: FileSlot, file: PickedFile): void {
  picked.set(slot, [...list(slot), file]);
}

/** Removes one file and frees its thumbnail URL. */
export function remove(slot: FileSlot, index: number): void {
  const items = [...list(slot)];
  const [gone] = items.splice(index, 1);
  if (gone?.url) URL.revokeObjectURL(gone.url);
  picked.set(slot, items);
}

/** Replaces a slot, used by the document inputs where a new choice replaces the old one. */
export function replace(slot: FileSlot, files: PickedFile[]): void {
  for (const f of list(slot)) if (f.url) URL.revokeObjectURL(f.url);
  picked.set(slot, files);
}

/** Every picked file in slot order, tagged with its slot. */
export function all(): (PickedFile & { slot: FileSlot })[] {
  return [...picked.entries()].sort(([a], [b]) => a.localeCompare(b)).flatMap(([slot, items]) => items.map((f) => ({ slot, ...f })));
}
