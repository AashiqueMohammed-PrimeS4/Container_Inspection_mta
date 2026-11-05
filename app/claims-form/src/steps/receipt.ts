// Step 3: the receipt.
import { call, type ApiError } from "../api/client";
import { toBase64 } from "../lib/compress";
import { $, show } from "../lib/dom";
import { log } from "../lib/log";
import type { ClaimReceipt, UploadItem, UploadResult } from "../models/claim";

/** What every uploadFile call carries besides the file itself. */
export type UploadContext = { caseId: string; email: string; formToken: string };

let context: UploadContext | null = null;
let failed: { item: UploadItem; message: string }[] = [];
let uploaded = 0;
let running = false;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

// Leaving the page while files are still in the browser loses them.
window.addEventListener("beforeunload", (e) => {
  if (running || failed.length) e.preventDefault();
});

export function showReceipt(receipt: ClaimReceipt): void {
  $("caseId").textContent = receipt.caseId;
}

function renderFailures(): void {
  const ul = $("uploadFailed");
  ul.replaceChildren(
    ...failed.map(({ item, message }) => {
      const li = document.createElement("li");
      li.textContent = `${item.name}: ${message}`; // textContent, names come from the customer's disk
      return li;
    }),
  );
  ul.hidden = failed.length === 0;
  show("btnRetry", failed.length > 0 && !running);
}

/** Uploads the given files one after the other. */
async function run(items: UploadItem[]): Promise<void> {
  if (!context) return;
  running = true;
  failed = [];
  renderFailures();
  $("btnNew").disabled = true;
  try {
    for (const [i, item] of items.entries()) {
      $("uploadStatus").textContent = `Uploading ${i + 1} of ${items.length}: ${item.name}`;
      try {
        const content = await toBase64(item.blob);
        await call<UploadResult>("uploadFile", {
          caseId: context.caseId,
          formToken: context.formToken,
          email: context.email,
          slot: item.slot,
          fileName: item.name,
          mimeType: item.type,
          content,
        });
        uploaded++;
      } catch (e) {
        // fetch rejects with a TypeError when the connection drops, the server answers with an ApiError.
        const message = e instanceof TypeError ? "no connection to the server" : (e as ApiError)?.message || "upload failed";
        log.warn("upload failed", item.name, e);
        failed.push({ item, message });
      }
    }
  } finally {
    running = false;
    $("btnNew").disabled = false;
  }
  $("uploadStatus").textContent = failed.length
    ? `${plural(uploaded, "file")} uploaded, ${failed.length} failed. Check your connection and retry.`
    : uploaded
      ? `${plural(uploaded, "file")} uploaded.`
      : "";
  renderFailures();
}

/** Called by main.ts right after the receipt is on screen. */
export async function uploadAll(ctx: UploadContext, items: UploadItem[]): Promise<void> {
  context = ctx;
  uploaded = 0;
  await run(items);
}

/** "File another claim" starts over with a fresh page. */
export function initReceipt(): void {
  $("btnNew").addEventListener("click", () => location.reload());
  $("btnRetry").addEventListener("click", () => void run(failed.map((f) => f.item)));
}
