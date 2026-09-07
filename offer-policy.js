(function (root) {
  "use strict";
  function current(expiresAt, now = Date.now()) {
    const expiry = Date.parse(expiresAt || "");
    return Number.isFinite(expiry) && now < expiry;
  }
  function acquisition(search, knownIntents) {
    const params = new URLSearchParams(search);
    const source = params.get("source");
    const intent = params.get("intent");
    return {
      source: ["article", "home", "direct"].includes(source) ? source : "direct",
      intent_group: knownIntents.includes(intent) ? intent : ""
    };
  }
  root.OfferPolicy = { current, acquisition };
})(typeof globalThis !== "undefined" ? globalThis : window);
