(function () {
  "use strict";

  const yen = (value) => new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0
  }).format(value);

  const valueOf = (id) => {
    const field = document.getElementById(id);
    return field ? Math.max(0, Number(field.value) || 0) : 0;
  };

  const updateText = (id, value) => {
    const node = document.getElementById(id);
    if (node) node.textContent = yen(value);
  };

  function calculateCosts(showLoading) {
    const form = document.getElementById("cost-form");
    if (!form) return;

    const currentMonthly = valueOf("m1") + valueOf("w1") + valueOf("d1");
    const futureMonthly = valueOf("m2") + valueOf("w2") + valueOf("d2");
    const sale = valueOf("sale");
    const currentAnnual = currentMonthly * 12;
    const futureAnnual = futureMonthly * 12;
    const annualSaving = currentAnnual - futureAnnual;
    const currentThreeYear = currentAnnual * 3;
    const futureThreeYear = futureAnnual * 3 - sale;
    const threeYearSaving = currentThreeYear - futureThreeYear;
    const maximum = Math.max(currentAnnual, futureAnnual, 1);

    const render = () => {
      updateText("old", currentAnnual);
      updateText("new", futureAnnual);
      updateText("save", annualSaving);
      updateText("old3", currentThreeYear);
      updateText("new3", futureThreeYear);
      updateText("save3", threeYearSaving);
      const oldBar = document.getElementById("old-bar");
      const newBar = document.getElementById("new-bar");
      if (oldBar) oldBar.style.width = `${Math.max(4, currentAnnual / maximum * 100)}%`;
      if (newBar) newBar.style.width = `${Math.max(4, futureAnnual / maximum * 100)}%`;
      const caption = document.getElementById("save-caption");
      if (caption) caption.textContent = annualSaving >= 0 ? "現在との差額" : "見直し後のほうが高い試算です";
    };

    const button = document.getElementById("calculate-button");
    if (showLoading && button) {
      button.classList.add("is-loading");
      button.setAttribute("aria-busy", "true");
      window.setTimeout(() => {
        render();
        button.classList.remove("is-loading");
        button.removeAttribute("aria-busy");
      }, 180);
    } else {
      render();
    }
  }

  window.calc = () => calculateCosts(true);

  document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("cost-form");
    if (!form) return;
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      calculateCosts(true);
    });
    form.querySelectorAll("input").forEach((input) => {
      input.addEventListener("change", () => calculateCosts(false));
    });
    calculateCosts(false);
  });
})();
