(function () {
    /* قواعد ظاهری پنل پشتیبان رمزگذاری‌شده (.hesabno-secure-backup) در بستهٔ ۲۳۵ قرار دارد. */

    function patchBudgetBack() {
      var main = document.querySelector("main");
      if (!main || !/بودجه‌بندی هوشمند/.test(main.textContent || "")) return;
      var button = Array.prototype.find.call(main.querySelectorAll("button"), function (node) {
        return !node.textContent.trim() && !node.getAttribute("aria-label") && !node.title && node.querySelector("svg");
      });
      if (button) button.setAttribute("aria-label", "بازگشت از صفحه بودجه‌بندی هوشمند");
    }

    function base64(bytes) {
      var binary = "";
      bytes.forEach(function (byte) { binary += String.fromCharCode(byte); });
      return btoa(binary);
    }

    function unbase64(value) {
      var binary = atob(value);
      var bytes = new Uint8Array(binary.length);
      for (var i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      return bytes;
    }

    async function deriveKey(passphrase, salt, iterations) {
      var material = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
      return crypto.subtle.deriveKey({ name: "PBKDF2", salt: salt, iterations: iterations, hash: "SHA-256" }, material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    }

    function appEntries() {
      var result = [];
      for (var i = 0; i < localStorage.length; i += 1) {
        var key = localStorage.key(i);
        if (key && key.indexOf("hesabno:") === 0) result.push([key, localStorage.getItem(key)]);
      }
      return result;
    }

    function mountEncryptedBackup() {
      var existing = document.getElementById("hesabno-encrypted-backup");
      if (!window.__hesabnoEnableEncryptedBackupUi) {
        if (existing) existing.remove();
        return;
      }
      var download = Array.prototype.find.call(document.querySelectorAll("button"), function (button) {
        return button.textContent.trim() === "دانلود فایل پشتیبان (JSON)";
      });
      if (!download || existing) return;
      var content = download.closest('div[class*="overflow-y-auto"]');
      if (!content) return;
      var box = document.createElement("section");
      box.id = "hesabno-encrypted-backup";
      box.className = "hesabno-secure-backup";
      box.innerHTML = '<h3>پشتیبان رمزگذاری‌شده</h3><p>این خروجی با AES-GCM و گذرواژهٔ انتخابی شما رمز می‌شود. گذرواژه را جداگانه و امن نگه دارید؛ بدون آن بازیابی ممکن نیست. داده‌های فعال مرورگر همچنان محلی و رمزگذاری‌نشده‌اند.</p><label for="hsb-passphrase">گذرواژهٔ پشتیبان (حداقل ۱۲ نویسه)</label><input id="hsb-passphrase" type="password" minlength="12" autocomplete="new-password" placeholder="یک گذرواژهٔ قوی وارد کنید"><div class="hsb-actions"><button type="button" data-hsb-export>دانلود پشتیبان رمزگذاری‌شده</button><button type="button" data-hsb-import>بازیابی از پشتیبان رمزگذاری‌شده</button><input type="file" data-hsb-file accept="application/json,.json" hidden></div><p data-hsb-status role="status" aria-live="polite"></p>';
      content.insertBefore(box, content.firstElementChild);
      var passInput = box.querySelector("#hsb-passphrase");
      var status = box.querySelector("[data-hsb-status]");
      var exportButton = box.querySelector("[data-hsb-export]");
      var importButton = box.querySelector("[data-hsb-import]");
      var fileInput = box.querySelector("[data-hsb-file]");
      function say(message, error) {
        status.textContent = message;
        status.dataset.error = error ? "true" : "false";
      }
      function validPassphrase() {
        if (!window.crypto || !crypto.subtle) { say("رمزنگاری امن در این مرورگر در دسترس نیست؛ از پشتیبان‌گیری معمولی استفاده کنید.", true); return null; }
        if (passInput.value.length < 12) { say("برای ادامه، گذرواژه‌ای با حداقل ۱۲ نویسه وارد کنید.", true); passInput.focus(); return null; }
        return passInput.value;
      }
      exportButton.addEventListener("click", async function () {
        var passphrase = validPassphrase();
        if (!passphrase) return;
        exportButton.disabled = true;
        try {
          var entries = appEntries();
          if (!entries.length) throw new Error("داده‌ای برای پشتیبان‌گیری پیدا نشد.");
          var salt = crypto.getRandomValues(new Uint8Array(16));
          var iv = crypto.getRandomValues(new Uint8Array(12));
          var iterations = 310000;
          var key = await deriveKey(passphrase, salt, iterations);
          var plaintext = new TextEncoder().encode(JSON.stringify({ version: 1, createdAt: new Date().toISOString(), entries: entries }));
          var encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, plaintext);
          var backup = { format: "hesabno-encrypted-backup", version: 1, kdf: { name: "PBKDF2", hash: "SHA-256", iterations: iterations, salt: base64(salt) }, cipher: { name: "AES-GCM", iv: base64(iv) }, ciphertext: base64(new Uint8Array(encrypted)) };
          var url = URL.createObjectURL(new Blob([JSON.stringify(backup)], { type: "application/json" }));
          var link = document.createElement("a");
          link.href = url;
          link.download = "hesabno-encrypted-backup-" + new Date().toISOString().slice(0, 10) + ".json";
          link.click();
          setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
          say("فایل پشتیبان رمزگذاری‌شده دانلود شد. بازیابی آن فقط با همین گذرواژه ممکن است.", false);
        } catch (error) { say(error && error.message ? error.message : "ساخت پشتیبان انجام نشد.", true); }
        finally { exportButton.disabled = false; }
      });
      importButton.addEventListener("click", function () { if (validPassphrase()) fileInput.click(); });
      fileInput.addEventListener("change", async function () {
        var file = fileInput.files && fileInput.files[0];
        var passphrase = passInput.value;
        if (!file) return;
        if (file.size > 30 * 1024 * 1024) { say("حجم فایل بیش از ۳۰ مگابایت است.", true); fileInput.value = ""; return; }
        try {
          var backup = JSON.parse(await file.text());
          if (backup.format !== "hesabno-encrypted-backup" || backup.version !== 1 || backup.cipher.name !== "AES-GCM" || backup.kdf.name !== "PBKDF2" || backup.kdf.hash !== "SHA-256" || backup.kdf.iterations !== 310000) throw new Error("قالب پشتیبان پشتیبانی نمی‌شود.");
          var key = await deriveKey(passphrase, unbase64(backup.kdf.salt), backup.kdf.iterations);
          var plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unbase64(backup.cipher.iv) }, key, unbase64(backup.ciphertext));
          var snapshot = JSON.parse(new TextDecoder().decode(plaintext));
          if (snapshot.version !== 1 || !Array.isArray(snapshot.entries) || snapshot.entries.length > 10000 || snapshot.entries.some(function (entry) { return !Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== "string" || entry[0].indexOf("hesabno:") !== 0 || typeof entry[1] !== "string"; })) throw new Error("ساختار دادهٔ پشتیبان معتبر نیست.");
          if (!window.confirm("بازیابی، همهٔ داده‌های فعلی My Money را با داده‌های این فایل جایگزین می‌کند. ابتدا از دادهٔ فعلی پشتیبان بگیرید. ادامه می‌دهید؟")) { say("بازیابی لغو شد؛ داده‌های فعلی تغییر نکردند.", false); return; }
          var previous = appEntries();
          try {
            previous.forEach(function (entry) { localStorage.removeItem(entry[0]); });
            snapshot.entries.forEach(function (entry) { localStorage.setItem(entry[0], entry[1]); });
          } catch (writeError) {
            appEntries().forEach(function (entry) { localStorage.removeItem(entry[0]); });
            previous.forEach(function (entry) { localStorage.setItem(entry[0], entry[1]); });
            throw new Error("ذخیرهٔ بازیابی انجام نشد؛ نسخهٔ قبلی نگه داشته شد.");
          }
          say("بازیابی کامل شد؛ صفحه برای بارگذاری داده‌ها تازه‌سازی می‌شود.", false);
          setTimeout(function () { window.__hesabnoSoftReload(); }, 700);
        } catch (error) { say("بازیابی ناموفق بود؛ گذرواژه یا سالم‌بودن فایل را بررسی کنید.", true); }
        finally { fileInput.value = ""; }
      });
    }

    function update() { patchBudgetBack(); mountEncryptedBackup(); }
    update();
    window.__hesabnoDom.watch(document.documentElement, { childList: true, subtree: true }, update);
  })();
