/*
 * لایه‌ی دامنه — قرارداد همگام‌سازی (مرحله ۹)
 *
 * هدف: آماده‌کردن داده برای همگام‌سازی **بدون شبکه، بدون تغییر قالب محلی و بدون کلید تازه**.
 * این ماژول فقط شکل قابل‌انتقال داده را تعریف می‌کند و ادغام سه‌طرفه را انجام می‌دهد:
 *
 *   buildDocument(model)              → سند متعارف و نسخه‌دار (کلید هر موجودیت = شناسه‌ی پایدار)
 *   parseDocument(text)               → اعتبارسنجی فایل/پیام دریافتی با خطای روشن
 *   fingerprint(document)             → اثر انگشت کوتاه برای مقایسه‌ی سریع نسخه‌ها
 *   merge(base, local, remote, opts)  → ادغام سه‌طرفه با گزارش تعارض (بدون بازنویسی بی‌صدا)
 *   toCollections(document)           → بازگشت به همان آرایه‌های برنامه، با حفظ ترتیب
 *
 * چرا سه‌طرفه؟ بدون «نسخه‌ی پایه» نمی‌توان فهمید کدام طرف عوض شده است. تعارض فقط زمانی
 * گزارش می‌شود که **هر دو طرف** یک موجودیت را متفاوت عوض کرده باشند؛ تغییر یک‌طرفه همیشه
 * بدون تعارض اعمال می‌شود. سیاست پیش‌فرض «unresolved» است: مقدار محلی نگه داشته می‌شود و
 * تعارض صریحاً برگردانده می‌شود تا هیچ ویرایشی بی‌صدا از بین نرود.
 *
 * وابستگی: هیچ. DOM/شبکه/ذخیره‌سازی ندارد و در index.html بارگذاری نمی‌شود.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else (root.HesabnoDomain = root.HesabnoDomain || {}).sync = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var FORMAT = "hesabno-sync";
  var VERSION = 1;
  var COLLECTIONS = ["accounts", "transactions", "checks", "loans", "installments",
    "budgets", "fiscalYears", "shortcuts", "projects", "familyMembers"];

  /* ---------- متعارف‌سازی ---------- */

  function isPlainObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }

  /* کلیدها بازگشتی مرتب می‌شوند تا خروجی برای داده‌ی یکسان همیشه یک رشته باشد */
  function canonicalize(value) {
    if (Array.isArray(value)) return value.map(canonicalize);
    if (isPlainObject(value)) {
      var keys = Object.keys(value).filter(function (key) { return value[key] !== undefined; }).sort();
      var result = {};
      for (var index = 0; index < keys.length; index += 1) result[keys[index]] = canonicalize(value[keys[index]]);
      return result;
    }
    if (typeof value === "number" && !isFinite(value)) return null;
    return value;
  }

  function canonicalText(value) {
    return JSON.stringify(canonicalize(value));
  }

  /*
   * اثر انگشت ۶۴ بیتی (دو FNV-1a با آفست متفاوت). رمزنگاری نیست؛ فقط برچسب سریع نسخه است.
   * درستی تصمیم‌ها به این هش وابسته **نیست** — مقایسه‌ها همیشه روی متن متعارف انجام می‌شود،
   * تا حتی برخورد هش هم نتواند تغییری را پنهان کند.
   */
  function fingerprint(value) {
    var text = typeof value === "string" ? value : canonicalText(value);
    var hashA = 0x811c9dc5;
    var hashB = 0x01000193;
    for (var index = 0; index < text.length; index += 1) {
      var code = text.charCodeAt(index);
      hashA = (hashA ^ code) >>> 0;
      hashA = Math.imul(hashA, 0x01000193) >>> 0;
      hashB = (hashB + code) >>> 0;
      hashB = Math.imul(hashB, 0x85ebca6b) >>> 0;
    }
    var left = ("00000000" + hashA.toString(16)).slice(-8);
    var right = ("00000000" + hashB.toString(16)).slice(-8);
    return left + right;
  }

  /*
   * شناسه‌ی موجودیت: شناسه‌ی خود رکورد؛ اگر نداشت، شناسه‌ای از محتوای متعارف.
   * شناسه‌ی مشتق‌شده فقط در سند است و هرگز در داده‌ی محلی نوشته نمی‌شود.
   */
  function entityId(entity) {
    if (entity && entity.id !== undefined && entity.id !== null && entity.id !== "") return String(entity.id);
    return "~" + fingerprint(entity);
  }

  /* ---------- ساخت و خواندن سند ---------- */

  /*
   * model: { accounts: [...], transactions: [...], ... }
   * options: { deletions: { accounts: [id], ... }, meta: {...}, createdAt: ISO }
   * خروجی: { format, version, createdAt, meta, collections: {name: {order:[id], entities:{id:canonical}}},
   *          deletions: {name:[id]} }
   */
  function buildDocument(model, options) {
    var opts = options || {};
    var source = model || {};
    var deletionsInput = opts.deletions || {};
    var collections = {};
    var deletions = {};
    var errors = [];
    var counts = {};

    for (var collectionIndex = 0; collectionIndex < COLLECTIONS.length; collectionIndex += 1) {
      var name = COLLECTIONS[collectionIndex];
      var list = source[name] === undefined ? [] : source[name];
      if (!Array.isArray(list)) {
        errors.push({ code: "collection-type", collection: name, message: "«" + name + "» باید آرایه باشد" });
        list = [];
      }
      var order = [];
      var entities = {};
      var seen = new Map();
      for (var itemIndex = 0; itemIndex < list.length; itemIndex += 1) {
        var entity = list[itemIndex];
        if (!isPlainObject(entity)) {
          errors.push({ code: "entity-shape", collection: name, index: itemIndex, message: "موجودیت باید شیء باشد" });
          continue;
        }
        var id = entityId(entity);
        if (seen.has(id)) {
          errors.push({
            code: "duplicate-id", collection: name, id: id,
            message: "شناسه‌ی تکراری در «" + name + "»: " + id + " (مقدارهای " + seen.get(id) + " و " + entity.id + ")",
          });
          continue;
        }
        seen.set(id, entity.id);
        order.push(id);
        entities[id] = canonicalize(entity);
      }
      collections[name] = { order: order, entities: entities };
      counts[name] = order.length;

      var deleted = Array.isArray(deletionsInput[name]) ? deletionsInput[name] : [];
      var tombstones = [];
      for (var deleteIndex = 0; deleteIndex < deleted.length; deleteIndex += 1) {
        var tombstone = String(deleted[deleteIndex]);
        if (entities[tombstone] !== undefined) {
          errors.push({ code: "tombstone-conflict", collection: name, id: tombstone, message: "موجودیت هم حاضر و هم حذف‌شده است" });
          continue;
        }
        if (tombstones.indexOf(tombstone) === -1) tombstones.push(tombstone);
      }
      if (tombstones.length) deletions[name] = tombstones.sort();
    }

    var document = {
      format: FORMAT,
      version: VERSION,
      createdAt: opts.createdAt || null,
      meta: canonicalize(opts.meta || {}),
      collections: collections,
      deletions: deletions,
    };
    return {
      ok: errors.length === 0,
      errors: errors,
      document: document,
      counts: counts,
      fingerprint: fingerprint(document),
    };
  }

  function parseDocument(input) {
    var errors = [];
    var document = input;
    if (typeof input === "string") {
      try {
        document = JSON.parse(input);
      } catch (error) {
        return { ok: false, errors: [{ code: "json", message: "متن سند JSON معتبر نیست" }], document: null };
      }
    }
    if (!isPlainObject(document)) {
      return { ok: false, errors: [{ code: "not-object", message: "سند باید شیء باشد" }], document: null };
    }
    if (document.format !== FORMAT) errors.push({ code: "format", message: "قالب سند همگام‌سازی نیست" });
    if (Number(document.version) !== VERSION) errors.push({ code: "version", message: "نسخه‌ی سند پشتیبانی نمی‌شود (انتظار: 1)" });
    if (!isPlainObject(document.collections)) errors.push({ code: "collections", message: "بخش collections نیست" });

    var counts = {};
    if (isPlainObject(document.collections)) {
      for (var index = 0; index < COLLECTIONS.length; index += 1) {
        var name = COLLECTIONS[index];
        var collection = document.collections[name];
        if (collection === undefined) { counts[name] = 0; continue; }
        if (!isPlainObject(collection) || !Array.isArray(collection.order) || !isPlainObject(collection.entities)) {
          errors.push({ code: "collection-shape", collection: name, message: "ساختار مجموعه‌ی «" + name + "» نامعتبر است" });
          continue;
        }
        var seen = new Set();
        for (var orderIndex = 0; orderIndex < collection.order.length; orderIndex += 1) {
          var id = String(collection.order[orderIndex]);
          if (seen.has(id)) errors.push({ code: "order-duplicate", collection: name, id: id, message: "شناسه‌ی تکراری در ترتیب" });
          seen.add(id);
          if (!isPlainObject(collection.entities[id])) {
            errors.push({ code: "entity-missing", collection: name, id: id, message: "موجودیتِ ترتیب‌شده در سند نیست" });
          }
        }
        for (var entityIdKey in collection.entities) {
          if (collection.entities.hasOwnProperty(entityIdKey) && !seen.has(entityIdKey)) {
            errors.push({ code: "entity-unordered", collection: name, id: entityIdKey, message: "موجودیتی در ترتیب نیست" });
          }
        }
        counts[name] = seen.size;
      }
    }
    if (document.deletions !== undefined && !isPlainObject(document.deletions)) {
      errors.push({ code: "deletions", message: "بخش deletions نامعتبر است" });
    }
    return { ok: errors.length === 0, errors: errors, document: document, counts: counts, fingerprint: errors.length ? null : fingerprint(document) };
  }

  /* بازگشت به آرایه‌های برنامه — ترتیب سند حفظ می‌شود (همان ترتیبی که UI می‌شناسد) */
  function toCollections(document) {
    var result = {};
    var collections = (document && document.collections) || {};
    for (var index = 0; index < COLLECTIONS.length; index += 1) {
      var name = COLLECTIONS[index];
      var collection = collections[name];
      if (!collection) { result[name] = []; continue; }
      var list = [];
      for (var orderIndex = 0; orderIndex < collection.order.length; orderIndex += 1) {
        var id = String(collection.order[orderIndex]);
        if (collection.entities[id]) list.push(JSON.parse(JSON.stringify(collection.entities[id])));
      }
      result[name] = list;
    }
    return result;
  }

  /* ---------- ادغام سه‌طرفه ---------- */

  function entriesOf(documentImpl, name) {
    var collection = documentImpl.collections && documentImpl.collections[name];
    return collection || { order: [], entities: {} };
  }

  function sortedUnion() {
    var set = new Set();
    for (var index = 0; index < arguments.length; index += 1) {
      var list = arguments[index] || [];
      for (var itemIndex = 0; itemIndex < list.length; itemIndex += 1) set.add(String(list[itemIndex]));
    }
    return Array.from(set).sort();
  }

  /*
   * merge(base, local, remote, options)
   * هر سه سند باید با buildDocument/parseDocument ساخته شده باشند.
   * options.conflictPolicy: "unresolved" (پیش‌فرض) | "prefer-local" | "prefer-remote"
   *
   * خروجی:
   *   document  → سند ادغام‌شده (برای سیاست unresolved، مقدار محلی برای تعارض نگه داشته می‌شود)
   *   conflicts → [{ collection, id, kind: "edit-edit"|"delete-edit"|"edit-delete", base, local, remote }]
   *   stats     → { added, removed, updated, unchanged, conflicts }
   */
  function merge(baseInput, localInput, remoteInput, options) {
    var opts = options || {};
    var policy = opts.conflictPolicy || "unresolved";
    if (["unresolved", "prefer-local", "prefer-remote"].indexOf(policy) === -1) {
      return { ok: false, errors: [{ code: "policy", message: "سیاست تعارض نامعتبر است" }], document: null, conflicts: [], stats: null };
    }
    var parsedBase = parseDocument(baseInput);
    var parsedLocal = parseDocument(localInput);
    var parsedRemote = parseDocument(remoteInput);
    var parseErrors = [].concat(parsedBase.errors || [], parsedLocal.errors || [], parsedRemote.errors || []);
    if (!parsedBase.ok || !parsedLocal.ok || !parsedRemote.ok) {
      return { ok: false, errors: parseErrors, document: null, conflicts: [], stats: null };
    }

    var base = parsedBase.document;
    var local = parsedLocal.document;
    var remote = parsedRemote.document;
    var conflicts = [];
    var stats = { added: 0, removed: 0, updated: 0, unchanged: 0, conflicts: 0 };
    var merged = { format: FORMAT, version: VERSION, createdAt: local.createdAt || remote.createdAt || null, meta: local.meta || {}, collections: {}, deletions: {} };

    for (var collectionIndex = 0; collectionIndex < COLLECTIONS.length; collectionIndex += 1) {
      var name = COLLECTIONS[collectionIndex];
      var baseCollection = entriesOf(base, name);
      var localCollection = entriesOf(local, name);
      var remoteCollection = entriesOf(remote, name);
      var baseDeleted = (base.deletions && base.deletions[name]) || [];
      var localDeleted = (local.deletions && local.deletions[name]) || [];
      var remoteDeleted = (remote.deletions && remote.deletions[name]) || [];

      var ids = sortedUnion(localCollection.order, remoteCollection.order, baseCollection.order,
        baseDeleted, localDeleted, remoteDeleted);
      var mergedOrder = [];
      var mergedEntities = {};
      var mergedDeletes = [];

      for (var idIndex = 0; idIndex < ids.length; idIndex += 1) {
        var id = ids[idIndex];
        var baseValue = baseCollection.entities[id] === undefined ? null : baseCollection.entities[id];
        var localValue = localCollection.entities[id] === undefined ? null : localCollection.entities[id];
        var remoteValue = remoteCollection.entities[id] === undefined ? null : remoteCollection.entities[id];

        var localText = localValue === null ? (localDeleted.indexOf(id) !== -1 ? "DELETED" : null) : canonicalText(localValue);
        var remoteText = remoteValue === null ? (remoteDeleted.indexOf(id) !== -1 ? "DELETED" : null) : canonicalText(remoteValue);
        /*
         * متن پایه فقط وقتی لازم است که دو طرف فرق داشته باشند. در حالت رایج (بدون تغییر، یا
         * تغییریافته در یک طرف و همان در طرف دیگر) از یک سوم تبدیل‌ها صرف‌نظر می‌شود.
         */
        var baseText;
        var needBase = localText !== remoteText;
        if (needBase) {
          baseText = baseValue === null ? (baseDeleted.indexOf(id) !== -1 ? "DELETED" : null) : canonicalText(baseValue);
        }

        var chosenValue;
        var chosenDeleted = false;

        if (localText === remoteText) {
          /* هر دو طرف یک چیز می‌گویند (یا هر دو ساکت‌اند) */
          chosenValue = localValue;
          chosenDeleted = localText === "DELETED";
          stats.unchanged += 1;
        } else if (localText === baseText) {
          /* فقط سمت مقابل عوض شده */
          chosenValue = remoteValue;
          chosenDeleted = remoteText === "DELETED";
          if (chosenDeleted) stats.removed += 1;
          else if (baseText === null) stats.added += 1;
          else stats.updated += 1;
        } else if (remoteText === baseText) {
          /* فقط سمت محلی عوض شده */
          chosenValue = localValue;
          chosenDeleted = localText === "DELETED";
          if (chosenDeleted) stats.removed += 1;
          else if (baseText === null) stats.added += 1;
          else stats.updated += 1;
        } else {
          /* تعارض واقعی: هر دو طرف نسب به پایه عوض شده‌اند و با هم یکی نیستند */
          var kind = localValue === null && remoteValue !== null ? "delete-edit"
            : localValue !== null && remoteValue === null ? "edit-delete" : "edit-edit";
          conflicts.push({
            collection: name, id: id, kind: kind,
            base: baseValue, local: localValue, remote: remoteValue,
          });
          stats.conflicts += 1;
          if (policy === "prefer-remote") {
            chosenValue = remoteValue;
            chosenDeleted = remoteValue === null;
          } else {
            /* unresolved و prefer-local: داده‌ی محلی حفظ می‌شود تا بازیابی تعارض ممکن باشد */
            chosenValue = localValue;
            chosenDeleted = localValue === null;
          }
        }

        if (chosenDeleted) {
          mergedDeletes.push(id);
        } else if (chosenValue !== null && chosenValue !== undefined) {
          mergedEntities[id] = canonicalize(chosenValue);
        }
      }

      /*
       * ترتیب: ترتیب محلی برای موجودیت‌های باقی‌مانده، سپس افزوده‌های سمت مقابل (به ترتیب سند آن).
       * این کار «جابه‌جایی تصادفی» در UI را از بین می‌برد.
       */
      var pushed = new Set();
      var pushOrder = function (order) {
        for (var orderIndex = 0; orderIndex < order.length; orderIndex += 1) {
          var orderedId = String(order[orderIndex]);
          if (pushed.has(orderedId) || !mergedEntities[orderedId]) continue;
          pushed.add(orderedId);
          mergedOrder.push(orderedId);
        }
      };
      pushOrder(localCollection.order);
      pushOrder(remoteCollection.order);
      pushOrder(baseCollection.order);

      merged.collections[name] = { order: mergedOrder, entities: mergedEntities };
      if (mergedDeletes.length) merged.deletions[name] = mergedDeletes.sort();
    }

    return {
      ok: true,
      errors: [],
      document: merged,
      conflicts: conflicts,
      stats: stats,
      fingerprint: fingerprint(merged),
    };
  }

  /* خلاصه‌ی خوانا برای نمایش پیش از اعمال (بدون تغییر داده) */
  function summarize(documentImpl) {
    var document = documentImpl || {};
    var summary = { format: document.format || null, version: document.version || null, total: 0, collections: {} };
    for (var index = 0; index < COLLECTIONS.length; index += 1) {
      var name = COLLECTIONS[index];
      var collection = entriesOf(document, name);
      var deleted = (document.deletions && document.deletions[name]) || [];
      var count = collection.order.length;
      summary.collections[name] = { count: count, deleted: deleted.length };
      summary.total += count;
    }
    return summary;
  }

  return {
    format: FORMAT,
    version: VERSION,
    collections: COLLECTIONS,
    canonicalize: canonicalize,
    canonicalText: canonicalText,
    fingerprint: fingerprint,
    entityId: entityId,
    buildDocument: buildDocument,
    parseDocument: parseDocument,
    toCollections: toCollections,
    merge: merge,
    summarize: summarize,
  };
});
