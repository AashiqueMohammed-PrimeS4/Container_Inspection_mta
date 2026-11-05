// UI5 Web Components used by the claim page, bundled by esbuild.
import "@ui5/webcomponents/dist/Title.js";
import "@ui5/webcomponents/dist/Label.js";
import "@ui5/webcomponents/dist/Input.js";
import "@ui5/webcomponents/dist/TextArea.js";
import "@ui5/webcomponents/dist/Button.js";
import "@ui5/webcomponents/dist/MessageStrip.js";
import "@ui5/webcomponents/dist/BusyIndicator.js";
import "@ui5/webcomponents/dist/Select.js";
import "@ui5/webcomponents/dist/Option.js";
import "@ui5/webcomponents/dist/RadioButton.js";
import "@ui5/webcomponents/dist/CheckBox.js";
import "@ui5/webcomponents/dist/DatePicker.js";
import "@ui5/webcomponents/dist/FileUploader.js";
import "@ui5/webcomponents/dist/Link.js";
import "@ui5/webcomponents/dist/Dialog.js";
// Only the icons used on the page
import "@ui5/webcomponents-icons/dist/camera.js";
// Date and number formats for "en", bundled so the page loads no locale data from the public CDN.
import { registerLocaleDataLoader } from "@ui5/webcomponents-base/dist/asset-registries/LocaleData.js";
import type { CLDRData } from "@ui5/webcomponents-base/dist/asset-registries/LocaleData.js";
import cldrEn from "@ui5/webcomponents-localization/dist/generated/assets/cldr/en.json";
registerLocaleDataLoader("en", async () => cldrEn as unknown as CLDRData);
