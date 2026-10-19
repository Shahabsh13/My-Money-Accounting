(function () {
    try {
      var key = "hesabno:shortcuts";
      var raw = window.localStorage.getItem(key);
      var shortcuts = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(shortcuts)) return;
      var changed = false;
      shortcuts.forEach(function (shortcut) {
        if (shortcut && (shortcut.id === 104 || shortcut.name === "شارژ ساختمان") && shortcut.to === "هزینه‌های عمومی و شارژ") {
          shortcut.to = "شارژ ساختمان و مجتمع";
          changed = true;
        }
      });
      if (!changed) return;
      var value = JSON.stringify(shortcuts);
      /* نگهبان مهاجرت (۶.۰): نوشتن + تأیید خواندن دوباره + بازگردانی خودکار در صورت شکست */
      if (window.__hesabnoMigration) {
        window.__hesabnoMigration.run("065-shortcut-category", [key], function (db) { db.set(key, value); });
        return;
      }
      window.localStorage.setItem(key, value);
    } catch (error) {}
  })();
