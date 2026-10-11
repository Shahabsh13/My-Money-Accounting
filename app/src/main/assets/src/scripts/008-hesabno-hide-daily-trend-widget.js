(function () {
  var key = "hesabno:homeWidgets";
  var memory = window.__hesabnoMemoryStorage = window.__hesabnoMemoryStorage || {};
  var value = null;
  try { value = window.localStorage.getItem(key); } catch (error) {}
  if (value == null && Object.prototype.hasOwnProperty.call(memory, key)) value = memory[key];
  var widgets = {};
  try { widgets = value ? JSON.parse(value) : {}; } catch (error) {}
  if (!widgets || typeof widgets !== "object" || Array.isArray(widgets)) widgets = {};
  if (Object.prototype.hasOwnProperty.call(widgets, "chartTrend")) return;
  widgets.chartTrend = false;
  value = JSON.stringify(widgets);
  try { window.localStorage.setItem(key, value); delete memory[key]; }
  catch (error) { memory[key] = value; }
})();
