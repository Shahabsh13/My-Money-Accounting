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
      if (changed) window.localStorage.setItem(key, JSON.stringify(shortcuts));
    } catch (error) {}
  })();
