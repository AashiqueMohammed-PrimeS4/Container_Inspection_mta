sap.ui.define(["sap/ui/core/format/DateFormat"], (DateFormat) => {
    "use strict";

    const dayFormat = DateFormat.getDateInstance({ style: "medium", UTC: true });
    const stampFormat = DateFormat.getDateTimeInstance({ style: "medium" });
    const STATES = { New: "Information", InReview: "Warning", Responded: "Success", Closed: "None" };
    const isEmpty = (v) => v === null || v === undefined || v === "";

    // Referenced as .formatter.x in the views.
    function text(controller, key, args) {
        const bundle = controller?.getOwnerComponent?.()?.getModel("i18n")?.getResourceBundle();
        return bundle?.getText(key, args, true) ?? undefined;
    }

    return {
        dash(v) {
            return isEmpty(v) ? "-" : String(v);
        },

        // S/4 sends dates as timestamps at UTC midnight: format the day in UTC.
        day(v) {
            return isEmpty(v) ? "-" : dayFormat.format(new Date(String(v).length === 10 ? `${v}T00:00:00Z` : v));
        },

        stamp(v) {
            return isEmpty(v) ? "-" : stampFormat.format(new Date(v));
        },

        // S/4 flags are "X" or "", form fields are booleans.
        yesNo(v) {
            if (v === true || v === "X") {return text(this, "yes") ?? "Yes";}
            if (v === false || v === "") {return text(this, "no") ?? "No";}
            return "-";
        },

        quantity(v, unit) {
            return isEmpty(v) ? "-" : `${Math.trunc(Number(v))} ${unit || ""}`.trim();
        },

        value(v, currency) {
            return isEmpty(v) ? "-" : `${Number(v).toFixed(3)} ${currency || ""}`.trim();
        },

        amount(v, currency) {
            return isEmpty(v) ? "-" : `${Number(v).toFixed(2)} ${currency || ""}`.trim();
        },

        soItem(salesOrder, lineItem, delivery) {
            if (salesOrder) {return lineItem ? `${salesOrder}/${lineItem}` : salesOrder;}
            if (delivery) {return text(this, "deliveryPrefix", [delivery]) ?? `Dlv ${delivery}`;}
            return "-";
        },

        list(v) {
            return isEmpty(v) ? "-" : String(v).split(",").map((s) => s.trim()).filter(Boolean).join(", ");
        },

        statusText(v) {
            return isEmpty(v) ? "-" : text(this, `status.${v}`) ?? v;
        },

        statusState(v) {
            return STATES[v] || "None";
        },

        code(v) {
            return isEmpty(v) ? "-" : text(this, `code.${v}`) ?? v;
        },

        // List column: the customer's own words when the reason is other.
        reason(v, other) {
            if (v === "other") {return other || (text(this, "reason.other") ?? "Other");}
            return isEmpty(v) ? "-" : text(this, `reason.${v}`) ?? v;
        },

        reasonDetail(v, other) {
            if (v === "other") {return text(this, "reasonOtherText", [other || ""]) ?? `Other: ${other || ""}`;}
            return isEmpty(v) ? "-" : text(this, `reason.${v}`) ?? v;
        },

        amountLabel(currency) {
            return text(this, "amountLabel", [currency || "USD"]) ?? `Amount (${currency || "USD"})`;
        }
    };
});
