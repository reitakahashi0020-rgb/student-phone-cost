(function () {
  "use strict";

  const yen = (value) => new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0
  }).format(Math.round(value));

  const field = (id) => document.getElementById(id);
  const valueOf = (id) => {
    const node = field(id);
    return node ? Math.max(0, Number(node.value) || 0) : 0;
  };
  const valueText = (id) => field(id) ? field(id).value : "";
  const checked = (id) => Boolean(field(id) && field(id).checked);
  const updateText = (id, value) => {
    const node = field(id);
    if (node) node.textContent = typeof value === "number" ? yen(value) : value;
  };

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

  function mobileTargets(dataUsage, current) {
    const cost = dataUsage <= 5 ? 1800 : dataUsage <= 20 ? 2800 : 3800;
    const balance = dataUsage <= 5 ? 2500 : dataUsage <= 20 ? 3500 : 4500;
    return { cost: Math.min(current, cost), balance: Math.min(current, balance) };
  }

  function deviceTotals(mode, amount, balance, resale, replacement) {
    const base = mode === "purchase" ? amount : amount * 36;
    const saleCredit = replacement === "none" ? 0 : resale;
    const current = Math.max(0, base + balance - saleCredit);
    const cost = replacement === "none"
      ? balance
      : Math.max(0, balance + base * 0.55 - saleCredit);
    const balanced = replacement === "none"
      ? Math.max(balance, base * 0.45)
      : Math.max(0, balance + base * 0.75 - saleCredit);
    return { base, saleCredit, current, cost, balanced };
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

  function calculateCosts(options) {
    const form = field("cost-form");
    if (!form) return;
    const currentMobile = valueOf("m1");
    const dataUsage = valueOf("data-usage");
    const currentWifi = valueOf("w1");
    const mode = valueText("device-mode");
    const deviceAmount = valueOf("d1");
    const balance = valueOf("balance");
    const resale = valueOf("sale");
    const housing = valueText("housing");
    const wifiStatus = valueText("wifi-status");
    const replacement = valueText("replacement");
    const stableHome = checked("stable-home");
    const device = deviceTotals(mode, deviceAmount, balance, resale, replacement);
    const currentMobile36 = currentMobile * 36;
    const effectiveCurrentWifi = wifiStatus === "yes" ? currentWifi : 0;
    const currentWifi36 = effectiveCurrentWifi * 36;
    const currentTotal = Math.max(0, currentMobile36 + currentWifi36 + device.current);
    const targets = mobileTargets(dataUsage, currentMobile);
    const needsHomeInternet = housing === "alone" && (stableHome || dataUsage > 20);
    const costWifi = housing === "family" ? 0 : needsHomeInternet ? Math.min(currentWifi || 3800, 3800) : 0;
    const balanceWifi = housing === "family" ? 0 : needsHomeInternet ? (currentWifi || 4200) : 0;
    const costMinTotal = Math.max(0, targets.cost * 36 + costWifi * 36 + device.cost);
    const balancedTotal = Math.max(0, targets.balance * 36 + balanceWifi * 36 + device.balanced);
    const easyTotal = currentTotal;
    const saving = currentTotal - costMinTotal;
    const mobileSavingNeeded = currentMobile - targets.balance >= 800;

    const render = () => {
      updateText("old3", currentTotal);
      updateText("min3", costMinTotal);
      updateText("save3", saving);
      updateText("breakdown-mobile", currentMobile36);
      updateText("breakdown-wifi", currentWifi36);
      updateText("breakdown-device", device.base + balance);
      updateText("breakdown-sale", device.saleCredit ? -device.saleCredit : 0);
      updateText("breakdown-total", currentTotal);
      updateText("plan-min-total", costMinTotal);
      updateText("plan-balance-total", balancedTotal);
      updateText("plan-easy-total", easyTotal);
      updateText("plan-min-detail", needsHomeInternet
        ? "通信量に合うモバイル枠と、自宅の安定回線を残しながら端末保有期間を長めに置く試算です。"
        : "自宅回線を持たない前提も含め、通信量に合うモバイル枠と端末保有期間を優先します。");
      updateText("plan-balance-detail", stableHome
        ? "自宅通信の安定性を確保し、スマホと端末コストだけを無理なく抑える試算です。"
        : "コストを抑えつつ、データ容量と買い替え余地を少し残す試算です。");
      updateText("plan-easy-detail", "契約変更を前提にせず、現在の支払いを36か月続けた比較基準です。");
      const caption = field("save-caption");
      if (caption) caption.textContent = saving > 0 ? "コスト最小案との差額" : "現在の条件はすでに低コストです";
      renderTags(housing, wifiStatus, dataUsage, replacement);
      renderOffers({
        mobile_saving: mobileSavingNeeded ? "現在のスマホ月額と利用量の差が大きいため、回線条件の比較対象になります。" : "",
        home_internet_needed: needsHomeInternet ? "一人暮らしで自宅の安定通信が必要なため、固定回線の条件確認が役立ちます。" : "",
        device_replacement: replacement !== "none" ? "3年以内に端末を替える予定があるため、売却条件の確認対象です。" : ""
      });
      const result = field("diagnosis-result");
      if (result) result.classList.add("is-ready");
    };

    const button = field("calculate-button");
    if (options && options.loading && button) {
      button.classList.add("is-loading");
      button.setAttribute("aria-busy", "true");
      window.setTimeout(() => {
        render();
        button.classList.remove("is-loading");
        button.removeAttribute("aria-busy");
        field("diagnosis-result")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 160);
    } else {
      render();
    }
    if (options && options.complete) {
      const params = new URLSearchParams(window.location.search);
      track("diagnosis_complete", {
        source: params.get("source") || "direct",
        intent_group: params.get("intent") || "",
        plan: "three_options"
      });
    }
  }

  function updateDeviceMode() {
    const purchase = valueText("device-mode") === "purchase";
    updateText("device-cost-label", purchase ? "端末購入額" : "端末月額");
    updateText("device-cost-unit", purchase ? "円/回" : "円/月");
    const input = field("d1");
    if (input) input.max = purchase ? "1000000" : "100000";
  }

  window.calc = () => calculateCosts({ loading: true, complete: true });

  document.addEventListener("DOMContentLoaded", () => {
    const form = field("cost-form");
    if (!form) return;
    let started = false;
    const markStarted = () => {
      if (started) return;
      started = true;
      const params = new URLSearchParams(window.location.search);
      track("diagnosis_start", { source: params.get("source") || "direct", intent_group: params.get("intent") || "" });
    };
    form.addEventListener("focusin", markStarted, { once: true });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      markStarted();
      calculateCosts({ loading: true, complete: true });
    });
    form.querySelectorAll("input, select").forEach((input) => {
      input.addEventListener("change", () => {
        if (input.id === "device-mode") updateDeviceMode();
        if (field("diagnosis-result")?.classList.contains("is-ready")) {
          calculateCosts({ loading: false, complete: false });
        }
      });
    });
    updateDeviceMode();
  });
})();
