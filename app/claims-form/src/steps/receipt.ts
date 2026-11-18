// Step 3: the receipt. It shows the upload progress first and the final receipt when every file is stored.
import { call, type ApiError } from "../api/client";
import { toBase64 } from "../lib/compress";
import { $, show } from "../lib/dom";
import { log } from "../lib/log";
import type { ClaimReceipt, UploadItem, UploadResult } from "../models/claim";

/** What every uploadFile call carries besides the file itself. */
export type UploadContext = { caseId: string; email: string; formToken: string };

type Strip = HTMLElement & { design: string };
type Progress = HTMLElement & { value: number; displayValue: string; valueState: string };

/** Waits before the extra tries of one file. Only for a lost connection or a 5xx answer. */
const RETRY_WAITS_MS = [2000, 5000];

let context: UploadContext | null = null;
let failed: { item: UploadItem; message: string }[] = [];
let uploaded = 0;
let total = 0;
let running = false;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** A 400 (wrong type, too big, session expired) fails again on a retry, so only these are retried. */
const isTransient = (e: unknown) => e instanceof TypeError || ((e as ApiError)?.status ?? 0) >= 500;

// Leaving the page while files are still in the browser loses them.
window.addEventListener("beforeunload", (e) => {
  if (running || failed.length) e.preventDefault();
});

function setStrip(design: string, text: string): void {
  const strip = document.getElementById("doneStrip") as Strip;
  strip.design = design;
  strip.textContent = text;
}

function setProgress(valueState = "None"): void {
  const bar = document.getElementById("uploadProgress") as Progress;
  bar.value = total ? Math.round((uploaded / total) * 100) : 100;
  bar.displayValue = `${uploaded} of ${plural(total, "file")}`;
  bar.valueState = valueState;
}

export function showReceipt(receipt: ClaimReceipt): void {
  $("caseId").textContent = receipt.caseId;
  setStrip("Information", "Your claim is created. Uploading your files. Keep this page open until the upload is complete.");
  show("btnNew", false);
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
  show("btnSkip", failed.length > 0 && !running);
}

/** One file, with up to two extra tries after a lost connection or a server error. */
async function uploadOne(item: UploadItem): Promise<void> {
  if (!context) return;
  const content = await toBase64(item.blob);
  for (let attempt = 0; ; attempt++) {
    try {
      await call<UploadResult>("uploadFile", {
        caseId: context.caseId,
        formToken: context.formToken,
        email: context.email,
        slot: item.slot,
        fileName: item.name,
        mimeType: item.type,
        content,
      });
      return;
    } catch (e) {
      const wait = RETRY_WAITS_MS[attempt];
      if (wait === undefined || !isTransient(e)) throw e;
      log.warn("upload retry", item.name, attempt + 1, e);
      $("uploadStatus").textContent = `Retrying ${item.name}...`;
      await sleep(wait);
    }
  }
}

/** The final receipt. skipped is the number of files the customer chose to leave out. */
function finish(skipped = 0): void {
  setStrip(
    skipped ? "Critical" : "Positive",
    skipped
      ? `Your claim is registered without ${plural(skipped, "file")}. A confirmation has been sent to your email.`
      : "Your claim is registered. A confirmation has been sent to your email.",
  );
  setProgress(skipped ? "Critical" : "Positive");
  $("uploadStatus").textContent = `${plural(uploaded, "file")} uploaded.`;
  show("btnNew", true);
}

/** Uploads the given files one after the other. */
async function run(items: UploadItem[]): Promise<void> {
  if (!context) return;
  running = true;
  failed = [];
  renderFailures();
  setStrip("Information", "Your claim is created. Uploading your files. Keep this page open until the upload is complete.");
  setProgress();
  try {
    for (const item of items) {
      $("uploadStatus").textContent = `Uploading ${item.name}`;
      try {
        await uploadOne(item);
        uploaded++;
      } catch (e) {
        // fetch rejects with a TypeError when the connection drops, the server answers with an ApiError.
        const message = e instanceof TypeError ? "no connection to the server" : (e as ApiError)?.message || "upload failed";
        log.warn("upload failed", item.name, e);
        failed.push({ item, message });
      }
      setProgress();
    }
  } finally {
    running = false;
  }
  renderFailures();
  if (!failed.length) return finish();
  setStrip(
    "Critical",
    `${plural(failed.length, "file")} could not be uploaded. Your claim is not complete without ${failed.length === 1 ? "it" : "them"}. Check your connection and retry.`,
  );
  setProgress("Critical");
  $("uploadStatus").textContent = `${plural(uploaded, "file")} uploaded, ${failed.length} failed.`;
}

/** Called by main.ts right after the receipt is on screen. */
export async function uploadAll(ctx: UploadContext, items: UploadItem[]): Promise<void> {
  context = ctx;
  uploaded = 0;
  total = items.length;
  await run(items);
}

/** "File another claim" starts over with a fresh page. */
export function initReceipt(): void {
  $("btnNew").addEventListener("click", () => location.reload());
  $("btnRetry").addEventListener("click", () => void run(failed.map((f) => f.item)));
  $("btnSkip").addEventListener("click", () => {
    const skipped = failed.length;
    if (!confirm(`Finish without ${plural(skipped, "file")}? Our team sees the claim without them.`)) return;
    failed = [];
    renderFailures();
    finish(skipped);
  });
}
