// Step 2: the six-section form.
import { fillSelect } from "../api/client";
import { $, radio, show } from "../lib/dom";
import type { ApiErrorDetail } from "../api/client";
import { LABELS, REQUIRED_FIELDS, type ClaimInput, type FileInput } from "../models/claim";

export function initForm(): void {
  fillSelect("carrier_code", "/public/Carriers?$select=code,name&$orderby=name");
  fillSelect("unitOfMeasure_code", "/public/UnitsOfMeasure?$select=code,name&$orderby=name");

  // Whole numbers, Decimal(13,0) in S/4. ui5-input has no step property, so set it on the inner input.
  for (const id of ["quantityOrdered", "quantityAffected"]) Object.assign($(id), { _nativeInputAttributes: { min: 0, step: 1 } });
  Object.assign($("estimatedClaimValue"), {
    _nativeInputAttributes: { min: 0, step: 0.001 },
  }); // ClaimValue Decimal(14,3)

  // FS section 5: conditional fields
  $("reason").addEventListener("change", () => {
    const r = $("reason").value;
    show("reasonOtherField", r === "other");
    show("EV_09Field", r === "temperature_deviation");
  });
  for (const r of document.querySelectorAll('ui5-radio-button[name="carrierNotified"]'))
    r.addEventListener("change", () => show("dateCarrierNotifiedField", radio("carrierNotified") === "true"));
}

/** Reads every field into the submitClaim payload. */
export function readClaim(files: FileInput[], formOpenedAt: string, formToken: string): ClaimInput {
  const v = (id: string) => $(id).value?.trim() || undefined;
  const num = (id: string) => ($(id).value?.trim() ? Number($(id).value) : undefined);
  const bool = (name: string) => (radio(name) === undefined ? undefined : radio(name) === "true");
  return {
    companyName: v("companyName"),
    customerAccountNumber: v("customerAccountNumber"),
    contactName: v("contactName"),
    email: ($("email").value ?? "").trim(),
    phone: v("phone"),
    preferredContactMethod: v("preferredContactMethod"),
    ccEmails: v("ccEmails"),
    salesOrder: v("salesOrder"),
    lineItem: v("lineItem"),
    delivery: v("delivery"),
    lotBatchNumber: v("lotBatchNumber"),
    customerPoNumber: v("customerPoNumber"),
    carrierNumber: v("carrierNumber"),
    sealNumber: v("sealNumber"),
    shipment: v("shipment"),
    carrier_code: v("carrier_code"),
    billOfLading: v("billOfLading"),
    deliveryLocation: v("deliveryLocation"),
    shipDate: v("shipDate"),
    dateReceived: v("dateReceived"),
    reason: v("reason"),
    reasonOther: v("reasonOther"),
    issueFoundWhen: v("issueFoundWhen"),
    description: v("description"),
    damageNotedOnReceipt: bool("damageNotedOnReceipt"),
    carrierNotified: bool("carrierNotified"),
    dateCarrierNotified: v("dateCarrierNotified"),
    materialNumber: v("materialNumber"),
    quantityOrdered: num("quantityOrdered"),
    quantityAffected: num("quantityAffected"),
    unitOfMeasure_code: v("unitOfMeasure_code"),
    currency_code: v("currency_code"),
    estimatedClaimValue: num("estimatedClaimValue"),
    requestedResolution: v("requestedResolution"),
    productLocation: v("productLocation"),
    files,
    accuracyDeclared: $("accuracyDeclared").checked,
    privacyConsented: $("privacyConsented").checked,
    formToken,
    website: $("website").value,
    formOpenedAt,
  };
}

/** The required rules of the service, same messages and targets. */
export function checkRequired(c: ClaimInput): ApiErrorDetail[] {
  const errors: ApiErrorDetail[] = [];
  const report = (message: string, field: string) => errors.push({ message, target: `claim/${field}` });
  const missing = (field: string) => report(`${LABELS[field]} is required`, field);

  for (const field of REQUIRED_FIELDS) if (!String(c[field] ?? "").trim()) missing(field);
  if (typeof c.damageNotedOnReceipt !== "boolean") missing("damageNotedOnReceipt"); // CL-05
  if (!(Number(c.quantityAffected) > 0)) report("Quantity affected must be greater than 0", "quantityAffected"); // QV-03
  if (!c.salesOrder && !c.delivery) report("Provide a sales order or delivery number", "salesOrder"); // FR-02
  const slots = c.files.map((f) => f.slot);
  if (c.reason === "other" && !c.reasonOther) missing("reasonOther"); // CL-02
  if (c.reason === "temperature_deviation" && !slots.includes("EV_09")) report("Temperature logger data is required", "files"); // EV-09
  if (c.estimatedClaimValue != null && !c.currency_code) missing("currency_code"); // QV-05
  if (!slots.some((s) => /^EV_0[1-6]$/.test(s))) report("At least one photo is required", "files"); // FR-05
  for (const field of ["accuracyDeclared", "privacyConsented"] as const) // RS-01, RS-02
    if (!c[field]) report(`${LABELS[field]} must be accepted`, field);
  return errors;
}
