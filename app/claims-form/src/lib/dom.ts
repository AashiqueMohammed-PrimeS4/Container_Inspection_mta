// Tiny DOM helpers shared by every step.

/** The shape of the UI5 controls the page reads and marks. */
export type Field = HTMLElement & {
  value?: string;
  valueState?: string;
  checked?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  files?: FileList | null;
};

export const $ = (id: string): Field => document.getElementById(id) as Field;

export const show = (id: string, on: boolean): void => {
  $(id).hidden = !on;
};

/** Spinner on, the action buttons off, and back. */
export const busy = (on: boolean): void => {
  show("busy", on);
  $("btnCode").disabled = on;
  $("btnVerify").disabled = on;
  $("btnSubmit").disabled = on;
};

/** Value of the checked radio button in a group, undefined when none is checked. */
export const radio = (name: string): string | undefined =>
  [...document.querySelectorAll<Field>(`ui5-radio-button[name="${name}"]`)].find((r) => r.checked)?.value;
