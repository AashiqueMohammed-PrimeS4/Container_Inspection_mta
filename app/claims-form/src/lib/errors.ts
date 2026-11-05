// Error display.
import { $, type Field } from "./dom";
import type { ApiError, ApiErrorDetail } from "../api/client";
import { describeLimit, LABELS } from "../models/claim";

/** One marked field: the control, the controls that carry the value state, the red line, the popover text. */
type Marked = { control: Field; group: Field[]; line: HTMLElement; slot?: HTMLElement };
const marked = new Map<string, Marked>();

/** UI5 2.27 controls with a valueStateMessage slot. */
const WITH_SLOT = new Set(["UI5-INPUT", "UI5-TEXTAREA", "UI5-SELECT", "UI5-DATE-PICKER"]);

/** Editing one of these also clears the error of the other. */
const ALSO_CLEARS: Record<string, string> = { delivery: "salesOrder", EV_09: "files" };

/** Element id for an OData target. */
const fieldOf = (target = ""): string => (target === "claim/email" ? "emailEcho" : (target.split("/").pop() ?? ""));

/** CAP type errors ("Value 2.5 is not a valid Decimal(13)") get the field label and limit instead. */
const isTypeError = (d: ApiErrorDetail): boolean =>
  /ASSERT/.test(d.code ?? "") || /^Value .*(is not a valid|exceeds)/.test(d.message ?? "");

function humanize(d: ApiErrorDetail): string {
  if (!isTypeError(d)) return d.message;
  const field = (d.target ?? "").split("/").pop() ?? "";
  const limit = describeLimit(field);
  return `${LABELS[field] ?? "This field"}: check this value${limit ? ` (${limit})` : ""}`;
}

/** Marks one field. */
function mark(name: string, control: Field, message: string): void {
  const known = marked.get(name);
  if (known) {
    known.line.textContent += ` ${message}`;
    if (known.slot) known.slot.textContent = known.line.textContent;
    return;
  }
  // A radio group is marked through its .field wrapper, which carries the group name as id.
  const group = control.classList.contains("field") ? [...control.querySelectorAll<Field>("ui5-radio-button")] : [control];
  for (const c of group) if ("valueState" in c) c.valueState = "Negative";

  const line = document.createElement("span");
  line.className = "field-error";
  line.id = `${name}-error`;
  line.textContent = message; // textContent, messages can echo customer input
  const field = control.closest<HTMLElement>(".field");
  if (control.parentElement === field) control.after(line); // right under the control, also for each checkbox
  else if (field) field.append(line); // radio group, currency + value pair
  else control.after(line); // the photo tiles grid

  let slot: HTMLElement | undefined;
  if (WITH_SLOT.has(control.tagName)) {
    slot = document.createElement("div");
    slot.slot = "valueStateMessage";
    slot.textContent = message;
    control.append(slot);
  }
  marked.set(name, { control, group, line, slot });
}

/** Red count per section in the sections menu, from the marked fields. */
function updateBadges(): void {
  for (const badge of document.querySelectorAll<HTMLElement>("aside .badge")) {
    const section = badge.dataset.section;
    const n = [...marked.values()].filter((m) => m.line.closest("section")?.id === section).length;
    badge.textContent = String(n);
    badge.title = `${n} ${n === 1 ? "field needs" : "fields need"} attention`;
    badge.hidden = n === 0;
  }
}

/** Marks every detail whose target is a field on the page. */
export function showFieldErrors(details: ApiErrorDetail[]): ApiErrorDetail[] {
  const rest: ApiErrorDetail[] = [];
  for (const d of details) {
    const name = fieldOf(d.target);
    const control = name ? $(name) : null;
    if (control) mark(name, control, humanize(d));
    else rest.push(d);
  }
  updateBadges();
  return rest;
}

/** Scrolls to the first marked field in page order and focuses it, which opens its value state popover. */
export function focusFirstError(): void {
  const first = [...marked.values()].sort((a, b) =>
    a.line.compareDocumentPosition(b.line) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
  )[0];
  if (!first) return;
  const target = first.control.id === "files" ? first.control.querySelector<HTMLElement>(".add") : (first.group[0] ?? first.control);
  (target ?? first.control).scrollIntoView({ block: "center" });
  target?.focus({ preventScroll: true });
}

/** An error with no field: a Negative strip, scrolled into view. */
export function showGlobalError(message: string, stripId = "msg2"): void {
  const strip = $(stripId) as Field & { design?: string };
  strip.design = "Negative";
  strip.textContent = message;
  strip.hidden = false;
  strip.scrollIntoView({ block: "center" });
}

/** Entry point for a failed call: field errors inline, the rest in the strip of the current step. */
export function showCallError(e: unknown, stripId: string): void {
  // fetch rejects with a TypeError when the connection drops, the server answers with an ApiError.
  if (e instanceof TypeError) {
    showGlobalError("No connection to the server. Check your connection and try again.", stripId);
    return;
  }
  const error = (e ?? {}) as ApiError;
  const details = error.details?.length ? error.details : [error];
  const rest = showFieldErrors(details);
  if (rest.length) showGlobalError(rest.map((d) => d.message || "Something went wrong").join(" "), stripId);
  else focusFirstError();
}

/** Removes the error of one field. */
export function clearFieldError(name: string): void {
  for (const n of [name, ALSO_CLEARS[name]]) {
    const m = n ? marked.get(n) : undefined;
    if (!m) continue;
    m.line.remove();
    m.slot?.remove();
    for (const c of m.group) c.valueState = "None";
    marked.delete(n!);
  }
  updateBadges();
}

/** Clears a field's error on its first input or change. */
export function clearOnEdit(root: HTMLElement): void {
  const handler = (e: Event) => {
    const el = e.target as Field & { name?: string };
    const name = el.tagName === "UI5-RADIO-BUTTON" ? el.name : el.id;
    if (name) clearFieldError(name);
  };
  root.addEventListener("input", handler);
  root.addEventListener("change", handler);
}

/** Information text in a message strip. */
export function note(stripId: string, text: string): void {
  const strip = $(stripId) as Field & { design?: string };
  strip.design = "Information";
  strip.textContent = text;
  strip.hidden = false;
}

/** Every field error and every strip off, before a new call. */
export function clearStates(): void {
  for (const name of [...marked.keys()]) clearFieldError(name);
  for (const id of ["msg1", "msg2", "msgFiles"]) {
    const strip = $(id) as (Field & { design?: string }) | null;
    if (!strip) continue;
    strip.hidden = true;
    if (id !== "msgFiles") strip.design = "Negative"; // a note may have turned it blue
  }
}
