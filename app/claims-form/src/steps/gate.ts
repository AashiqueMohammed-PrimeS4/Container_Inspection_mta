// Step 1, the gate: email, "Send code", then the code and "Verify and continue".
import { call } from "../api/client";
import { $, busy, show } from "../lib/dom";
import { clearOnEdit, clearStates, showCallError } from "../lib/errors";
import type { VerifyResult } from "../models/claim";

const email = (): string => ($("email").value ?? "").trim();

/** Phase 1 to 2: email read-only, code field and Verify button shown. */
function showCodePhase(on: boolean): void {
  $("email").readonly = on;
  show("codeField", on);
  show("btnCode", !on);
  show("btnVerify", on);
}

/** requestCode for the typed email. */
async function sendCode(): Promise<void> {
  clearStates();
  busy(true);
  try {
    await call("requestCode", { email: email() });
    showCodePhase(true);
    $("code").focus();
  } catch (e) {
    showCallError(e, "msg1"); // "Enter a valid email address" lands under the email field
  } finally {
    busy(false);
  }
}

/** Wires the gate. */
export function initGate(onVerified: (email: string, token: string) => void): void {
  clearOnEdit($("step-email"));
  $("btnCode").addEventListener("click", sendCode);
  $("btnResend").addEventListener("click", sendCode);

  $("btnVerify").addEventListener("click", async () => {
    clearStates();
    busy(true);
    try {
      const { token } = await call<VerifyResult>("verifyCode", {
        email: email(),
        code: ($("code").value ?? "").trim(),
      });
      onVerified(email(), token);
    } catch (e) {
      showCallError(e, "msg1"); // "Invalid or expired code" lands under the code field
    } finally {
      busy(false);
    }
  });
}

/** Back to phase 1 with an editable email and an empty code. */
export function resetGate(): void {
  $("code").value = "";
  showCodePhase(false);
}
