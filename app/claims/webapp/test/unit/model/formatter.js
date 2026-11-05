/*global QUnit*/
sap.ui.define([
    "claims/model/formatter"
], function (formatter) {
    "use strict";

    QUnit.module("formatter");

    QUnit.test("empty values show a dash", function (assert) {
        assert.strictEqual(formatter.dash(null), "-");
        assert.strictEqual(formatter.day(""), "-");
        assert.strictEqual(formatter.quantity(null, "KG"), "-");
        assert.strictEqual(formatter.value(undefined, "USD"), "-");
    });

    QUnit.test("numbers keep their scale and unit", function (assert) {
        assert.strictEqual(formatter.quantity("12", "KG"), "12 KG");
        assert.strictEqual(formatter.value("1234.5", "USD"), "1234.500 USD");
        assert.strictEqual(formatter.amount("80", "USD"), "80.00 USD");
    });

    QUnit.test("sales order, item or delivery", function (assert) {
        assert.strictEqual(formatter.soItem("123", "10", "8000"), "123/10");
        assert.strictEqual(formatter.soItem("123", null, null), "123");
        assert.strictEqual(formatter.soItem(null, null, "80001876"), "Dlv 80001876");
        assert.strictEqual(formatter.soItem(null, null, null), "-");
    });

    QUnit.test("status state", function (assert) {
        assert.strictEqual(formatter.statusState("New"), "Information");
        assert.strictEqual(formatter.statusState("InReview"), "Warning");
        assert.strictEqual(formatter.statusState("Closed"), "None");
    });

    QUnit.test("a date only value does not shift", function (assert) {
        assert.ok(formatter.day("2026-10-20").indexOf("20") !== -1);
    });
});
