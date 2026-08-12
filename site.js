(function () {
  "use strict";

  const yen = (value) => new Intl.NumberFormat("ja-JP", {
    style: "currency", currency: "JPY", maximumFractionDigits: 0
  }).format(Math.round(value));
  const field = (id) => document.getElementById(id);
  const valueOf = (id) => Math.max(0, Number(field(id)?.value) || 0);
  const valueText = (id) => field(id)?.value || "";
  const checked = (id) => Boolean(field(id)?.checked);
  const updateText = (id, value) => {
    const node = field(id);
    if (node) node.textContent = typeof value === "number" ? yen(value) : value;
  };

  function costModel() {
    try {
      const model = JSON.parse(field("cost-model")?.textContent || "{}");
      if (model.horizon_months !== 36 || model.model_kind !== "comparison_budget") throw new Error("invalid model");
      return model;
    } catch (_error) {
      return { horizon_months: 36, model_kind: "comparison_budget", mobile_tiers: [], home_internet_target_yen: 0 };
    }
  }

  function track(eventName, dimensions) {
    const allowed = {
      event: eventName,
      event_schema_version: 1,
      page_path: window.location.pathname,
      surface: document.querySelector("[data-diagnosis-surface]")?.dataset.diagnosisSurface || "unknown"
    };
    ["source", "intent_group", "offer_id", "offer_category", "plan"].forEach((key) => {
      if (dimensions && typeof dimensions[key] === "string") allowed[key] = dimensions[key].slice(0, 80);
    });
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(allowed);
    document.dispatchEvent(new CustomEvent("costlab:metric", { detail: allowed }));
  }

  function renderOffers(rules) {
    const target = field("offer-recommendations");
    const registry = field("offer-registry");
    if (!target || !registry) return;
    target.querySelectorAll(".affiliate-cta").forEach((node) => node.remove());
    const templates = Array.from(registry.querySelectorAll("template.offer-template"));
    const selected = templates.filter((template) => Boolean(rules[template.dataset.rule])).slice(0, 2);
    const empty = field("offer-empty");
    if (empty) empty.hidden = selected.length > 0;
    selected.forEach((template) => {
      const fragment = template.content.cloneNode(true);
      const cta = fragment.querySelector(".affiliate-cta");
      const reason = fragment.querySelector(".offer-reason");
      if (reason) reason.textContent = rules[template.dataset.rule];
      if (cta) {
        cta.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => {
          track("affiliate_cta_click", {
            offer_id: cta.dataset.offerId || "",
            offer_category: cta.dataset.offerCategory || "",
            plan: "diagnosis"
          });
        }));
      }
      target.appendChild(fragment);
    });
  }

  function renderTags(housing, wifiStatus, dataUsage, replacement) {
    const tags = field("condition-tags");
    if (!tags) return;
    const values = [
      housing === "alone" ? "一人暮らし" : "実家暮らし",
      wifiStatus === "yes" ? "Wi-Fiあり" : "Wi-Fiなし",
      `${dataUsage || 0}GB/月`,
      replacement === "none" ? "買い替え予定なし" : replacement === "soon" ? "1年以内に買い替え" : "1〜3年で買い替え"
    ];
    tags.replaceChildren(...values.map((text) => {
      const span = document.createElement("span");
      span.className = "pill";
      span.textContent = text;
      return span;
    }));
  }

  function collectInput() {
    return {
      currentMobile: valueOf("m1"), dataUsage: valueOf("data-usage"), currentWifi: valueOf("w1"),
      wifiStatus: valueText("wifi-status"), housing: valueText("housing"), stableHome: checked("stable-home"),
      currentDeviceMethod: valueText("current-device-method"), currentDeviceBalance: valueOf("balance"),
      currentDeviceMonthly: valueOf("device-monthly"), currentDeviceMonthsLeft: valueOf("device-months-left"),
      replacement: valueText("replacement"), replacementCostMode: valueText("replacement-cost-mode"),
      replacementDeviceCost: valueOf("replacement-device-cost"), replacementDeviceMonths: valueOf("replacement-device-months"),
      resale: valueOf("sale"), targetMobileMin: valueOf("target-mobile-min"),
      targetMobileBalance: valueOf("target-mobile-balance"), targetWifi: valueOf("target-wifi")
    };
  }

  function calculateCosts(options) {
    if (!field("cost-form") || !window.CostEngine) return;
    const input = collectInput();
    const result = window.CostEngine.calculate(input, costModel());
    const render = () => {
      updateText("old3", result.currentTotal);
      updateText("min3", result.costMinTotal);
      updateText("save3", result.saving);
      updateText("savings-label", result.saving < 0 ? "3年間の追加費用" : "3年間の削減余地");
      field("savings-panel")?.classList.toggle("is-negative", result.saving < 0);
      updateText("breakdown-mobile", result.currentMobile36);
      updateText("breakdown-wifi", result.currentWifi36);
      updateText("breakdown-device-obligation", result.deviceObligation);
      updateText("breakdown-replacement", result.replacementCost);
      updateText("breakdown-sale", result.saleCredit ? -result.saleCredit : 0);
      updateText("breakdown-total", result.currentTotal);
      updateText("plan-min-total", result.costMinTotal);
      updateText("plan-balance-total", result.balancedTotal);
      updateText("plan-easy-total", result.easyTotal);
      updateText("plan-min-detail", `スマホ月額${yen(result.targets.mobileMin)}、自宅回線${yen(result.targets.wifi)}を上限目標にした比較用モデルです。端末関連は現在条件と同じです。`);
      updateText("plan-balance-detail", `スマホ月額${yen(result.targets.mobileBalance)}を目標に、必要な場合は自宅回線を維持します。端末関連は現在条件と同じです。`);
      updateText("plan-easy-detail", "契約変更を前提にせず、入力した通信費・残債・買い替え予算・売却見込みを36か月で合算した比較基準です。");
      const caption = field("save-caption");
      if (caption) caption.textContent = result.saving > 0 ? "比較用モデルとの差額" : result.saving < 0 ? "比較用モデルへ寄せた場合の増加額" : "現在条件と同額";
      renderTags(input.housing, input.wifiStatus, input.dataUsage, input.replacement);
      renderOffers({
        mobile_saving: result.mobileSavingNeeded ? "現在のスマホ月額と比較用目標の差が大きいため、回線条件の確認対象です。" : "",
        home_internet_needed: result.needsHomeInternet ? "一人暮らしで自宅の安定通信が必要なため、固定回線の公式条件を確認できます。" : "",
        device_replacement: input.replacement !== "none" ? "3年以内に端末を替える予定があるため、売却条件の確認対象です。" : ""
      });
      field("diagnosis-result")?.classList.add("is-ready");
    };
    const button = field("calculate-button");
    if (options?.loading && button) {
      button.classList.add("is-loading");
      button.setAttribute("aria-busy", "true");
      window.setTimeout(() => {
        render();
        button.classList.remove("is-loading");
        button.removeAttribute("aria-busy");
        field("diagnosis-result")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 160);
    } else render();
    if (options?.complete) {
      const params = new URLSearchParams(window.location.search);
      track("diagnosis_complete", { source: params.get("source") || "direct", intent_group: params.get("intent") || "", plan: "three_options" });
    }
  }

  function syncModelTargets(force) {
    const model = costModel();
    const tier = window.CostEngine?.tierFor(valueOf("data-usage"), model);
    if (!tier) return;
    const values = { "target-mobile-min": tier.cost_min_yen, "target-mobile-balance": tier.balance_yen, "target-wifi": model.home_internet_target_yen };
    Object.entries(values).forEach(([id, value]) => {
      const node = field(id);
      if (node && (force || node.dataset.userEdited !== "true")) node.value = String(value);
    });
  }

  function updateConditionalFields() {
    const monthlyRemaining = valueText("current-device-method") === "monthly_remaining";
    if (field("device-balance-fields")) field("device-balance-fields").hidden = monthlyRemaining;
    if (field("device-monthly-fields")) field("device-monthly-fields").hidden = !monthlyRemaining;
    const replacing = valueText("replacement") !== "none";
    if (field("replacement-fields")) field("replacement-fields").hidden = !replacing;
    const replacementMonthly = valueText("replacement-cost-mode") === "monthly";
    if (field("replacement-months-field")) field("replacement-months-field").hidden = !replacementMonthly;
    updateText("replacement-cost-label", replacementMonthly ? "端末月額予算" : "端末購入予算");
    updateText("replacement-cost-unit", replacementMonthly ? "円/月" : "円");
  }

  window.calc = () => calculateCosts({ loading: true, complete: true });
  document.addEventListener("DOMContentLoaded", () => {
    const form = field("cost-form");
    if (!form || !window.CostEngine) return;
    let started = false;
    const markStarted = () => {
      if (started) return;
      started = true;
      const params = new URLSearchParams(window.location.search);
      track("diagnosis_start", { source: params.get("source") || "direct", intent_group: params.get("intent") || "" });
    };
    ["target-mobile-min", "target-mobile-balance", "target-wifi"].forEach((id) => {
      field(id)?.addEventListener("input", (event) => { event.currentTarget.dataset.userEdited = "true"; });
    });
    form.addEventListener("focusin", markStarted, { once: true });
    form.addEventListener("submit", (event) => {
      event.preventDefault(); markStarted(); calculateCosts({ loading: true, complete: true });
    });
    form.querySelectorAll("input, select").forEach((input) => input.addEventListener("change", () => {
      if (input.id === "data-usage") syncModelTargets(false);
      updateConditionalFields();
      if (field("diagnosis-result")?.classList.contains("is-ready")) calculateCosts({ loading: false, complete: false });
    }));
    syncModelTargets(true);
    updateConditionalFields();
    calculateCosts({ loading: false, complete: false });
  });
})();
