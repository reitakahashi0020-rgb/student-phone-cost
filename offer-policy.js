(function (root) {
  "use strict";
  function current(expiresAt, now = Date.now()) {
    const expiry = Date.parse(expiresAt || "");
    return Number.isFinite(expiry) && now < expiry;
  }
  function onRegisteredSite(registered, currentUrl) {
    try {
      const approved = new URL(registered);
      const actual = new URL(currentUrl);
      const base = approved.pathname.replace(/\/$/, "");
      return approved.protocol === "https:" && actual.origin === approved.origin
        && (actual.pathname === base || actual.pathname.startsWith(base + "/"));
    } catch (_error) { return false; }
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
  root.OfferPolicy = { current, acquisition, onRegisteredSite };
})(typeof globalThis !== "undefined" ? globalThis : window);
