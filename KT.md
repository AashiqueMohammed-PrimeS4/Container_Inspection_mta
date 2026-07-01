# SmartInspect MTA — Knowledge Transfer Document

---

## What is this project?

So basically what I've built here is a full SAP BTP multi-target application — we call it SmartInspect — which is a container and carrier inspection platform. The idea is simple: field operators go out, inspect shipping containers, capture everything digitally, and supervisors back in the office get a live analytics dashboard. The whole thing runs on SAP BTP, connects to an S/4HANA backend, and has some AI features layered on top.

As i Said its a Multi-Target Application — which means it's one deployable unit that packages two separate Fiori apps plus all the configuration, destinations, and routing in one shot.

---

## The Two Apps

### 1. insptrack — "SmartInspect Operations"

This is the field operator app. Think of it as the mobile-first app that a port worker or logistics guy uses on-site. When they pick up a container for inspection, they open this app and go through a three-step wizard.

**Step 1 — Document Details:** They enter the document number, sequence number, and carrier number. There's also a camera icon where they can literally point the phone at the container and scan it using OCR — the app calls a crop microservice first to detect and isolate the container in the photo, then passes it to an OCR service that reads the container number using ISO 6346 format and auto-fills the field. So no manual typing needed for the container number.

**Step 2 — Inspection Codes:** They pick defect codes from a predefined list — things like dents, rust, damage types. We also have AI-powered defect detection here where an image of the container gets analyzed and defects are auto-suggested.

**Step 3 — Images:** They capture before and after images of the container. These get uploaded as PDFs to the backend content server using a special stream endpoint. After all this, they either Accept or Reject the container, and the inspection record is saved to the backend.

### 2. carrieranalytics — "SmartInspect Insights"

This is the supervisor dashboard. It reads all the inspections created by the field app and gives you analytics — accepted vs rejected counts, trend charts over date ranges, drill-down reports per container.

There's also an AI chatbot here called **PRIVA Assist** — it's a floating button in the top right. Supervisors can ask it natural language questions like "What's the rejection rate this week?" and it answers using the inspection data. The chatbot connects to a CAP-based microservice that internally calls an LLM (Groq) to generate the response.

There's also an AI Summary page that generates insights and trend analysis automatically using data from the backend.

---

## The Backend

Both apps share a single ABAP OData service: `PWXSI_INSPECTION_ANALYTIC_APP_SRV`, hosted on the S/4HANA system. The URL pattern is `/sap/opu/odata/PWXSI/INSPECTION_ANALYTIC_APP_SRV/` — note that `PWXSI` replaces the usual `sap` segment in the URL, which is easy to get wrong if you're used to standard SAP services.

This service was actually migrated recently from an older service called `ZINSPECTION_APP_SRV`. Same backend logic, but renamed entities and new tables. The key things that changed during migration:
- `InspectCodesSet` became `InspectCodeSet`
- `InspectionInsight2Set` was merged into `InspectionInsightSet`
- The header table changed from `ZTINSP_HEADER` to `/PWXSI/T_HEADER`

The main entity sets we use are: `InspectionHeaderSet` (the core record, keyed by Document + Sequence + Carrier + Date), `InspectCodeSet` (the defect codes), `AttachmentSet` (before/after images uploaded as PDF streams), `VH_CarrierlineSet`, `VH_CarrierTypeSet`, `InspectionInsightSet`, `CarrierInspReportSet`, and the two new ones we added — `SI_LicenseSet` and `SI_UsageSet` which I'll explain in a moment.

---

## The Microservices

Apart from the ABAP backend, there's a separate CAP-based microservice layer deployed on BTP. This is what handles:

- **OCR** — container number extraction from images
- **Defect Detection** — AI-based defect classification
- **Crop Service** — isolates the container from a photo before passing to OCR
- **PRIVA Assist** — the chatbot / LLM agent (uses Groq internally)

These are all behind a single destination called `CROP_SERVICE` in the BTP subaccount. The insptrack app talks to the crop and OCR services; the carrieranalytics app talks to the PRIVA agent via a separate `inspectionModel` datasource.

---

## License Management — What We Just Built

This was a big chunk of recent work. The backend team added two new tables — `/PWXSI/SI_LICENSE` (stores what each customer has subscribed to — OCR module, PRIVA module, Joule, Claims, how many inspections they're allowed per period) and `/PWXSI/SI_USAGE` (tracks how many inspections they've actually used per license period and what the remaining balance is).

We exposed these as two new OData entity sets:

**SI_LicenseSet** — You call this with today's date as the key, and it tells you which modules the org is entitled to. We use this as a gate — before the field operator clicks Capture in the camera (OCR), we check if `OcrModule` is true. Before a supervisor opens PRIVA Assist, we check if `PrivaModule` is true. If they're not subscribed, they get a clear error message instead of letting the feature run.

**SI_UsageSet** — After an inspection is completed and image flags are updated in the header, we call this to log the usage. The backend calculates the increment automatically based on the header's status and image flags — a rejected inspection counts as 1, an accepted inspection with an after-image counts as 2. It deducts from the balance. When the usage hits the warning threshold, the backend sends back a warning message in the `sap-message` HTTP response header, and we surface that as a popup to the user.

**One thing to flag for the backend dev:** Right now `SI_LICENSESET_GET_ENTITY` has a balance check inside it that throws an error when balance is zero, which prevents the module flags from even being returned. That check shouldn't be there — balance enforcement is already done in `SI_USAGESET_UPDATE_ENTITY`. The GET_ENTITY should just return the flags. This needs to be fixed on the ABAP side.

---

## Technical Decisions Worth Knowing

**Why we have two OData model instances:** SAP UI5's ODataModel v2 batches all requests into a single `$batch` POST by default. The two new custom entities (`SI_LicenseSet` and `SI_UsageSet`) are custom-redefined methods on the backend that aren't set up to handle batch processing. So we maintain a separate model instance (`getNonBatchModel`) with `useBatch: false` specifically for these two calls, while all the other standard reads and creates still go through the normal batched model. This is the pattern to follow if you add any other custom Gateway method that isn't batch-compatible.

**Why we use PUT not PATCH for SI_UsageSet:** PATCH (MERGE in OData v2 language) causes Gateway to first call `GET_ENTITY` internally to fetch the current entity state before merging. Since `SI_UsageSet` has no `GET_ENTITY` implemented (it's write-only by design), that call fails. By passing `{ merge: false }` to `oModel.update()`, we force a PUT which goes straight to `UPDATE_ENTITY` without the implicit GET step.

**Image upload:** Before and after images go through a multi-step flow — captured via `getUserMedia()` in the browser, converted to PDF via `pdfMake`, then uploaded via raw `$.ajax` POST to `AttachmentSet` with a custom `slug` header in the format `<Document>/<Carrier>-<Before_Image|After_Image>.pdf`. The ABAP `CREATE_STREAM` method parses the slug, stores the file in Business Content Server, and writes the GUID back into the header table. One important thing: the backend needs all Nullable=false fields on the attachment entity populated before calling `copy_data_to_ref`, otherwise Gateway throws a CX_DS_INTERNAL_ERROR on the response even if the file actually saved successfully.

---

## Folder Structure Quick Reference

```
/app
  /insptrack          → Field operator app (SmartInspect Operations)
    /webapp
      /controller     → Main.controller.js (the whole wizard logic)
      /service        → ODataService.js, InspectionCodeService.js, ImageService.js, PDFService.js...
      /util           → ErrorHandler.js, FilterHelper.js, UserHelper.js...
      /view           → Main.view.xml
      /localService/mainService/metadata.xml  → local mock metadata

  /carrieranalytics   → Supervisor dashboard (SmartInspect Insights)
    /webapp
      /controller     → Main.controller.js, AiSummary.controller.js, CarrierInspectionReport.controller.js
      /service        → ODataService.js (license/usage calls only)
      /view           → Main.view.xml, AiSummary.view.xml, CarrierInspectionReport.view.xml
      /localService/mainService/metadata.xml  → local mock metadata
```

The `Readme.md` at the root has the full technical context, all the gotchas, backend entity details, and work logs from each session — read that first before touching anything, it'll save you a lot of time.

---

## How to Run Locally

Each app has a `ui5-local.yaml` (hits the real backend via principal propagation destination) and a `ui5-mock.yaml` (uses local mock data from `localService/`). The BTP destinations you need configured are `DEV-100-PrincipalPropogation` (for S/4HANA) and `CROP_SERVICE` (for OCR/PRIVA microservices).

---

That's the overall picture. The Readme has all the deep-dive details per feature. If anything breaks, the first place to check is always the browser network tab and the Gateway error codes — most issues so far have been Gateway-level (batch incompatibility, missing method implementations, merge vs put semantics) rather than actual app logic bugs.
