// Entry point: gate, form, receipt. The steps never import each other.
import "./ui5";
import { call } from "./api/client";
import { $, busy, show } from "./lib/dom";
import { clearOnEdit, clearStates, focusFirstError, showCallError, showFieldErrors } from "./lib/errors";
import type { ClaimReceipt } from "./models/claim";
import { initGate, resetGate } from "./steps/gate";
import { checkRequired, initForm, readClaim } from "./steps/form";
import { initPhotos, readFiles, readUploads, renderSlot } from "./steps/photos";
import { initPreview, openPreview } from "./steps/preview";
import { initReceipt, showReceipt, uploadAll } from "./steps/receipt";

// Recorded once when the page loads.
const formOpenedAt = new Date().toISOString();

// Issued by verifyCode, sent with submitClaim.
let formToken: string | null = null;

initForm();
// Thumbnail opens the lightbox; Remove redraws the tile.
initPhotos({ onPreview: openPreview });
initPreview({ onRemoved: renderSlot });
initReceipt();
clearOnEdit($("step-claim"));

// Step 1 to 2: code verified, open the form with the email read-only.
initGate((email, token) => {
  formToken = token;
  $("emailEcho").value = email;
  show("step-email", false);
  show("step-claim", true);
  $("companyName").focus();
});

// "Change email": back to the gate, the token is dropped and the email must be verified again.
$("btnBack").addEventListener("click", () => {
  clearStates();
  formToken = null;
  resetGate();
  show("step-claim", false);
  show("step-email", true);
});

// Step 2 to 3: submit, show the case ID, then upload the files.
$("btnSubmit").addEventListener("click", async () => {
  clearStates();
  if (!formToken) return; // the form is only reachable through the gate
  const claim = readClaim(readFiles(), formOpenedAt, formToken);
  const missing = checkRequired(claim);
  if (missing.length) {
    showFieldErrors(missing);
    focusFirstError();
    return;
  }
  let receipt: ClaimReceipt;
  busy(true);
  try {
    receipt = await call<ClaimReceipt>("submitClaim", { claim });
  } catch (e) {
    showCallError(e, "msg2");
    return;
  } finally {
    busy(false);
  }
  showReceipt(receipt);
  show("step-claim", false);
  show("step-done", true);
  window.scrollTo(0, 0);
  await uploadAll({ caseId: receipt.caseId, email: claim.email, formToken }, readUploads());
});
