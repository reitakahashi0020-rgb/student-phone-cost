(function (root) {
  "use strict";

  const nonNegative = (value) => Math.max(0, Number(value) || 0);
  const monthsInHorizon = (value, horizon) => Math.min(nonNegative(value), horizon);

  function currentDeviceObligation(input, horizon) {
    if (input.currentDeviceMethod === "monthly_remaining") {
      return nonNegative(input.currentDeviceMonthly) * monthsInHorizon(input.currentDeviceMonthsLeft, horizon);
    }
    return nonNegative(input.currentDeviceBalance);
  }

  function replacementDeviceCost(input, horizon) {
    if (input.replacement === "none") return 0;
    if (input.replacementCostMode === "monthly") {
      return nonNegative(input.replacementDeviceCost) * monthsInHorizon(input.replacementDeviceMonths, horizon);
    }
    return nonNegative(input.replacementDeviceCost);
  }

  function saleCredit(input) {
    return input.replacement === "none" ? 0 : nonNegative(input.resale);
  }

  function tierFor(dataUsage, model) {
    const tiers = Array.isArray(model.mobile_tiers) ? model.mobile_tiers : [];
    return tiers.find((tier) => tier.max_gb === null || nonNegative(dataUsage) <= nonNegative(tier.max_gb)) || {
      cost_min_yen: 0,
      balance_yen: 0
    };
  }

  function calculate(input, model) {
    const horizon = Number(model.horizon_months) === 36 ? 36 : 36;
    const currentMobile = nonNegative(input.currentMobile);
    const currentWifi = input.wifiStatus === "yes" ? nonNegative(input.currentWifi) : 0;
    const deviceObligation = currentDeviceObligation(input, horizon);
    const replacementCost = replacementDeviceCost(input, horizon);
    const resale = saleCredit(input);
    const sharedDeviceNet = deviceObligation + replacementCost - resale;
    const currentTotal = Math.max(0, currentMobile * horizon + currentWifi * horizon + sharedDeviceNet);

    const tier = tierFor(input.dataUsage, model);
    const targetMobileMin = nonNegative(input.targetMobileMin ?? tier.cost_min_yen);
    const targetMobileBalance = Math.max(targetMobileMin, nonNegative(input.targetMobileBalance ?? tier.balance_yen));
    const targetWifi = nonNegative(input.targetWifi ?? model.home_internet_target_yen);
    const needsHomeInternet = input.housing === "alone" && (Boolean(input.stableHome) || nonNegative(input.dataUsage) > 20);
    const costMinMobile = Math.min(currentMobile, targetMobileMin);
    const balanceMobile = Math.min(currentMobile, targetMobileBalance);
    const costMinWifi = input.housing === "family" ? 0 : needsHomeInternet ? (currentWifi ? Math.min(currentWifi, targetWifi) : targetWifi) : 0;
    const balanceWifi = input.housing === "family" ? 0 : needsHomeInternet ? (currentWifi || targetWifi) : 0;
    const costMinTotal = Math.max(0, costMinMobile * horizon + costMinWifi * horizon + sharedDeviceNet);
    const balancedTotal = Math.max(0, balanceMobile * horizon + balanceWifi * horizon + sharedDeviceNet);

    return {
      horizon,
      currentMobile36: currentMobile * horizon,
      currentWifi36: currentWifi * horizon,
      deviceObligation,
      replacementCost,
      saleCredit: resale,
      sharedDeviceNet,
      currentTotal,
      costMinTotal,
      balancedTotal,
      easyTotal: currentTotal,
      saving: currentTotal - costMinTotal,
      needsHomeInternet,
      mobileSavingNeeded: currentMobile - balanceMobile >= 800,
      targets: { mobileMin: targetMobileMin, mobileBalance: targetMobileBalance, wifi: targetWifi }
    };
  }

  root.CostEngine = { calculate, currentDeviceObligation, replacementDeviceCost, saleCredit, tierFor };
})(typeof globalThis !== "undefined" ? globalThis : window);
