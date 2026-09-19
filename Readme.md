# Container Inspection MTA — Project Context

This is an SAP BTP multi-target application (MTA) for container/carrier inspection. It has two SAPUI5/Fiori apps under `app/` that share the same ABAP backend OData service and a set of custom microservices. Use this doc to get oriented quickly in a new session.

## Backend service (shared by both apps)

- **Service**: `PWXSI_INSPECTION_ANALYTIC_APP_SRV` (ABAP Gateway), namespace `PWXSI.INSPECTION_ANALYTIC_APP_SRV`
- **URL**: `/sap/opu/odata/PWXSI/INSPECTION_ANALYTIC_APP_SRV/` (note: `PWXSI` replaces the default `sap` namespace segment — it is NOT nested under `/sap/opu/odata/sap/...`)
- Migrated from the old `ZINSPECTION_APP_SRV` service (same backend logic, copied/renamed). Some entity sets were renamed or dropped during the migration — see "Known gotchas" below.
- Key entity sets: `InspectionHeaderSet` (core inspection record, keyed by `Document` + `Sequencenumber` + `CarrierNumber` + `InspectionDate`), `DefectCodeSet`, `AttachmentSet` (media/stream entity for before/after images, POST with `slug` header `<Document>/<Carrier>-<Before_Image|After_Image>.pdf`), `InspectionInsightSet`, `InspectionSummarySet`, `CarrierInspReportSet`, `InspectCodeSet`, `VH_CarrierlineSet`, `VH_CarrierTypeSet`, `ChatbotSet`.
- New backend tables behind this service: `/PWXSI/T_HEADER` (replaces old `ZTINSP_HEADER`), and new license-management tables `/PWXSI/SI_LICENSE` (license key, customer, package, module entitlements e.g. OCR/PRIVA/Joule/Claims, start/end date, inspections included) and `/PWXSI/SI_USAGE` (per-period inspections used/balance against a license key) — license management work is in progress, not yet wired into the apps.

## App: insptrack — "SmartInspect Operations"

Field-operator app for capturing a single container inspection end-to-end. This is where inspection records get **created**.

- **manifest.json dataSources**: `mainService` (PWXSI backend above), `catalogService` (`/odata/v2/catalog/`, reference data: carrier types/lines/inspection codes), `ocrService` (`/odata/v2/ocr/`, OCR microservice), `DefectDet` (`/odata/v2/defect/`, defect detection/classification microservice).
- **Views**: `App.view.xml` (shell), `Main.view.xml` + `Main.controller.js` (the entire 3-step inspection wizard).
- **Step 1 — Document details**: user enters Document/Sequence/Carrier number (manually or via OCR scan), app checks via `ODataService.checkRecordExists()` reading `/InspectionHeaderSet` filtered on those three keys to see if the record already exists.
- **OCR flow** (camera icon on Carrier Number field → `onContainerScan`): captured image → CROP_SERVICE (crops/detects the container in the photo) → `ocrService` `/extractText` → parses `raw_container_number`, `owner_code`, `equipment_type`, `serial_number`, `check_digit`, `size_type` → reconstructs/validates full ISO 6346 container number → auto-fills Carrier Number.
- **Step 2 — Inspection codes**: pick defect codes from `/InspectCodeSet` (renamed from `InspectCodesSet` in the old service — watch this name in any new code).
- **Step 3 — Images**: capture before/after images via `getUserMedia()`, upload as PDF to `AttachmentSet` via raw `$.ajax` POST (see `ODataService.js: uploadPDF`) with CSRF token + `slug` header carrying `<Document>/<Carrier>-<Before_Image|After_Image>.pdf`. Backend `CREATE_STREAM` parses the slug, stores the file in the Business Content Server, and `UPDATE`s the GUID into `/PWXSI/T_HEADER`. Header create itself uses `ODataService.saveInspectionCodes()` → deep-entity `create()` on `/InspectionHeaderSet` with nested `np_on_Codes`.
- **Proxy destinations** (ui5.yaml): `DEV-100-PrincipalPropogation` → `/sap` (S4 HANA backend), `CROP_SERVICE` → cloud crop microservice.

## App: carrieranalytics — "SmartInspect Insights"

Supervisor/analytics dashboard that **reads** inspection data created by insptrack, plus the PRIVA Assist AI chatbot.

- **manifest.json dataSources**: `mainService` (same PWXSI backend as insptrack), `inspectionService` (`/odata/v2/inspection/`, custom microservice for AI analysis + inspection-specific queries).
- **Views/routes**: `Main` (dashboard, status tiles, date filters, floating PRIVA Assist button), `CarrierInspectionReport` (drill-down report with PDF/HTML export), `AiSummary` (AI-generated insights/trend page).
- **PRIVA Assist chatbot** (Main.controller.js): popover chat UI bound to a local `chatModel` (JSONModel: `messages[]`, `showSuggestions`, suggestion chips). On submit, calls `oInspectionModel.create("/analyze", { question })` against `inspectionService`. Response is `oData.analyze.message` (text) + `oData.analyze.tokenUsage` (LLM token usage — shown per-message, bottom-right of each bot bubble, formatted as `Usage: <n>` via `formatTokenUsage()`).
- **AiSummary flow**: `_loadSummaryData()` (aggregate accepted/rejected counts), `_loadInsights()` reads `InspectionInsightSet` (renamed from old `InspectionInsight2Set` — backend now serves this through the single `InspectionInsightSet`), `_loadTrendData()` iterates date ranges reading `/InspectionHeaderSet` to build daily accepted/rejected trend charts.
- **CarrierInspectionReport**: reads `/InspectionHeaderSet` filtered by Document/Carrier/Status, exports PDF (via `pdfMake`) and an Outlook web-compose deep link for emailing the report (no real attachment support — user must attach the downloaded PDF manually).
- **Proxy destinations** (ui5.yaml): same `DEV-100-PrincipalPropogation` and `CROP_SERVICE` as insptrack.

## Known gotchas / migration notes

- The Gateway URL pattern is `/sap/opu/odata/PWXSI/INSPECTION_ANALYTIC_APP_SRV/...` — easy to mistype as `/sap/opu/odata/sap/PWXSI/...` (wrong) since most legacy SAP examples use the `sap` namespace segment.
- Entity set renames vs the old `ZINSPECTION_APP_SRV`: `InspectCodesSet` → `InspectCodeSet`, `InspectionInsight2Set` → merged into `InspectionInsightSet`.
- Entity sets that existed in the old service but have **no equivalent** in the new one (not used by current app code, but flag if referenced): `InspectionGlobalMetricsSet`, `InspectionDetailSet`, `DefectAnalysisSetSet`, `ContainerHistorySet`, `InspectionHeadGlobalSet`, `ContainerGlobalSet`.
- `AttachmentSet` POST (image upload) backend `CREATE_STREAM` method must populate all `Nullable="false"` fields of `ts_attachment` (`BusinessKey`, `Filename`, `Mimetype`, `Value`) before calling `copy_data_to_ref`, or the Gateway framework throws `CX_DS_INTERNAL_ERROR` while serializing the response (seen in `/IWFND/CL_SODATA_ROOT_HANDLER->HANDLE_CONDITIONS`) even though the actual file/GUID update already succeeded.
- License management (`/PWXSI/SI_LICENSE`, `/PWXSI/SI_USAGE`) is a new backend addition, not yet surfaced in either app — planned metering unit is per OCR scan and per PRIVA chat call (not per inspection record), decrementing a shared balance tied to a license key/period.

## Work log — service migration to PWXSI (this session)

**Goal:** move both apps off the old `ZINSPECTION_APP_SRV` onto the new `PWXSI_INSPECTION_ANALYTIC_APP_SRV`, using a new metadata.xml supplied by the backend team, without breaking any existing app code.

- **insptrack**: replaced `metadata.xml` with the new PWXSI version (deleted the old one, `metadataNew.xml` was the staging file and got removed after merge). Updated `manifest.json`, `ui5-local.yaml`, `ui5-mock.yaml`, `.appGenInfo.json` to the corrected URL `/sap/opu/odata/PWXSI/INSPECTION_ANALYTIC_APP_SRV/` (first attempt wrongly used `/sap/opu/odata/sap/PWXSI/...` — fixed after backend confirmed the real Gateway URL pattern has no `sap` segment before `PWXSI`). Renamed `InspectCodesSet` → `InspectCodeSet` in `ODataService.js` to match the new entity set name.
- **carrieranalytics**: same metadata swap (user replaced `metadata.xml` directly), same manifest/yaml/`.appGenInfo.json` URL fixes. Fixed `InspectCodesSet` → `InspectCodeSet` in `CarrierInspectionReport.controller.js`, and `InspectionInsight2Set` → `InspectionInsightSet` in `AiSummary.controller.js` (backend confirmed the old Insight2 logic was merged into the single InspectionInsight entity in the new service).
- **Backend debugging done together** (ABAP side, not this repo, but documented here for continuity):
  - `Unable to read document type configuration` (`/IWBEP/CM_MGW_RT/022`) on `InspectionHeaderSet` reads — backend-side DPC/config issue, not a frontend/metadata problem (Attachment/Header entity defs are identical old vs new).
  - `AttachmentSet` POST 500 / `Invalid or no mapping to system data types found` — traced to SEGW: new service's MPC/runtime classes likely weren't regenerated after copying from the old service; advised checking the `Attachment` entity's structure mapping in SEGW and regenerating runtime objects.
  - `SY/530 Failed to update After_Images GUID in header table` — traced into the actual `CREATE_STREAM` ABAP method (`/PWXSI/CL_INSPECTIO_01_MPC`). Old vs new table (`ztinsp_header` vs `/PWXSI/T_HEADER`) confirmed field-for-field identical, so not a structural mismatch.
  - Follow-on `CX_DS_INTERNAL_ERROR` in `/IWFND/CL_SODATA_ROOT_HANDLER->HANDLE_CONDITIONS` after the GUID update succeeded — root cause: `copy_data_to_ref` was building the response entity (`ts_attachment`) with only `BusinessKey` populated, leaving `Filename`/`Mimetype`/`Value` initial despite metadata marking them `Nullable="false"`. Fix applied in ABAP: populate `Filename`/`Mimetype` from the parsed slug, and set `Value = ''` (not the GUID — wrong type, RAW vs string) before `copy_data_to_ref`.

## Work log — PRIVA Assist chatbot tweaks (carrieranalytics)

- Added per-message token usage display: `AiSummary`/Main chat flow now captures `oData.analyze.tokenUsage` from the `/analyze` action response and renders it as `Usage: <n>` in the bottom-right corner of each AI Assistant bubble (not a global footer — tried that first, moved it inside the bubble per feedback). New `formatTokenUsage()` handles multiple possible backend shapes (`totalTokens`, `total_tokens`, `promptTokens`+`completionTokens`, or a plain number).
- Removed the default suggestion chips ("Get Total Inspections", "Top rejection reasons", etc.) from the PRIVA Assist chat popover — deleted `suggestions`/`showSuggestions` from `chatModel`, the suggestion-chips `HBox` from `Main.view.xml`, the now-dead `onSuggestionItemPress`/`onOpenSuggestionPopover` handlers, and the unused `.privaSuggestions`/`.privaSuggestionBtn` CSS.
- Changed the "PRIVA Assist" header button from `type="Ghost"` to `type="Transparent"` to drop the pill/outline look. The underline visible below it in screenshots turned out to be the `Page` subHeader's bottom border (`#page-subHeader`), not the button — added a CSS override removing that border/box-shadow.
- Diagnosed (not yet fixed, lives in a separate CAPM project outside this repo) why the PRIVA chat gives a more verbose/editorialized answer through the Fiori app than the same question tested directly against the CAP service via `.http`/REST client: both routes confirmed to hit the same deployed code and same OData entity logic, V2 vs V4 endpoint ruled out as the cause. Most likely explanation is LLM sampling variance from `temperature: 0.4` on the final Groq call, compounded by the model not strictly following the "no commentary/no extra insight" system prompt. Recommended fix (in the external CAPM agent service, not this repo): lower the final-call temperature (e.g. to 0–0.1) and strengthen the system prompt to explicitly forbid "Key insight"-style closing commentary and em-dash formatting.

## Work log — license management design (CROP_SERVICE side, not yet implemented)

Backend added `/PWXSI/SI_LICENSE` (license key, customer, package, module entitlements: OCR/PRIVA/Joule/Claims, start/end date, inspections included) and `/PWXSI/SI_USAGE` (license key + period + inspections used/balance). Goal: rate-limit OCR scans and PRIVA chat calls per organization per month, enforced in the separate CROP_SERVICE CAPM project (which hosts the OCR, defect-detection, and PRIVA agent services behind one destination).

Key design discussion so far:
- The incoming JWT (sample from Primes4 org) has no field matching `/PWXSI/SI_LICENSE`'s `License Key` directly — that key is a custom value assigned at sales time, SAP's identity service has no concept of it.
- The closest usable tenant identifier in the JWT is `zid` / `ext_attr.subaccountid` (the BTP subaccount ID) — stable per customer, same for every user within that customer's subaccount, signed/tamper-proof.
- Deployment model confirmed: CROP_SERVICE is **one shared CAPM instance** serving multiple customer subaccounts (Primes4-style SaaS subscription model), not a separate deployment per customer — so a JWT-based tenant lookup is required (a fixed per-deployment config value won't work here).
- Still open: where the `subaccount_id → License Key` mapping should live — either (a) add a `SUBACCOUNT_ID` column to `/PWXSI/SI_LICENSE` on the ABAP side and have CAP call out to SAP on each request, or (b) keep a local copy/cache of license+usage data in the CAPM app's own DB and sync back to SAP asynchronously. Leaning towards (b) given OCR/PRIVA calls are frequent and latency-sensitive — a live SAP round-trip on every single request would be slow and fragile if SAP is briefly unreachable. Not yet decided or implemented.

## Work log — license gating + usage metering wired into insptrack/carrieranalytics (this session)

Backend exposed two new OData entities on `PWXSI_INSPECTION_ANALYTIC_APP_SRV` (custom redefined `GET_ENTITY`/`UPDATE_ENTITY` methods, ABAP source notes kept locally in `backend/` — now gitignored, never committed): `SI_LicenseSet` (read-only, keyed by `InspectionDate`, returns `OcrModule`/`PrivaModule`/`JouleModule`/`ClaimsModule` flags + license metadata for whichever license is active for that date) and `SI_UsageSet` (write-only, keyed by `Document`+`Sequencenumber`+`CarrierNumber`+`InspectionDate`, increments `/PWXSI/SI_USAGE.inspections_used`/`balance` based on the header's Status/HasAfterImg — Reject = +1, Accept-with-after-image = +2, silently no-ops with no error if neither condition is met yet, e.g. before the after-image is uploaded). Both `SI_LicenseSet`/`SI_UsageSet` entity types/sets were added to both apps' local mock `metadata.xml` to match the live backend.

**License gating (module entitlement check):**
- New `ODataService.checkLicenseModule(oDataModel, sModuleField)` in both apps (`insptrack/webapp/service/ODataService.js`, new `carrieranalytics/webapp/service/ODataService.js`) — reads `SI_LicenseSet` keyed by today's date and resolves a boolean for the given module flag.
- **insptrack**: `onCaptureCarrierNo` (camera dialog's Capture button, `Main.controller.js`) now checks `OcrModule` first; if not entitled, closes the camera dialog and shows an error instead of running the crop/OCR flow. The original capture/crop/OCR logic was renamed to `_scanAndDetectContainer()`.
- **carrieranalytics**: `onFloatingPress` (PRIVA Assist header button, `Main.controller.js`) now checks `PrivaModule` first; if not entitled, shows an error instead of opening the chat dialog. The original dialog-opening logic was extracted into `_openPrivaAssist()`.

**Usage metering (insptrack only, on inspection completion):**
- `ODataService.updateHeaderFlags` now resolves with the full header record (previously resolved with nothing) so the caller has `Document`/`Sequencenumber`/`CarrierNumber`/`InspectionDate` for the next call.
- New `ODataService.updateUsage(oDataModel, sDocument, sSequence, sCarrier, dInspectionDate)` calls `SI_UsageSet` right after header flags are saved.
- `_updateHeaderFlagsAfterUpload` (`Main.controller.js`) chains `updateUsage` after `updateHeaderFlags` succeeds, surfacing any backend error (e.g. "License inspection limit exceeded.") via `MessageBox.error` without rolling back the already-saved header/image data.

**Gotchas hit and fixed along the way (both `SI_LicenseSet` and `SI_UsageSet` calls):**
- `sap.ui.model.odata.v2.ODataModel` batches every `read`/`update` into a single `POST .../$batch` envelope by default. These two custom entity redefinitions aren't proven batch-safe, and wrapping the GET in `$batch` got a `400 Bad Request` ("malformed syntax") back from the whole batch envelope, before the request even reached the ABAP method. Fix: both services now keep a lazily-created second `ODataModel` instance pointed at the same service URL but constructed with `useBatch: false`, used only for these two calls (`getNonBatchModel()` helper) — sends a plain, non-batched request via the standard model API (`read`/`update`/`createKey`), no raw `$.ajax`.
- That second model instance loads its own metadata asynchronously; calling `createKey`/`read` on it immediately threw "No metadata loaded!" / "Cannot read properties of null (reading 'key')". Fix: build the key using the **main** model (its metadata is already loaded at app startup) and only call `.read()`/`.update()` on the non-batch model after its own `metadataLoaded()` promise resolves.
- `SI_UsageSet`'s update (PATCH/MERGE) failed with Gateway error `/IWFND/CM_MGW/096 — PATCH requests require components to be updated` when sent with an empty `{}` body — the Gateway framework rejects an empty PATCH before reaching the ABAP method (which ignores the body anyway, only uses the keys). Fix: send a harmless dummy field (`{ Period: "" }`).
- After that, the PATCH instead failed with `/IWBEP/CM_MGW_RT/021 — Method 'SI_USAGESET_GET_ENTITY' not implemented`: Gateway's standard MERGE/PATCH handling does an implicit `GET_ENTITY` first (to merge the incoming partial payload onto the current state) before calling `UPDATE_ENTITY` — but `SI_UsageSet` is write-only and has no `GET_ENTITY` implemented by design. Fix: pass `{ merge: false }` to `oModel.update(...)` to force a PUT instead of MERGE, which Gateway dispatches straight to `UPDATE_ENTITY` with no implicit GET step.
- Net result confirmed against the actual `/PWXSI/SI_USAGE` table: an Accept-with-after-image inspection correctly bumped `inspections_used`/`balance` by 2 end-to-end through the UI.
- `SI_UsageSet` update (PUT) body was reverted to `{}` after confirming PUT semantics (not MERGE) makes the empty body acceptable to Gateway — the `{ Period: "" }` dummy field is no longer needed.
- Both `SI_LicenseSet` and `SI_UsageSet` URLs show a double-slash (`...ANALYTIC_APP_SRV//SI_LicenseSet...`) in the network tab because `oDataModel.sServiceUrl` retains a trailing slash from the manifest URI, and the non-batch model inherits it; servers normalize `//` to `/` so requests still succeed — cosmetic only, not causing failures.
- `updateUsage` `success` callback now receives `(oData, oResponse)` and passes `oResponse` through `extractSapMessage()` (module-level helper in `ODataService.js`) — reads `oResponse.headers["sap-message"]`, JSON-parses it, and resolves the promise with the `.message` string (or `null`). `_updateHeaderFlagsAfterUpload` in `Main.controller.js` then shows a `MessageBox.warning(sWarning)` if a warning came back (e.g. the ≥ threshold % usage alert the backend raises via `add_message_text_only` with `iv_add_to_response_header = abap_true`).

**Open items for backend dev:**
- `SI_LICENSESET_GET_ENTITY` currently raises a business exception ("Insufficient Balance") when `balance = 0` *before* returning the entity — this blocks the frontend from reading the `PrivaModule`/`OcrModule` flags even when the org is legitimately subscribed but has used up its quota. The balance check is redundant here (it is already enforced in `SI_USAGESET_UPDATE_ENTITY`). Remove the `SELECT balance / IF lv_balance = 0 RAISE EXCEPTION` block (lines 31–41 of the current ABAP) from `SI_LICENSESET_GET_ENTITY` — this entity should only validate the license date range and return module flags.
- The usage-alert threshold in `SI_USAGESET_UPDATE_ENTITY` was changed from 50% to 95%, which means the warning only fires at the last inspection (e.g. 10/10 = 100%) when inspections_included is small — effectively useless as an early warning. Recommend lowering to 70–80% so users get a heads-up before hitting the hard limit.

## Work log — AI defect scanning (DefectModule) in insptrack, Step 2 (this session)

**Goal:** let Step 2 ("Inspection Codes") offer AI-powered defect detection (scan the container photo, LLM lists defects) for orgs entitled to a new `DefectModule`, while orgs without it keep the original manual checkbox list — same pattern as the existing `OcrModule` gating.

**Backend:**
- Added `DEFECT_MODULE` (CHAR1) field to `/PWXSI/I_LICENSE`, alongside the existing `OCR_MODULE`/`PRIVA_MODULE`/`JOULE_MODULE`/`CLAIMS_MODULE` flags.
- Added the matching `DefectModule` (Edm.Boolean) property to the `SI_License` entity type in SEGW and regenerated the MPC.
- `SI_LICENSESET_GET_ENTITY` now also maps `ls_entity-defect_module = ls_license-defect_module` alongside the other module flags.
- Local mock `metadata.xml` (`insptrack/webapp/localService/mainService/metadata.xml`) updated with the same `DefectModule` property so mock runs stay in sync with the live schema.

**CROP_SERVICE (separate CAPM project, `Croping_srv`):** new `DefectService.analyzeImage(imageData, mimeType)` action (`srv/Defect.cds`/`Defect.js`), exposed at `/odata/v2/defect/` (already wired in `xs-app.json`/`manifest.json` as the `DefectDet`/`defect` model, previously unused). Sends the captured image to Groq (`meta-llama/llama-4-scout-17b-16e-instruct`) with a defect-listing prompt, returns `{ defects: "<comma-separated list>", tokenUsage: <n> }` (initially a plain string during early testing, backend later changed the response shape to include token usage — frontend updated to match, see below).

**insptrack frontend (`Main.controller.js` / `Main.view.xml`):**
- New `/defectModuleEnabled` model flag, checked via `ODataService.checkLicenseModule(oModel, "DefectModule")` (same helper used for `OcrModule`) at three points: app start (`onInit`), the moment Step 1 hands off to Step 2 (`onDocumentDetailsComplete` — the reliable trigger), and Step 2's own step-activate as a backup.
- Step 2 view now has two mutually-exclusive blocks bound to `/defectModuleEnabled`: the original checkbox list (`visible="{= !${/defectModuleEnabled} }"`, unchanged fallback) and a new AI-scan block — "Scan Container" button → camera capture → resized image POSTed to `DefectService.analyzeImage` → results populate an editable `sap.m.Tokenizer` (`defectTokenizer`) the user can add to/remove from before accepting.
- New controller functions ported/wired for the scan flow: `onScanContainer`, `onCaptureContainerImage`, `_resizeImageForAI`, `_analyzeContainerImage`, `_populateDefectTokenizer`, `onAddDefectToken`, `onDefectTokenDelete`, `_buildSelectedCodesFromTokenizer`.
- `onAcceptCodes`/`onRejectCodes`/`_saveInspectionCodes` now branch on `/defectModuleEnabled` via `_getCurrentSelectedCodeTexts()` — tokenizer-sourced codes when licensed, checkbox-sourced when not — both feeding the same existing deep-entity save path, so Step 3/PDF/backend save logic needed no changes.
- `_analyzeContainerImage` parses the backend's `{ defects, tokenUsage }` object (previously assumed a plain string); `tokenUsage` is stored in `/aiTokenUsage` and shown as "AI analysis token usage: N" above the tokenizer in Step 2.

**Gotchas hit and fixed:**
- `analyzeImage` calls initially failed with `502 Bad Gateway` — traced to the Groq model reference in `Defect.js`, not a destination/routing problem (OCR calls through the same `CROP_SERVICE` destination worked fine throughout). Fixed by the backend swapping the Groq model.
- License checks appeared to "stick" to a stale value — changing `DEFECT_MODULE` in the table and reloading the page (or even navigating Step 1 → Step 2 again) kept showing the old checkbox/scan view until the whole dev server (`npm run start`) was restarted, pointing at an HTTP-level cache (browser or intermediate proxy) serving back an identical `SI_LicenseSet` GET URL. Fixed in `ODataService.checkLicenseModule` by appending a `_=<timestamp>` cache-busting query param and sending `Cache-Control: no-cache, no-store, must-revalidate` / `Pragma: no-cache` headers on every call (applies to both the `OcrModule` and `DefectModule` checks, since they share this one function).
