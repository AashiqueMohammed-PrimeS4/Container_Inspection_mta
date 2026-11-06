sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/FilterType",
    "claims/model/formatter"
], (Controller, JSONModel, Filter, FilterOperator, FilterType, formatter) => {
    "use strict";

    const SEARCH_FIELDS = ["caseId", "companyName", "salesOrder", "carrierNumber"];
    const isPhoto = (f) => /^EV_0[1-6]$/.test(f.slot) && /^image\//.test(f.mimeType || "");

    return Controller.extend("claims.controller.Main", {
        formatter,

        onInit() {
            const view = this.getView();
            view.setModel(new JSONModel({ selected: 0, total: 0 }), "view");
            view.setModel(new JSONModel({ groups: [], photos: [], count: 0, index: 0, zoom: false, loading: false }), "files");
            view.setModel(new JSONModel({ decision: "", amount: "", reason: "" }), "respond");
        },

        text(key, args) {
            return this.getOwnerComponent().getModel("i18n").getResourceBundle().getText(key, args);
        },

        items() {
            return this.byId("table").getBinding("items");
        },

        countText(total) {
            return this.text("claimsCount", [total || 0]);
        },

        caseTitle(caseId) {
            return this.text("caseTitle", [caseId || ""]);
        },

        showMessage(text, type) {
            const strip = this.byId("msg");
            strip.setText(text);
            strip.setType(type || "Error");
            strip.setVisible(true);
        },

        showError(err) {
            this.showMessage(err?.message || String(err), "Error");
        },

        clearSelection() {
            this.byId("table").removeSelections(true);
            this.getView().getModel("view").setProperty("/selected", 0);
        },

        // Status and search replace the application filters.
        applyFilters() {
            const filters = [];
            const status = this.byId("statusFilter").getSelectedKey();
            if (status === "open") {filters.push(new Filter("status", FilterOperator.NE, "Closed"));}
            else if (status !== "all") {filters.push(new Filter("status", FilterOperator.EQ, status));}
            const query = this.byId("search").getValue().trim();
            if (query) {
                filters.push(new Filter({
                    filters: SEARCH_FIELDS.map((path) => new Filter({ path, operator: FilterOperator.Contains, value1: query, caseSensitive: false })),
                    and: false
                }));
            }
            this.clearSelection();
            this.items().filter(filters.length ? new Filter({ filters, and: true }) : [], FilterType.Application);
        },

        onFilter() {
            this.applyFilters();
        },

        onSearch() {
            this.applyFilters();
        },

        onRefresh() {
            this.byId("msg").setVisible(false);
            this.clearSelection();
            this.items().refresh();
        },

        onUpdateFinished(event) {
            this.getView().getModel("view").setProperty("/total", event.getParameter("total"));
        },

        onSelectionChange() {
            this.getView().getModel("view").setProperty("/selected", this.byId("table").getSelectedItems().length);
        },

        onGetEvidence() {
            const n = this.byId("table").getSelectedItems().length;
            this.showMessage(this.text(n === 1 ? "evidenceOne" : "evidenceMany", [n]), "Information");
        },

        async setStatus(context, status) {
            try {
                await context.setProperty("status", status);
                this.clearSelection();
                this.items().refresh();
            } catch (err) {
                context.getBinding().resetChanges();
                this.showError(err);
            }
        },

        onReview(event) {
            this.setStatus(event.getSource().getBindingContext(), "InReview");
        },

        onClose(event) {
            this.setStatus(event.getSource().getBindingContext(), "Closed");
        },

        // Detail dialog. Files come from ClaimFiles of the same case.
        async onOpen(event) {
            const context = event.getSource().getBindingContext();
            this.detail ??= await this.loadFragment({ name: "claims.view.Detail" });
            this.getView().getModel("files").setData({ groups: [], photos: [], count: 0, index: 0, zoom: false, loading: false });
            this.getView().getModel("respond").setData({ decision: "", amount: "", reason: "" });
            this.setValueStates();
            this.detail.bindElement(context.getPath());
            this.detail.open();
            try {
                const files = this.getView().getModel().bindList("/ClaimFiles", null, [], [new Filter("caseId", FilterOperator.EQ, context.getProperty("caseId"))], { $orderby: "categoryId,imageSeq" });
                const contexts = await files.requestContexts(0, 100);
                this.setFiles(contexts.map((c) => c.getObject()));
            } catch (err) {
                this.showError(err);
            }
        },

        setFiles(files) {
            const base = this.getView().getModel().getServiceUrl();
            const groups = [];
            const photos = [];
            for (const f of files) {
                let group = groups.find((g) => g.slot === f.slot);
                if (!group) {
                    group = { slot: f.slot, title: this.text(`slot.${f.slot}`), photos: [], docs: [] };
                    groups.push(group);
                }
                const key = `caseId='${encodeURIComponent(f.caseId)}',categoryId='${f.categoryId}',imageSeq='${f.imageSeq}'`;
                const item = {
                    ID: `${f.categoryId}-${f.imageSeq}`,
                    slot: f.slot,
                    fileName: f.fileName,
                    info: this.text("fileInfo", [f.fileName]),
                    url: `${base}ClaimFiles(${key})/content`
                };
                if (isPhoto(f)) {
                    item.index = photos.length;
                    photos.push(item);
                    group.photos.push(item);
                } else {
                    group.docs.push(item);
                }
            }
            groups.sort((a, b) => a.slot.localeCompare(b.slot));
            this.getView().getModel("files").setData({ groups, photos, count: files.length, index: 0, zoom: false, loading: false });
        },

        setValueStates(decision, reason) {
            const state = (missing) => (missing ? "Error" : "None");
            const text = this.text("required");
            this.byId("decision")?.setValueState(state(decision)).setValueStateText(text);
            this.byId("decisionReason")?.setValueState(state(reason)).setValueStateText(text);
        },

        onDecisionInput() {
            this.setValueStates();
        },

        async onRespond() {
            const context = this.detail.getBindingContext();
            const { decision, amount, reason } = this.getView().getModel("respond").getData();
            if (!decision || !reason.trim()) {
                this.setValueStates(!decision, !reason.trim());
                return;
            }
            const hasAmount = String(amount).trim() !== "";
            const action = this.getView().getModel().bindContext("ClaimsService.respond(...)", context);
            action.setParameter("decision", decision);
            action.setParameter("decisionAmount", hasAmount ? Number(amount) : null);
            action.setParameter("decisionCurrency", hasAmount ? context.getProperty("currency") || "USD" : null);
            action.setParameter("decisionReason", reason.trim());
            this.detail.setBusy(true);
            try {
                await action.invoke();
                this.detail.close();
                this.clearSelection();
                this.items().refresh();
            } catch (err) {
                this.showError(err);
            } finally {
                this.detail.setBusy(false);
            }
        },

        onDetailClose() {
            this.detail.close();
        },

        onDetailAfterClose() {
            this.setValueStates();
        },

        // Photo viewer over the detail dialog.
        onThumb(event) {
            this.showPhoto(event.getSource().getBindingContext("files").getProperty("index"));
        },

        async showPhoto(index) {
            const files = this.getView().getModel("files");
            const photos = files.getProperty("/photos");
            const photo = photos[index];
            if (!photo) {return;}
            const changed = files.getProperty("/current/ID") !== photo.ID;
            files.setProperty("/index", index);
            files.setProperty("/zoom", false);
            files.setProperty("/loading", changed);
            files.setProperty("/meta", this.text("viewerMeta", [index + 1, photos.length]));
            files.setProperty("/current", { ...photo, title: this.text(`slot.${photo.slot}`) });
            if (!this.viewer) {
                this.viewer = await this.loadFragment({ name: "claims.view.Viewer" });
                this.viewer.attachBrowserEvent("keydown", (e) => {
                    if (e.key === "ArrowLeft") {this.onPrev();}
                    else if (e.key === "ArrowRight") {this.onNext();}
                });
            }
            this.applyZoom();
            if (!this.viewer.isOpen()) {this.viewer.open();}
        },

        onViewerLoad() {
            this.getView().getModel("files").setProperty("/loading", false);
        },

        onViewerError() {
            const files = this.getView().getModel("files");
            files.setProperty("/loading", false);
            files.setProperty("/meta", `${files.getProperty("/meta")}. ${this.text("viewerError")}`);
        },

        onPrev() {
            this.showPhoto(this.getView().getModel("files").getProperty("/index") - 1);
        },

        onNext() {
            this.showPhoto(this.getView().getModel("files").getProperty("/index") + 1);
        },

        onZoom() {
            const files = this.getView().getModel("files");
            if (files.getProperty("/loading")) {return;}
            files.setProperty("/zoom", !files.getProperty("/zoom"));
            this.applyZoom();
        },

        applyZoom() {
            const zoom = this.getView().getModel("files").getProperty("/zoom");
            const img = this.byId("viewerImg");
            img?.toggleStyleClass("claimsViewerFull", zoom).toggleStyleClass("claimsViewerFit", !zoom);
        },

        onDownload() {
            const photo = this.getView().getModel("files").getProperty("/current");
            if (!photo) {return;}
            const link = document.createElement("a");
            link.href = photo.url;
            link.download = photo.fileName || "photo";
            document.body.appendChild(link);
            link.click();
            link.remove();
        },

        onViewerClose() {
            this.viewer.close();
        },

        onViewerAfterClose() {
            this.getView().getModel("files").setProperty("/current", null);
        }
    });
});
