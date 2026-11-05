// Mirror of the PublicClaimsService types in the service (srv/claims.cds).

/** File slots, db.FileSlot. */
export const PHOTO_SLOTS = ["EV_01", "EV_02", "EV_03", "EV_04", "EV_05", "EV_06"] as const;
export const DOCUMENT_SLOTS = ["EV_07", "EV_08", "EV_09", "EV_10"] as const;
export type FileSlot = (typeof PHOTO_SLOTS)[number] | (typeof DOCUMENT_SLOTS)[number];

/** Photo and document limits. */
export const LIMITS = {
  photosPerSlot: 5,
  longSidePx: 1600,
  jpegQuality: 0.8,
  skipCompressionBelow: 400 * 1024, // already small and within 1600 px: sent as picked
  documentMaxBytes: 10 * 1024 * 1024,
} as const;

/** Accepted types. */
export const PHOTO_TYPES = ["image/jpeg", "image/png"] as const;
export const DOCUMENT_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const;

/** Field labels, the same map as the service validation. */
export const LABELS: Record<string, string> = {
  companyName: "Company name",
  customerAccountNumber: "Customer account number",
  contactName: "Contact name",
  email: "Email",
  phone: "Phone",
  preferredContactMethod: "Preferred contact method",
  ccEmails: "CC emails",
  salesOrder: "Sales order number",
  lineItem: "Line item",
  delivery: "Delivery number",
  lotBatchNumber: "Batch number",
  customerPoNumber: "Customer PO number",
  carrierNumber: "Carrier number",
  sealNumber: "Seal number",
  shipment: "Shipment number",
  carrier_code: "Carrier / shipping company",
  billOfLading: "Bill of lading / tracking number",
  deliveryLocation: "Delivery location / plant",
  shipDate: "Ship date",
  dateReceived: "Date received / unloaded",
  reason: "Reason for claim",
  reasonOther: "Other reason",
  issueFoundWhen: "When the issue was found",
  description: "Description",
  damageNotedOnReceipt: "Damage noted on delivery receipt",
  carrierNotified: "Carrier notified",
  dateCarrierNotified: "Date carrier notified",
  materialNumber: "Product / material number",
  quantityOrdered: "Quantity ordered",
  quantityAffected: "Quantity affected",
  unitOfMeasure_code: "Unit of measure",
  currency_code: "Currency",
  estimatedClaimValue: "Estimated claim value",
  requestedResolution: "Requested resolution",
  productLocation: "Current product location",
  files: "Photos and documents",
  accuracyDeclared: "Accuracy declaration",
  privacyConsented: "Contact consent and privacy notice",
  code: "Verification code",
};

/** Required = Yes in the FS, the same list as the service without the form token. */
export const REQUIRED_FIELDS = [
  "companyName",
  "contactName",
  "phone",
  "lotBatchNumber",
  "carrierNumber",
  "sealNumber",
  "carrier_code",
  "deliveryLocation",
  "dateReceived",
  "reason",
  "issueFoundWhen",
  "description",
  "materialNumber",
  "unitOfMeasure_code",
  "requestedResolution",
  "productLocation",
] as const satisfies readonly (keyof ClaimInput)[];

/** Max lengths of ClaimInput, the same numbers as the service. */
export const MAX_LENGTHS: Record<string, number> = {
  companyName: 25,
  customerAccountNumber: 10,
  contactName: 50,
  email: 100,
  phone: 20,
  ccEmails: 225,
  salesOrder: 10,
  lineItem: 6,
  delivery: 10,
  lotBatchNumber: 10,
  customerPoNumber: 35,
  carrierNumber: 35,
  sealNumber: 20,
  shipment: 35,
  carrier_code: 10,
  billOfLading: 35,
  deliveryLocation: 40,
  reasonOther: 100,
  description: 225,
  materialNumber: 40,
  unitOfMeasure_code: 3,
  currency_code: 3,
};

/** The rule behind a CDS type, for messages like "Company name: check this value (at most 25 characters)". */
export function describeLimit(field: string): string | undefined {
  if (MAX_LENGTHS[field]) return `at most ${MAX_LENGTHS[field]} characters`;
  if (field === "quantityOrdered" || field === "quantityAffected") return "whole number";
  if (field === "estimatedClaimValue") return "at most 3 decimals";
  if (["shipDate", "dateReceived", "dateCarrierNotified"].includes(field)) return "date as YYYY-MM-DD";
  return undefined;
}

export type FileInput = {
  slot: string;
  fileName: string;
  mimeType?: string;
  size: number;
};

export type ClaimInput = {
  // Section 1, Contact details
  companyName?: string;
  customerAccountNumber?: string;
  contactName?: string;
  email: string;
  phone?: string;
  preferredContactMethod?: string;
  ccEmails?: string;
  // Section 2, Order and shipment
  salesOrder?: string;
  lineItem?: string;
  delivery?: string;
  lotBatchNumber?: string;
  customerPoNumber?: string;
  carrierNumber?: string;
  sealNumber?: string;
  shipment?: string;
  carrier_code?: string;
  billOfLading?: string;
  deliveryLocation?: string;
  shipDate?: string;
  dateReceived?: string;
  // Section 3, Claim details
  reason?: string;
  reasonOther?: string;
  issueFoundWhen?: string;
  description?: string;
  damageNotedOnReceipt?: boolean;
  carrierNotified?: boolean;
  dateCarrierNotified?: string;
  // Section 4, Quantity and value
  materialNumber?: string;
  quantityOrdered?: number; // whole number, Decimal(13,0)
  quantityAffected?: number; // whole number, Decimal(13,0)
  unitOfMeasure_code?: string;
  currency_code?: string;
  estimatedClaimValue?: number; // Decimal(14,3)
  requestedResolution?: string;
  productLocation?: string;
  // Section 5, Photos and documents: metadata only, the bytes follow with uploadFile.
  files: FileInput[];
  // Section 6, Review and submit
  accuracyDeclared?: boolean;
  privacyConsented?: boolean;
  // Bot filters and the form token from verifyCode
  formToken: string;
  website?: string;
  formOpenedAt: string;
};

/** Answer of verifyCode. */
export type VerifyResult = {
  token: string;
};

export type ClaimReceipt = {
  caseId: string;
  status: string;
};

/** One file of the upload loop after submit. */
export type UploadItem = {
  slot: FileSlot;
  name: string;
  type: string;
  blob: Blob;
};

/** Answer of uploadFile. */
export type UploadResult = {
  stored: boolean;
  fileId: string;
};
