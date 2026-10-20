/*
 * نصب زودهنگام نگهبان نوشتن ذخیره‌سازی (مرحله ۶.۲) + موتور بومی SQLite اندروید + مدیریت پیوست‌ها و پشتیبان خودکار
 *
 * چرا اول از همه؟ چون ۰۰۰ و ۰۰۰b در همان بوت، حساب‌ها را می‌نویسند (~۹۳ کیلوبایت مجموع). اگر
 * سهمیه همان‌جا تمام شود، هیچ هشداری به کاربر نمی‌رسد. این اسکریپت پیش از ۰۰۰ بارگذاری می‌شود؛
 * فقط مشاهده می‌کند و خطا را دوباره پرتاب می‌کند، پس هیچ رفتاری تغییر نمی‌کند.
 *
 * هشدار «فضا پر شد» از ۰۰۴ به اینجا منتقل شد تا از اولین نوشتن فعال باشد؛ متن و محدودیت زمانی
 * ۱۰ ثانیه‌ای عیناً حفظ شده است.
 */
(function () {
  "use strict";
  try {
    var guard = window.HesabnoStorage && window.HesabnoStorage.guard;
    if (!guard) { try { console.warn("[hesabno] storage write guard module is not loaded"); } catch (ignored) {} return; }

    var ATT_PREFIX = "attref:";
    var TRANSPARENT_PIXEL = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    var attCache = Object.create(null);
    var nativeKvCache = Object.create(null);
    var nativeOverflowKeys = Object.create(null);
    var idbDatabasePromise = null;
    var restoringFromNative = false;
    var syncTimer = 0;
    var lastSerializedEntries = "";

    function getNativeBridge() {
      try {
        var b = window.HnBridge;
        if (b && typeof b === "object") return b;
      } catch (ignored) {}
      return null;
    }

    function getBridge() {
      var b = getNativeBridge();
      if (b && typeof b.readAutoBackup === "function" && typeof b.saveAutoBackup === "function") {
        return b;
      }
      return null;
    }

    function getSqlBridge() {
      var b = getNativeBridge();
      if (b && typeof b.sqlGetItem === "function" && typeof b.sqlSetItem === "function") {
        return b;
      }
      return null;
    }

    function isAttRef(val) {
      return typeof val === "string" && val.indexOf(ATT_PREFIX) === 0;
    }

    function sanitizeAttId(rawId) {
      var s = String(rawId || "").trim();
      if (s.indexOf(ATT_PREFIX) === 0) s = s.slice(ATT_PREFIX.length);
      s = s.replace(/[^A-Za-z0-9_\-]/g, "");
      return s.length > 80 ? s.slice(0, 80) : s;
    }

    function computeAttachmentId(dataUrl) {
      var str = String(dataUrl || "");
      // Bounded memoization avoids hashing repeated receipt strings in bulk imports.
      var cache = computeAttachmentId.cache || (computeAttachmentId.cache = new Map());
      if (cache.has(str)) return cache.get(str);
      var h1 = 0x811c9dc5;
      var h2 = 0x01000193;
      var len = str.length;
      // Hash every byte: sampling caused different receipt images to share an ID.
      var step = 1;
      for (var i = 0; i < len; i += step) {
        var c = str.charCodeAt(i);
        h1 ^= c;
        h1 = Math.imul(h1, 0x01000193);
        h2 ^= (c + i) & 0xff;
        h2 = Math.imul(h2, 0x85ebca6b);
      }
      var id = "att_" + len.toString(36) + "_" + (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36);
      var budget = 2 * 1024 * 1024;
      if (len <= budget) {
        var used = computeAttachmentId.cacheChars || 0;
        while (used + len > budget && cache.size) {
          var oldest = cache.keys().next().value;
          used -= oldest.length;
          cache.delete(oldest);
        }
        cache.set(str, id);
        computeAttachmentId.cacheChars = used + len;
      }
      return id;
    }

    function openAttIdb() {
      if (idbDatabasePromise) return idbDatabasePromise;
      try {
        var idb = window.indexedDB;
        if (!idb || typeof idb.open !== "function") return null;
        idbDatabasePromise = new Promise(function (resolve) {
          try {
            var req = idb.open("mm_attachments_store_v1", 1);
            req.onupgradeneeded = function () {
              try {
                var db = req.result;
                if (!db.objectStoreNames.contains("files")) {
                  db.createObjectStore("files");
                }
              } catch (ignored) {}
            };
            req.onsuccess = function () { resolve(req.result || null); };
            req.onerror = function () { resolve(null); };
          } catch (ignored) {
            resolve(null);
          }
        });
        return idbDatabasePromise;
      } catch (ignored) {
        return null;
      }
    }

    function idbPutAttachment(id, dataUrl) {
      var p = openAttIdb();
      if (!p) return;
      p.then(function (db) {
        if (!db) return;
        try {
          var tx = db.transaction("files", "readwrite");
          tx.objectStore("files").put(dataUrl, id);
        } catch (ignored) {}
      });
    }

    function refreshDomImagesForRef(ref, dataUrl) {
      try {
        if (!document || !document.querySelectorAll) return;
        var imgs = document.querySelectorAll('img[data-hesabno-attref="' + ref + '"]');
        for (var i = 0; i < imgs.length; i += 1) {
          imgs[i].src = dataUrl;
        }
      } catch (ignored) {}
    }

    function idbGetAttachmentAsync(id) {
      var p = openAttIdb();
      if (!p) return;
      p.then(function (db) {
        if (!db) return;
        try {
          var tx = db.transaction("files", "readonly");
          var req = tx.objectStore("files").get(id);
          req.onsuccess = function () {
            var val = req.result;
            if (typeof val === "string" && val.indexOf("data:") === 0) {
              attCache[id] = val;
              refreshDomImagesForRef(ATT_PREFIX + id, val);
            }
          };
        } catch (ignored) {}
      });
    }

    function preloadAttachmentsFromIdb() {
      var p = openAttIdb();
      if (!p) return;
      p.then(function (db) {
        if (!db) return;
        try {
          var tx = db.transaction("files", "readonly");
          var store = tx.objectStore("files");
          if (typeof store.openCursor === "function") {
            var curReq = store.openCursor();
            curReq.onsuccess = function () {
              var cursor = curReq.result;
              if (!cursor) return;
              var k = sanitizeAttId(cursor.key);
              var v = cursor.value;
              if (k && typeof v === "string" && v.indexOf("data:") === 0) {
                attCache[k] = v;
                refreshDomImagesForRef(ATT_PREFIX + k, v);
              }
              cursor.continue();
            };
          }
        } catch (ignored) {}
      });
    }

    function saveAttachment(dataUrl, preferredId, skipSchedule) {
      if (!dataUrl || typeof dataUrl !== "string") return "";
      var trimmed = dataUrl.trim();
      if (!trimmed) return "";
      if (isAttRef(trimmed)) return trimmed;
      if (trimmed.indexOf("data:") !== 0) return trimmed;
      var id = preferredId ? sanitizeAttId(preferredId) : "";
      if (!id) id = computeAttachmentId(trimmed);
      var alreadyCached = attCache[id] === trimmed;
      attCache[id] = trimmed;
      if (!alreadyCached) {
        var nb = getNativeBridge();
        if (nb && typeof nb.saveAttachment === "function") {
          try { nb.saveAttachment(id, trimmed); } catch (ignored) {}
        }
        idbPutAttachment(id, trimmed);
      }
      if (!skipSchedule) scheduleAutoBackup();
      return ATT_PREFIX + id;
    }

    function resolveAttachment(val) {
      if (!val || typeof val !== "string") return "";
      if (!isAttRef(val)) return val;
      var id = sanitizeAttId(val);
      if (!id) return "";
      if (attCache[id]) return attCache[id];
      var nb = getNativeBridge();
      if (nb && typeof nb.readAttachment === "function") {
        try {
          var fromNative = nb.readAttachment(id);
          if (typeof fromNative === "string" && fromNative.indexOf("data:") === 0) {
            attCache[id] = fromNative;
            return fromNative;
          }
        } catch (ignored) {}
      }
      idbGetAttachmentAsync(id);
      return attCache[id] || TRANSPARENT_PIXEL;
    }

    function exportAttachmentsMap() {
      var out = {};
      var nb = getNativeBridge();
      if (nb && typeof nb.exportAllAttachmentsJson === "function") {
        try {
          var raw = nb.exportAllAttachmentsJson();
          if (raw && typeof raw === "string") {
            var parsed = JSON.parse(raw);
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
              var nKeys = Object.keys(parsed);
              for (var i = 0; i < nKeys.length; i += 1) {
                var nk = sanitizeAttId(nKeys[i]);
                var nv = parsed[nKeys[i]];
                if (nk && typeof nv === "string" && nv.indexOf("data:") === 0) {
                  out[nk] = nv;
                  attCache[nk] = nv;
                }
              }
            }
          }
        } catch (ignored) {}
      }
      var cKeys = Object.keys(attCache);
      for (var j = 0; j < cKeys.length; j += 1) {
        var ck = cKeys[j];
        var cv = attCache[ck];
        if (ck && typeof cv === "string" && cv.indexOf("data:") === 0) {
          out[ck] = cv;
        }
      }
      return out;
    }

    function importAttachmentsMap(mapObj) {
      if (!mapObj || typeof mapObj !== "object" || Array.isArray(mapObj)) return 0;
      var cleanMap = {};
      var keys = Object.keys(mapObj);
      var count = 0;
      for (var i = 0; i < keys.length; i += 1) {
        var id = sanitizeAttId(keys[i]);
        var val = mapObj[keys[i]];
        if (id && typeof val === "string" && val.indexOf("data:") === 0) {
          attCache[id] = val;
          cleanMap[id] = val;
          idbPutAttachment(id, val);
          count += 1;
        }
      }
      if (count > 0) {
        var nb = getNativeBridge();
        if (nb && typeof nb.importAllAttachmentsJson === "function") {
          try { nb.importAllAttachmentsJson(JSON.stringify(cleanMap)); } catch (ignored) {}
        }
      }
      return count;
    }

    function offloadTransactionsArray(list) {
      if (!Array.isArray(list)) return list;
      var changed = false;
      for (var i = 0; i < list.length; i += 1) {
        var item = list[i];
        if (!item || typeof item !== "object") continue;
        if (typeof item.attachment === "string" && item.attachment.indexOf("data:") === 0) {
          item.attachment = saveAttachment(item.attachment, "", true);
          changed = true;
        }
        if (Array.isArray(item.returnPayments)) {
          for (var r = 0; r < item.returnPayments.length; r += 1) {
            var rp = item.returnPayments[r];
            if (rp && typeof rp.attachment === "string" && rp.attachment.indexOf("data:") === 0) {
              rp.attachment = saveAttachment(rp.attachment, "", true);
              changed = true;
            }
          }
        }
        if (item.check && typeof item.check === "object" && Array.isArray(item.check.returnPayments)) {
          for (var c = 0; c < item.check.returnPayments.length; c += 1) {
            var cp = item.check.returnPayments[c];
            if (cp && typeof cp.attachment === "string" && cp.attachment.indexOf("data:") === 0) {
              cp.attachment = saveAttachment(cp.attachment, "", true);
              changed = true;
            }
          }
        }
      }
      if (changed) scheduleAutoBackup();
      return list;
    }

    function offloadTransactionsJson(rawJson) {
      if (typeof rawJson !== "string" || rawJson.indexOf("data:") === -1) return rawJson;
      try {
        var parsed = JSON.parse(rawJson);
        if (!Array.isArray(parsed)) return rawJson;
        offloadTransactionsArray(parsed);
        return JSON.stringify(parsed);
      } catch (ignored) {
        return rawJson;
      }
    }

    /* ──────────────────────────────────────────────────────────────────────────
     * ۲) اتصال شفاف موتور SQLite بومی اندروید به Storage.prototype (پیش از نصب نگهبان)
     *    در اندروید، تمام کلیدها هم‌زمان در دیتابیس SQLite بومی (hesabno_native_store.db) ذخیره
     *    می‌شوند و اگر روزی حجم داده‌ها از سقف ۵ مگابایتی localStorage عبور کند، بدون خطای
     *    QuotaExceededError از روی SQLite بومی و کش حافظه سرویس‌دهی ادامه می‌یابد.
     * ────────────────────────────────────────────────────────────────────────── */
    function installNativeSqlStorageAdapter() {
      var sb = getSqlBridge();
      if (!sb || !Storage || !Storage.prototype || Storage.prototype.__hesabnoSqlAdapterInstalled) return;
      var origGet = Storage.prototype.getItem;
      var origSet = Storage.prototype.setItem;
      var origRem = Storage.prototype.removeItem;
      var origClr = Storage.prototype.clear;

      Storage.prototype.getItem = function (key) {
        var k = String(key);
        if (this === window.localStorage) {
          if (Object.prototype.hasOwnProperty.call(nativeKvCache, k)) {
            return nativeKvCache[k];
          }
          var lsVal = null;
          try { lsVal = origGet.call(this, k); } catch (ignored) { lsVal = null; }
          if (lsVal !== null && lsVal !== undefined) {
            nativeKvCache[k] = String(lsVal);
            return lsVal;
          }
          try {
            var sqlVal = sb.sqlGetItem(k);
            if (sqlVal !== null && sqlVal !== undefined) {
              var strVal = String(sqlVal);
              nativeKvCache[k] = strVal;
              return strVal;
            }
          } catch (ignored) {}
          return null;
        }
        return origGet.apply(this, arguments);
      };

      Storage.prototype.setItem = function (key, value) {
        if (this === window.localStorage) {
          var k = String(key);
          var v = String(value);
          if ((k === "hesabno:transactions" || k === "hesabno:checks") && v.indexOf("data:") !== -1) {
            v = offloadTransactionsJson(v);
          }
          var sqlSaved = false;
          try {
            sqlSaved = !!sb.sqlSetItem(k, v);
          } catch (ignored) {
            sqlSaved = false;
          }
          nativeKvCache[k] = v;
          try {
            var res = origSet.call(this, k, v);
            delete nativeOverflowKeys[k];
            return res;
          } catch (err) {
            if (sqlSaved && guard.classify(err) === "quota") {
              nativeOverflowKeys[k] = true;
              window.__hesabnoNativeSqlOverflowActive = true;
              return undefined;
            }
            throw err;
          }
        }
        return origSet.apply(this, arguments);
      };

      Storage.prototype.removeItem = function (key) {
        if (this === window.localStorage) {
          var k = String(key);
          delete nativeKvCache[k];
          delete nativeOverflowKeys[k];
          try { sb.sqlRemoveItem(k); } catch (ignored) {}
          scheduleAutoBackup();
        }
        return origRem.apply(this, arguments);
      };

      Storage.prototype.clear = function () {
        if (this === window.localStorage) {
          nativeKvCache = Object.create(null);
          nativeOverflowKeys = Object.create(null);
          try { sb.sqlClear(); } catch (ignored) {}
          scheduleAutoBackup();
        }
        return origClr.apply(this, arguments);
      };

      Storage.prototype.__hesabnoSqlAdapterInstalled = true;
    }

    installNativeSqlStorageAdapter();

    /*
     * skipUnchanged: حذف نوشتن بی‌تغییر. در بوت، هسته ۰۶۷ همان مقدارِ نوشته‌ی ۰۰۰b را دوباره
     * می‌نویسد (۳۱٬۱۱۷ بایت، بایت‌به‌بایت یکسان). این گزینه فقط همان نوشتن فیزیکی را حذف می‌کند؛
     * مقدار نهایی و ترتیب خواندن‌ها عوض نمی‌شود.
     */
    window.__hesabnoStorageGuard = guard.install({
      proto: Storage.prototype, win: window, skipUnchanged: true,
    });

    /* ──────────────────────────────────────────────────────────────────────────
     * ۳) فشرده‌سازی خودکار تصویر فیش/چک هنگام انتخاب (حداکثر ابعاد ۱۰۰۰ پیکسل، JPEG خوانا ~۳۵ کیلوبایت)
     * ────────────────────────────────────────────────────────────────────────── */
    function compressDataUrl(rawDataUrl, callback, options) {
      var opts = options || {};
      var maxDim = opts.maxDimension || 1000;
      var quality = opts.quality || 0.72;
      var minCharsToCompress = opts.minChars !== undefined ? opts.minChars : 60000;
      if (typeof callback !== "function") return;
      if (!rawDataUrl || typeof rawDataUrl !== "string" || rawDataUrl.indexOf("data:image/") !== 0 || rawDataUrl.indexOf("data:image/svg") === 0) {
        callback(rawDataUrl || "");
        return;
      }
      if (!opts.force && rawDataUrl.length <= minCharsToCompress) {
        callback(rawDataUrl);
        return;
      }
      try {
        if (!document || typeof document.createElement !== "function" || typeof window.Image !== "function") {
          callback(rawDataUrl);
          return;
        }
        var probeCanvas = document.createElement("canvas");
        var probeCtx = probeCanvas && typeof probeCanvas.getContext === "function" ? probeCanvas.getContext("2d") : null;
        if (!probeCtx) {
          callback(rawDataUrl);
          return;
        }
        var settled = false;
        var finish = function (res) {
          if (settled) return;
          settled = true;
          callback(res || rawDataUrl);
        };
        var timer = window.setTimeout(function () { finish(rawDataUrl); }, 1500);
        var img = new window.Image();
        img.onload = function () {
          window.clearTimeout(timer);
          try {
            var w = img.naturalWidth || img.width || 0;
            var h = img.naturalHeight || img.height || 0;
            if (w <= 0 || h <= 0) {
              finish(rawDataUrl);
              return;
            }
            if (w > maxDim || h > maxDim) {
              if (w >= h) {
                h = Math.max(1, Math.round((h * maxDim) / w));
                w = maxDim;
              } else {
                w = Math.max(1, Math.round((w * maxDim) / h));
                h = maxDim;
              }
            }
            probeCanvas.width = w;
            probeCanvas.height = h;
            probeCtx.fillStyle = "#ffffff";
            probeCtx.fillRect(0, 0, w, h);
            probeCtx.drawImage(img, 0, 0, w, h);
            var compressed = probeCanvas.toDataURL("image/jpeg", quality);
            if (typeof compressed === "string" && compressed.indexOf("data:image/") === 0 && (opts.force || compressed.length < rawDataUrl.length)) {
              finish(compressed);
            } else {
              finish(rawDataUrl);
            }
          } catch (ignored) {
            finish(rawDataUrl);
          }
        };
        img.onerror = function () {
          window.clearTimeout(timer);
          finish(rawDataUrl);
        };
        img.src = rawDataUrl;
      } catch (ignored) {
        callback(rawDataUrl);
      }
    }

    function readAndCompressImage(file, onSuccess, onError) {
      if (!file || typeof FileReader !== "function") {
        if (typeof onError === "function") onError();
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        if (typeof reader.result !== "string") {
          if (typeof onError === "function") onError();
          return;
        }
        compressDataUrl(reader.result, function (compressed) {
          if (typeof onSuccess === "function") onSuccess(compressed);
        });
      };
      reader.onerror = function () {
        if (typeof onError === "function") onError();
      };
      reader.readAsDataURL(file);
    }

    window.__hesabnoIsAttRef = isAttRef;
    window.__hesabnoSaveAttachment = saveAttachment;
    window.__hesabnoResolveAttachment = resolveAttachment;
    window.__hesabnoExportAttachmentsMap = exportAttachmentsMap;
    window.__hesabnoImportAttachmentsMap = importAttachmentsMap;
    window.__hesabnoOffloadTransactionsArray = offloadTransactionsArray;
    window.__hesabnoOffloadTransactionsJson = offloadTransactionsJson;
    window.__hesabnoCompressDataUrl = compressDataUrl;
    window.__hesabnoReadAndCompressImage = readAndCompressImage;

    /* ──────────────────────────────────────────────────────────────────────────
     * ۳.۵) انتخابگر منبع پیوست («دوربین» یا «گالری») هنگام کلیک روی دکمهٔ افزودن عکس فیش/چک
     * ────────────────────────────────────────────────────────────────────────── */
    var activeCameraInput = null;

    function closeAttachmentSourceModal() {
      if (!document || !document.getElementById) return;
      var existing = document.getElementById("hesabno-attachment-source-modal");
      if (existing) existing.remove();
    }

    function dataUrlToFileObject(dataUrl, fileName) {
      var str = String(dataUrl || "");
      var parts = str.split(",");
      var mimeMatch = parts[0] && parts[0].match(/:(.*?);/);
      var mime = (mimeMatch && mimeMatch[1]) || "image/jpeg";
      var b64 = parts[1] || "";
      var binStr = typeof window.atob === "function" ? window.atob(b64) : "";
      var len = binStr.length;
      var bytes = new Uint8Array(len);
      for (var i = 0; i < len; i += 1) {
        bytes[i] = binStr.charCodeAt(i);
      }
      var safeName = fileName || ("camera-receipt-" + Date.now() + ".jpg");
      try {
        if (typeof window.File === "function") {
          return new window.File([bytes], safeName, { type: mime });
        }
      } catch (ignored) {}
      var blob = new window.Blob([bytes], { type: mime });
      blob.name = safeName;
      return blob;
    }

    function receiveCameraPhoto(dataUrl, fileName) {
      if (!dataUrl || typeof dataUrl !== "string") return false;
      var target = activeCameraInput;
      if (!target && document && document.querySelector) {
        target = document.querySelector('input[type="file"][accept*="image"]');
      }
      if (!target) return false;
      compressDataUrl(dataUrl, function (compressed) {
        try {
          var fileObj = dataUrlToFileObject(compressed || dataUrl, fileName);
          var list = {
            0: fileObj,
            length: 1,
            item: function (idx) { return idx === 0 ? fileObj : null; },
          };
          try {
            Object.defineProperty(target, "files", {
              configurable: true,
              value: list,
            });
          } catch (ignored) {}
          var evt = typeof window.Event === "function"
            ? new window.Event("change", { bubbles: true })
            : null;
          if (evt && typeof target.dispatchEvent === "function") {
            target.dispatchEvent(evt);
          }
        } catch (ignored) {}
      });
      return true;
    }

    function openAttachmentSourceModal(fileInput) {
      if (!fileInput || !document || !document.body) return;
      closeAttachmentSourceModal();
      activeCameraInput = fileInput;

      var overlay = document.createElement("div");
      overlay.id = "hesabno-attachment-source-modal";
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-modal", "true");
      overlay.setAttribute("dir", "rtl");

      var card = document.createElement("div");
      card.className = "hesabno-att-source-card";
      card.addEventListener("click", function (e) { e.stopPropagation(); });

      var head = document.createElement("div");
      head.className = "hesabno-att-source-head";
      var title = document.createElement("h3");
      title.className = "hesabno-att-source-title";
      title.textContent = "افزودن تصویر پیوست";
      var sub = document.createElement("p");
      sub.className = "hesabno-att-source-sub";
      sub.textContent = "تصویر فیش یا چک را از چه طریقی انتخاب می‌کنید؟";
      head.appendChild(title);
      head.appendChild(sub);

      var grid = document.createElement("div");
      grid.className = "hesabno-att-source-grid";

      var camBtn = document.createElement("button");
      camBtn.type = "button";
      camBtn.className = "hesabno-att-source-btn";
      camBtn.setAttribute("data-hesabno-att-source", "camera");
      camBtn.innerHTML = '<span class="hesabno-att-source-icon" aria-hidden="true">📷</span><span class="hesabno-att-source-copy"><strong>ثبت عکس با دوربین</strong><small>عکس‌برداری مستقیم از فیش کاغذی یا برگ چک</small></span>';

      var galBtn = document.createElement("button");
      galBtn.type = "button";
      galBtn.className = "hesabno-att-source-btn";
      galBtn.setAttribute("data-hesabno-att-source", "gallery");
      galBtn.innerHTML = '<span class="hesabno-att-source-icon" aria-hidden="true">🖼️</span><span class="hesabno-att-source-copy"><strong>انتخاب از گالری گوشی</strong><small>انتخاب عکس یا اسکرین‌شات موجود در گالری</small></span>';

      grid.appendChild(camBtn);
      grid.appendChild(galBtn);

      var cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "hesabno-att-source-cancel";
      cancelBtn.setAttribute("data-hesabno-att-source", "cancel");
      cancelBtn.textContent = "انصراف";

      camBtn.addEventListener("click", function () {
        closeAttachmentSourceModal();
        activeCameraInput = fileInput;
        var nb = getNativeBridge();
        if (nb && typeof nb.captureCameraPhoto === "function") {
          try {
            nb.captureCameraPhoto();
            return;
          } catch (ignored) {}
        }
        try {
          fileInput.setAttribute("capture", "environment");
          fileInput.__hesabnoBypassSourceModal = true;
          fileInput.click();
        } finally {
          fileInput.__hesabnoBypassSourceModal = false;
        }
      });

      galBtn.addEventListener("click", function () {
        closeAttachmentSourceModal();
        try {
          fileInput.removeAttribute("capture");
          fileInput.__hesabnoBypassSourceModal = true;
          fileInput.click();
        } finally {
          fileInput.__hesabnoBypassSourceModal = false;
        }
      });

      cancelBtn.addEventListener("click", closeAttachmentSourceModal);
      overlay.addEventListener("click", closeAttachmentSourceModal);

      card.appendChild(head);
      card.appendChild(grid);
      card.appendChild(cancelBtn);
      overlay.appendChild(card);
      document.body.appendChild(overlay);
    }

    if (document && typeof document.addEventListener === "function") {
      document.addEventListener("click", function (event) {
        try {
          var target = event && event.target;
          if (!target || typeof target.closest !== "function") return;
          var input = null;
          if (target.tagName === "INPUT" && target.type === "file") {
            input = target;
          } else {
            var label = target.closest("label");
            if (label && typeof label.querySelector === "function") {
              input = label.querySelector('input[type="file"]');
            }
          }
          if (!input) return;
          var accept = String(input.getAttribute("accept") || "").toLowerCase();
          if (accept.indexOf("image") === -1) return;
          if (input.__hesabnoBypassSourceModal) return;
          event.preventDefault();
          event.stopPropagation();
          openAttachmentSourceModal(input);
        } catch (ignored) {}
      }, true);
    }

    window.__hesabnoOpenAttachmentSourceModal = openAttachmentSourceModal;
    window.__hesabnoReceiveCameraPhoto = receiveCameraPhoto;

    preloadAttachmentsFromIdb();

    /* ──────────────────────────────────────────────────────────────────────────
     * ۴) لایهٔ اول محافظت خودکار از اطلاعات در برابر حذف و نصب مجدد (SQLite + Auto Backup + Cloud Mirror)
     * ────────────────────────────────────────────────────────────────────────── */
    function restoreFromNativeIfNeeded() {
      var bridge = getBridge();
      var sb = getSqlBridge();
      if (!bridge && !sb) return false;
      try {
        var ls = window.localStorage;
        if (!ls) return false;

        // ۱) بارگذاری از دیتابیس بومی SQLite اندروید (در صورت وجود داده‌های ذخیره‌شده یا سرریز از ۵ مگابایت)
        if (sb && typeof sb.sqlExportAllJson === "function") {
          try {
            var sqlRaw = sb.sqlExportAllJson();
            if (sqlRaw && typeof sqlRaw === "string" && sqlRaw.length > 2) {
              var sqlEntries = JSON.parse(sqlRaw);
              if (sqlEntries && typeof sqlEntries === "object" && !Array.isArray(sqlEntries)) {
                var sqlKeys = Object.keys(sqlEntries);
                if (sqlKeys.length > 0) {
                  restoringFromNative = true;
                  try {
                    for (var s = 0; s < sqlKeys.length; s += 1) {
                      var sk = sqlKeys[s];
                      var sv = sqlEntries[sk];
                      if (typeof sv === "string") {
                        if ((sk === "hesabno:transactions" || sk === "hesabno:checks") && sv.indexOf("data:") !== -1) {
                          sv = offloadTransactionsJson(sv);
                        }
                        nativeKvCache[sk] = sv;
                        ls.setItem(sk, sv);
                      }
                    }
                    window.__hesabnoSqlStoreHydrated = true;
                    return true;
                  } finally {
                    restoringFromNative = false;
                  }
                }
              }
            }
          } catch (ignored) {
            restoringFromNative = false;
          }
        }

        if (ls.getItem("hesabno:accounts_v5") !== null || ls.getItem("hesabno:transactions") !== null) {
          return false;
        }
        if (!bridge) return false;
        var raw = bridge.readAutoBackup();
        if (!raw || typeof raw !== "string") return false;
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && parsed.attachments && typeof parsed.attachments === "object") {
          importAttachmentsMap(parsed.attachments);
        }
        var entries = parsed && typeof parsed === "object" ? (parsed.entries || parsed.storageData) : null;
        if (!entries || typeof entries !== "object" || Array.isArray(entries)) return false;
        var keys = Object.keys(entries);
        if (!keys.length) return false;
        restoringFromNative = true;
        try {
          var normalizedEntries = {};
          for (var i = 0; i < keys.length; i += 1) {
            var k = keys[i];
            var v = entries[k];
            if (typeof v === "string") {
              if ((k === "hesabno:transactions" || k === "hesabno:checks") && v.indexOf("data:") !== -1) {
                v = offloadTransactionsJson(v);
              }
              normalizedEntries[k] = v;
              nativeKvCache[k] = v;
              ls.setItem(k, v);
            }
          }
          if (sb && typeof sb.sqlImportAllJson === "function") {
            try { sb.sqlImportAllJson(JSON.stringify(normalizedEntries)); } catch (ignored) {}
          }
          window.__hesabnoAutoBackupRestored = true;
          return true;
        } finally {
          restoringFromNative = false;
        }
      } catch (ignored) {
        restoringFromNative = false;
        return false;
      }
    }

    function collectAllEntries() {
      var entries = {};
      var ls = window.localStorage;
      if (ls) {
        var keyList = [];
        for (var i = 0; i < ls.length; i += 1) {
          var key = ls.key(i);
          if (key) keyList.push(key);
        }
        keyList.sort();
        for (var j = 0; j < keyList.length; j += 1) {
          var k = keyList[j];
          var val = ls.getItem(k);
          if (typeof val === "string") entries[k] = val;
        }
      }
      var cachedKeys = Object.keys(nativeKvCache);
      for (var c = 0; c < cachedKeys.length; c += 1) {
        var ck = cachedKeys[c];
        if (typeof nativeKvCache[ck] === "string") {
          entries[ck] = nativeKvCache[ck];
        }
      }
      return entries;
    }

    function flushAutoBackup(forExit) {
      if (forExit !== "rolling" && syncTimer) {
        window.clearTimeout(syncTimer);
        syncTimer = 0;
      }
      if (restoringFromNative) return false;
      var bridge = getBridge();
      if (!bridge) return false;
      try {
        var entries = collectAllEntries();
        if (!entries["hesabno:accounts_v5"] && !entries["hesabno:transactions"]) {
          return false;
        }
        var attMap = exportAttachmentsMap();
        var serializedState = JSON.stringify({ e: entries, a: Object.keys(attMap).sort() });
        if (forExit !== true && forExit !== "rolling" && serializedState === lastSerializedEntries) return true;
        var parseKey = function (name, fallback) {
          try {
            var rawVal = entries[name];
            return rawVal ? JSON.parse(rawVal) : fallback;
          } catch (e) {
            return fallback;
          }
        };
        var storageData = typeof window.__hesabnoCaptureResetData === "function"
          ? window.__hesabnoCaptureResetData()
          : undefined;
        if (storageData && typeof storageData === "object") {
          storageData["hesabno:local_snapshots"] = null;
          storageData["hesabno:exported_files"] = null;
        }
        var payload = JSON.stringify({
          version: "5.1",
          updatedAt: Date.now(),
          timestamp: Date.now(),
          currency: entries["hesabno:currency"] || "rial",
          accounts: parseKey("hesabno:accounts_v5", []),
          transactions: parseKey("hesabno:transactions", []),
          storageData: storageData,
          entries: entries,
          attachments: attMap,
        });
        var saved = forExit === true
          ? (typeof bridge.saveExitBackup === "function" && bridge.saveExitBackup(payload) === true)
          : forExit === "rolling"
            ? (typeof bridge.saveRollingBackup === "function" && bridge.saveRollingBackup(payload) === true)
            : !!bridge.saveAutoBackup(payload);
        if (saved && forExit !== true && forExit !== "rolling") lastSerializedEntries = serializedState;
        return saved;
      } catch (ignored) {
        return false;
      }
    }

    function scheduleAutoBackup() {
      if (restoringFromNative || !getBridge()) return;
      if (syncTimer) window.clearTimeout(syncTimer);
      syncTimer = window.setTimeout(flushAutoBackup, 120);
    }

    window.__hesabnoFlushAutoBackup = flushAutoBackup;
    window.__hesabnoRestoreAutoBackup = restoreFromNativeIfNeeded;

    restoreFromNativeIfNeeded();

    if (getBridge() && window.__hesabnoStorageGuard && typeof window.__hesabnoStorageGuard.onWrite === "function") {
      window.__hesabnoStorageGuard.onWrite(function () {
        scheduleAutoBackup();
      });
    }

    try {
      var origRemove = Storage.prototype.removeItem;
      var origClear = Storage.prototype.clear;
      if (typeof origRemove === "function" && !origRemove.__hesabnoAutoBackupWrapped && !Storage.prototype.__hesabnoSqlAdapterInstalled) {
        var wrappedRemove = function (key) {
          var res = origRemove.apply(this, arguments);
          if (this === window.localStorage) scheduleAutoBackup();
          return res;
        };
        wrappedRemove.__hesabnoAutoBackupWrapped = true;
        Storage.prototype.removeItem = wrappedRemove;
      }
      if (typeof origClear === "function" && !origClear.__hesabnoAutoBackupWrapped && !Storage.prototype.__hesabnoSqlAdapterInstalled) {
        var wrappedClear = function (key) {
          var res = origClear.apply(this, arguments);
          if (this === window.localStorage) scheduleAutoBackup();
          return res;
        };
        wrappedClear.__hesabnoAutoBackupWrapped = true;
        Storage.prototype.clear = wrappedClear;
      }
    } catch (ignored) {}

    window.addEventListener("DOMContentLoaded", function () { scheduleAutoBackup(); });
    window.addEventListener("pagehide", function () { flushAutoBackup(); });
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden") flushAutoBackup();
    });
  } catch (error) {
    /* نبود نگهبان نباید بوت را بشکند */
    try { console.warn("[hesabno]", error); } catch (ignored) {}
  }
})();
