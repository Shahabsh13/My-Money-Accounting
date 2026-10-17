(function () {
    var clean = function (value) { return String(value || "").replace(/\s+/g, " ").trim(); };
    var normalize = function (value) {
      return clean(value).replace(/[يى]/g, "ی").replace(/ك/g, "ک")
        .replace(/[\u200c\u200f\u202a-\u202e]/g, "").toLowerCase();
    };
    var readAccounts = function () {
      try {
        var raw = window.__safeGet ? window.__safeGet("hesabno:accounts_v5") : window.localStorage.getItem("hesabno:accounts_v5");
        var accounts = JSON.parse(raw || "null");
        return Array.isArray(accounts) ? accounts : [];
      } catch (error) { return []; }
    };
    var pictureFor = function (name, group, accounts) {
      if (window.__HESABNO_LOAN_LOGO && /(وام|تسهیلات)/u.test(normalize(name))) return window.__HESABNO_LOAN_LOGO;
      var target = normalize(name);
      var matches = accounts.filter(function (account) { return account && account.group === group && account.active !== false && account.name; });
      var account = matches.find(function (item) { return normalize(item.name) === target; });
      if (!account) {
        account = matches.filter(function (item) {
          var label = normalize(item.name);
          return label.length >= 4 && target.length >= 4 && (target.indexOf(label) !== -1 || label.indexOf(target) !== -1);
        }).sort(function (left, right) { return right.name.length - left.name.length; })[0];
      }
      return clean(account && (account.picture || account.icon || account.emoji)) || (group === "income" ? "💰" : "🧾");
    };
    var enhance = function () {
      var heading = Array.from(document.querySelectorAll("h2")).find(function (node) {
        return clean(node.textContent) === "نمودار دایره‌ای دسته‌ها";
      });
      if (!heading) return;
      var card = heading.closest("section");
      if (!card) return;
      var incomeTab = Array.from(card.querySelectorAll("button")).find(function (button) {
        return clean(button.textContent) === "توزیع درآمدها";
      });
      var group = incomeTab && String(incomeTab.className).indexOf("bg-emerald-500/20") !== -1 ? "income" : "expense";
      var accounts = readAccounts();
      card.querySelectorAll('button span[class*="text-[11px]"][class*="font-medium"][class*="truncate"]').forEach(function (label) {
        var row = label.parentElement;
        if (!row) return;
        var picture = pictureFor(label.textContent, group, accounts);
        var icon = row.querySelector("[data-hesabno-donut-category-icon]");
        if (!icon) {
          icon = document.createElement("span");
          icon.setAttribute("data-hesabno-donut-category-icon", "");
          icon.setAttribute("aria-hidden", "true");
          icon.className = "shrink-0";
          icon.style.cssText = "display:inline-flex;align-items:center;justify-content:center;flex:0 0 1rem;width:1rem;height:1rem;font-size:14px;line-height:1;overflow:hidden";
          row.insertBefore(icon, label);
        }
        if (icon.dataset.hesabnoPicture === group + "|" + picture) return;
        icon.replaceChildren();
        if (/^(https?:|data:image\/|blob:|\/|\.\.?\/)/i.test(picture) || /\.(png|jpe?g|svg|webp)(?:[?#]|$)/i.test(picture)) {
          var image = document.createElement("img");
          image.src = picture;
          image.alt = "";
          image.style.cssText = "width:100%;height:100%;object-fit:contain";
          icon.appendChild(image);
        } else icon.textContent = picture;
        icon.dataset.hesabnoPicture = group + "|" + picture;
      });
    };
    var queued = false;
    var schedule = function () {
      if (queued) return;
      queued = true;
      Promise.resolve().then(function () { queued = false; enhance(); });
    };
    enhance();
    window.__hesabnoDom.watch(document, { childList: true, characterData: true, subtree: true }, schedule);
    window.addEventListener("storage", schedule);
  })();
