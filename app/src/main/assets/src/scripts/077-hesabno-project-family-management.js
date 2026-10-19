(function () {
  var defaults = { projects: [], members: [] };
  var icons = { projects: ["🏢", "💼", "🛠️", "🏠", "✈️", "🛒", "🎓", "🎨", "💻", "🚗", "📦", "🌱"], members: ["👤", "👩", "👨", "👶", "👧", "👦", "👵", "👴", "👨‍👩‍👧‍👦", "🧑‍🤝‍🧑", "🐣", "❤️"] };
  var state = { type: "projects", modal: null, status: "" };
  var keyFor = function (type) { return type === "projects" ? "hesabno:projects" : "hesabno:familyMembers"; };
  var metaKey = function (type) { return type === "projects" ? "hesabno:projectMeta" : "hesabno:familyMemberMeta"; };
  var clean = function (value) { return String(value || "").replace(/\s+/g, " ").trim(); };
  var same = function (a, b) { return clean(a).toLocaleLowerCase() === clean(b).toLocaleLowerCase(); };
  var escapeHtml = function (value) { return String(value).replace(/[&<>"']/g, function (char) { if (char === "&") return "&amp;"; if (char === "<") return "&lt;"; if (char === ">") return "&gt;"; if (char.charCodeAt(0) === 34) return "&quot;"; return "&#039;"; }); };
  var read = function (type) { try { var value = JSON.parse(localStorage.getItem(keyFor(type)) || (type === "members" ? localStorage.getItem("hesabno:family_members") : "null") || "null"); return Array.isArray(value) ? value : defaults[type].slice(); } catch (error) { return defaults[type].slice(); } };
  var readMeta = function (type) { try { var value = JSON.parse(localStorage.getItem(metaKey(type)) || "null"); return value && typeof value === "object" ? value : {}; } catch (error) { return {}; } };
  var write = function (type, items, meta) { localStorage.setItem(keyFor(type), JSON.stringify(items)); if (type === "members") localStorage.setItem("hesabno:family_members", JSON.stringify(items)); localStorage.setItem(metaKey(type), JSON.stringify(meta)); };
  var itemMeta = function (type, name, index) { var meta = readMeta(type)[name] || {}; return { icon: meta.icon || icons[type][index % icons[type].length], description: meta.description || "" }; };
  var usedNames = function (type) {
    var found = new Set();
    try {
      var docs = JSON.parse(localStorage.getItem("hesabno:transactions") || "[]");
      if (!Array.isArray(docs)) return found;
      var field = type === "projects" ? "project" : "familyMember";
      docs.forEach(function (doc) { var name = clean(doc && doc[field]); if (name) found.add(name); });
    } catch (error) {}
    return found;
  };
  var page = function () { return document.getElementById("hesabno-project-family-page"); };
  var close = function () { var current = page(); if (current) current.remove(); window.dispatchEvent(new CustomEvent("hesabno:catalogs-changed")); };
  var openModal = function (index) {
    var items = read(state.type), meta = readMeta(state.type), name = index === -1 ? "" : items[index];
    var info = index === -1 ? { icon: icons[state.type][0], description: "" } : itemMeta(state.type, name, index);
    state.modal = { index: index, name: name, icon: info.icon, description: info.description, error: "" };
    render();
  };
  var renderModal = function (root) {
    if (!state.modal) return;
    var edit = state.modal.index !== -1, kind = state.type === "projects" ? "پروژه" : "عضو خانواده";
    var iconButtons = icons[state.type].map(function (icon) { return '<button type="button" class="hpf-icon" data-hpf-icon="' + icon + '" data-active="' + (state.modal.icon === icon) + '" aria-label="انتخاب آیکون ' + icon + '">' + icon + '</button>'; }).join("");
    root.insertAdjacentHTML("beforeend", '<div class="hpf-modal-layer" data-hpf-modal-layer><div class="hpf-modal" role="dialog" aria-modal="true"><div class="hpf-modal-header"><strong>' + (edit ? "ویرایش " : "افزودن ") + kind + '</strong><button class="hpf-close" data-hpf-action="close-modal" aria-label="بستن">×</button></div><div class="hpf-field"><label for="hpf-modal-name">نام ' + kind + '</label><input id="hpf-modal-name" value="' + escapeHtml(state.modal.name) + '" placeholder="مثلاً نام مورد نظر"></div><div class="hpf-field"><label>آیکون</label><div class="hpf-icons">' + iconButtons + '</div></div><div class="hpf-field"><label for="hpf-modal-description">توضیحات</label><textarea id="hpf-modal-description" placeholder="توضیح کوتاه و اختیاری">' + escapeHtml(state.modal.description) + '</textarea></div><div class="hpf-modal-status" aria-live="polite">' + escapeHtml(state.modal.error) + '</div><button class="hpf-modal-submit" data-hpf-action="save-modal">' + (edit ? "ذخیره تغییرات" : "افزودن " + kind) + '</button></div></div>');
    var input = root.querySelector("#hpf-modal-name");
    if (input) input.focus();
  };
  var render = function () {
    var root = page();
    if (!root) return;
    var type = state.type, isProjects = type === "projects", items = read(type), meta = readMeta(type), used = usedNames(type), title = isProjects ? "پروژه‌ها" : "اعضای خانواده", kind = isProjects ? "پروژه" : "عضو خانواده";
    var rows = items.length ? items.map(function (item, index) {
      var info = itemMeta(type, item, index), locked = used.has(item);
      return '<div class="hpf-item"><span class="hpf-item-icon">' + escapeHtml(info.icon) + '</span><div class="hpf-item-main"><div class="hpf-item-name">' + escapeHtml(item) + '</div>' + (info.description ? '<div class="hpf-item-description">' + escapeHtml(info.description) + '</div>' : '') + (locked ? '<span class="hpf-used">استفاده‌شده در سند</span>' : '') + '</div><div class="hpf-item-actions"><button class="hpf-action" data-hpf-action="edit" data-hpf-index="' + index + '">ویرایش</button><button class="hpf-action danger" data-hpf-action="delete" data-hpf-index="' + index + '" ' + (locked ? 'disabled title="این مورد در یک سند استفاده شده است"' : '') + '>حذف</button></div></div>';
    }).join("") : '<div class="hpf-empty">هنوز موردی ثبت نشده است.</div>';
    root.innerHTML = '<div class="hpf-shell"><header class="hpf-header"><button class="hpf-back" data-hpf-action="back" aria-label="بازگشت">‹</button><div><h1>مدیریت پروژه و خانواده</h1></div></header><main class="hpf-content"><div class="hpf-tabs"><button class="hpf-tab" data-hpf-type="projects" data-active="' + isProjects + '">پروژه‌ها</button><button class="hpf-tab" data-hpf-type="members" data-active="' + (!isProjects) + '">اعضای خانواده</button></div><section class="hpf-panel"><div class="hpf-panel-title"><strong>' + title + '</strong><span class="hpf-count">' + items.length + ' مورد</span></div><button class="hpf-add-button" data-hpf-action="open-add"><span>＋</span> افزودن ' + kind + '</button><div class="hpf-status" aria-live="polite">' + escapeHtml(state.status) + '</div><div class="hpf-list">' + rows + '</div></section></main></div>';
    renderModal(root);
  };
  var open = function () { if (page()) return; var root = document.createElement("div"); root.id = "hesabno-project-family-page"; document.body.appendChild(root); state = { type: "projects", modal: null, status: "" }; render(); };
  var onClick = function (event) {
    var target = event.target.closest("[data-hpf-action], [data-hpf-type], [data-hpf-icon]");
    if (!target) return;
    if (target.dataset.hpfType) { state.type = target.dataset.hpfType; state.modal = null; state.status = ""; render(); return; }
    if (target.dataset.hpfIcon && state.modal) { state.modal.icon = target.dataset.hpfIcon; render(); return; }
    var action = target.dataset.hpfAction;
    if (action === "back") { close(); return; }
    if (action === "open-add") { openModal(-1); return; }
    if (action === "close-modal") { state.modal = null; render(); return; }
    if (action === "save-modal") {
      var nameInput = document.getElementById("hpf-modal-name"), descriptionInput = document.getElementById("hpf-modal-description"), name = clean(nameInput && nameInput.value), description = clean(descriptionInput && descriptionInput.value), items = read(state.type), meta = readMeta(state.type), index = state.modal.index, oldName = index === -1 ? "" : items[index], used = usedNames(state.type);
      if (!name) { state.modal.error = "نام را وارد کنید."; render(); return; }
      if (items.some(function (item, itemIndex) { return itemIndex !== index && same(item, name); })) { state.modal.error = "این نام قبلاً ثبت شده است."; render(); return; }
      if (index !== -1 && used.has(oldName) && !same(oldName, name)) { state.modal.error = "این مورد در اسناد استفاده شده و نامش قابل تغییر نیست."; render(); return; }
      if (index === -1) items.push(name); else if (oldName !== name) { items[index] = name; meta[name] = meta[oldName] || {}; delete meta[oldName]; }
      meta[name] = { icon: state.modal.icon, description: description };
      write(state.type, items, meta); state.modal = null; state.status = index === -1 ? "مورد جدید اضافه شد." : "تغییرات ذخیره شد."; render(); return;
    }
    if (action === "edit") { openModal(Number(target.dataset.hpfIndex)); return; }
    if (action === "delete") {
      var deleteItems = read(state.type), deleteMeta = readMeta(state.type), deleteIndex = Number(target.dataset.hpfIndex), deleteName = deleteItems[deleteIndex];
      if (usedNames(state.type).has(deleteName)) { state.status = "این مورد در اسناد استفاده شده و قابل حذف نیست."; render(); return; }
      deleteItems.splice(deleteIndex, 1); delete deleteMeta[deleteName]; write(state.type, deleteItems, deleteMeta); state.status = "مورد حذف شد."; render();
    }
  };
  var onKey = function (event) { if (event.key !== "Enter" || !state.modal) return; var submit = document.querySelector('[data-hpf-action="save-modal"]'); if (submit && event.target.id === "hpf-modal-name") submit.click(); };
  document.addEventListener("click", onClick);
  document.addEventListener("keydown", onKey);
  var addCard = function () {
    if (page() || !document.querySelector("main h1") || !document.querySelector("main h1").textContent.includes("بیشتر و امکانات")) return;
    if (document.getElementById("hesabno-project-family-card")) return;
    var target = Array.from(document.querySelectorAll("main button")).find(function (button) { return button.textContent.includes("دوره‌ای و میانبرهای سریع"); });
    if (!target || !target.parentElement) return;
    var card = document.createElement("button"); card.id = "hesabno-project-family-card"; card.type = "button"; card.className = target.className;
    card.innerHTML = '<span class="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 flex-shrink-0 text-lg">👥</span><div class="grow min-w-0"><div class="flex items-center gap-2"><p class="font-bold text-xs text-stone-100 truncate">پروژه‌ها و اعضای خانواده</p><span class="px-2 py-0.5 rounded-full text-[9px] font-bold border bg-emerald-500/20 text-emerald-400 border-emerald-500/30">دو تب</span></div><p class="text-[10px] text-stone-400 mt-0.5 truncate">مدیریت مراکز هزینه و افراد خانواده</p></div><span class="text-stone-500 flex-shrink-0 text-lg">‹</span>';
    card.addEventListener("click", open); target.parentElement.insertBefore(card, target.nextSibling);
  };
  addCard();
  if (document.body) window.__hesabnoDom.watch(document.body, { childList: true, subtree: true }, addCard);
})();
