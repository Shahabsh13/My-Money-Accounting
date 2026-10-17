(function () {
  var logos = window.__HESABNO_OFFICIAL_BANK_LOGOS || {};
  var keys = Object.keys(logos).sort(function (a, b) { return b.length - a.length; });
  var frame = 0;

  function clean(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function resolveBank(value) {
    var text = clean(value).replace(/^•\s*/, '').replace(/^از\s+/, '');
    for (var i = 0; i < keys.length; i += 1) {
      var key = keys[i];
      if (text === 'بانک ' + key) return key;
    }
    return '';
  }

  function bankLabel(key, original) {
    var value = clean(original).replace(/^•\s*/, '').replace(/^از\s+/, '');
    if (value && resolveBank(value)) return value;
    return key.indexOf('بانک') === 0 || key === 'بلوبانک' ? key : 'بانک ' + key;
  }

  function makeMark(key, label, size) {
    var mark = document.createElement('span');
    mark.className = 'hesabno-bank-mark';
    mark.dataset.hesabnoBankLogo = key;
    if (size) {
      mark.style.width = size + 'px';
      mark.style.height = size + 'px';
    }
    mark.title = label;
    var image = document.createElement('img');
    image.alt = label;
    image.loading = 'lazy';
    image.src = logos[key];
    mark.appendChild(image);
    return mark;
  }

  function hasExistingLogo(element) {
    var parent = element.parentElement;
    for (var depth = 0; parent && depth < 3; depth += 1, parent = parent.parentElement) {
      if (parent.querySelector('img[alt*="بانک"]') || parent.querySelector('[data-hesabno-bank-logo]')) return true;
    }
    return false;
  }

  function decorateExactBankNames() {
    var elements = document.querySelectorAll('span, p, div');
    elements.forEach(function (element) {
      if (element.closest('[data-hesabno-bank-logo]') || element.closest('.hesabno-recent-bank-name')) return;
      if (element.dataset.hesabnoBankNameDecorated) {
        // همان عنصر ممکن است بعد از انتخاب بانک دیگری متنش عوض شود؛ لوگوی قبلی باید به‌روز شود
        var own = element.querySelector(':scope > .hesabno-bank-mark');
        var currentKey = resolveBank(clean(element.textContent));
        if (own && currentKey && own.dataset.hesabnoBankLogo === currentKey) return;
        if (own) own.remove();
        delete element.dataset.hesabnoBankNameDecorated;
        if (!currentKey) return;
      }
      if (element.childNodes.length !== 1 || element.firstChild.nodeType !== 3) return;
      var text = clean(element.textContent);
      var key = resolveBank(text);
      if (!key || hasExistingLogo(element)) return;
      element.insertBefore(makeMark(key, bankLabel(key, text), 18), element.firstChild);
      element.dataset.hesabnoBankNameDecorated = 'true';
    });
  }

  function decorateReportTransactions() {
    var heading = Array.from(document.querySelectorAll('h2')).find(function (element) {
      return clean(element.textContent).indexOf('تراکنش‌های') === 0;
    });
    if (!heading) return;
    var card = heading.closest('div.rounded-3xl');
    if (!card) return;
    card.classList.add('hesabno-report-transaction-card');
    var list = heading.parentElement && heading.parentElement.nextElementSibling;
    if (!list || !list.classList.contains('divide-y')) return;
    Array.from(list.children).forEach(function (row) {
      if (!(row instanceof HTMLElement) || !row.classList.contains('cursor-pointer')) return;
      row.classList.add('hesabno-report-transaction-row');
      if (row.dataset.hesabnoReportBankDecorated) return;
      var meta = Array.from(row.querySelectorAll('div')).find(function (element) {
        return element.className.indexOf('font-mono') !== -1 && element.textContent.indexOf('از بانک') !== -1;
      });
      if (!meta) return;
      var source = Array.from(meta.children).find(function (element) {
        return clean(element.textContent).indexOf('از بانک') !== -1;
      });
      var raw = source ? clean(source.textContent) : '';
      var key = resolveBank(raw);
      if (!key) return;
      var title = Array.from(row.querySelectorAll('span')).find(function (element) {
        return element.className.indexOf('font-semibold') !== -1 && clean(element.textContent);
      });
      if (!title) return;
      var bankLine = document.createElement('div');
      bankLine.className = 'hesabno-report-bank-line';
      bankLine.appendChild(makeMark(key, bankLabel(key, raw), 17));
      var label = document.createElement('span');
      label.textContent = bankLabel(key, raw);
      bankLine.appendChild(label);
      title.insertAdjacentElement('afterend', bankLine);
      meta.remove();
      row.dataset.hesabnoReportBankDecorated = 'true';
    });
  }

  function readTransactions() {
    var raw = null;
    try { raw = window.localStorage.getItem('hesabno:transactions'); } catch (error) {}
    if (raw == null && window.__hesabnoMemoryStorage) raw = window.__hesabnoMemoryStorage['hesabno:transactions'];
    try {
      var transactions = raw ? JSON.parse(raw) : [];
      return Array.isArray(transactions) ? transactions : [];
    } catch (error) {
      return [];
    }
  }

  function readLoans() {
    var raw = null;
    try { raw = window.localStorage.getItem('hesabno:loans'); } catch (error) {}
    if (raw == null && window.__hesabnoMemoryStorage) raw = window.__hesabnoMemoryStorage['hesabno:loans'];
    try {
      var loans = raw ? JSON.parse(raw) : [];
      return Array.isArray(loans) ? loans : [];
    } catch (error) {
      return [];
    }
  }

  function isLoanTransaction(transaction) {
    return !!(transaction && (transaction.isLoanTransaction || transaction.loanId != null || transaction.installmentId != null));
  }

  function bankKeyFromValues(values) {
    for (var i = 0; i < values.length; i += 1) {
      var text = clean(values[i]);
      if (!text) continue;
      for (var j = 0; j < keys.length; j += 1) {
        var key = keys[j];
        var label = key.indexOf('بانک ') === 0 || key === 'بلوبانک' ? key : 'بانک ' + key;
        if (text.indexOf(label) !== -1 || key.length >= 4 && text.indexOf(key) !== -1) return key;
      }
    }
    return '';
  }

  function loanBankKeyFromValues(values) {
    for (var i = 0; i < values.length; i += 1) {
      var text = clean(values[i]);
      if (!text) continue;
      var tokens = text.replace(/[،,()\-]/g, ' ').split(/[\s\u200c]+/);
      if (logos['بلوبانک'] && tokens.indexOf('بلو') !== -1) return 'بلوبانک';
      for (var j = 0; j < keys.length; j += 1) {
        var key = keys[j];
        var label = key.indexOf('بانک ') === 0 ? key : 'بانک ' + key;
        var shortName = key.indexOf('بانک ') === 0 ? key.slice(5) : key;
        if (text.indexOf(label) !== -1 || text === shortName || text === key) return key;
      }
    }
    return '';
  }

  function loanForTransaction(transaction, loans) {
    if (!transaction || transaction.loanId == null) return null;
    return loans.find(function (loan) {
      return loan && String(loan.id) === String(transaction.loanId);
    }) || null;
  }

  function loanVisual(loan, transaction, fallbackValues) {
    var type = clean(loan && loan.type || transaction && transaction.loanType).toLowerCase();
    var transactionText = clean([
      transaction && transaction.category,
      transaction && transaction.title,
      transaction && transaction.description,
      transaction && transaction.loanName
    ].join(' '));
    var isPurchase = type === 'purchase' || type === 'lottery' || type === 'other_installment' ||
      !loan && /قسط خرید|خرید اقساطی|قرعه‌کشی/.test(transactionText);
    var name = clean(loan && (loan.name || loan.title) || transaction && (transaction.loanName || transaction.title));
    if (isPurchase) return { kind: 'glyph', value: clean(loan && loan.icon) || '🛍️', label: name || 'خرید اقساطی' };
    if (window.__HESABNO_LOAN_LOGO) return { kind: 'loan', src: window.__HESABNO_LOAN_LOGO, label: name || 'وام و تسهیلات' };

    var bankKey = loanBankKeyFromValues([
      loan && loan.bankName,
      loan && loan.bank,
      loan && loan.name,
      loan && loan.title,
      loan && loan.provider,
      transaction && transaction.loanName,
      transaction && transaction.title,
      transaction && transaction.description
    ]);
    if (!bankKey && !loan) {
      bankKey = loanBankKeyFromValues(fallbackValues || []) || bankKeyFromValues(fallbackValues || []);
    }
    if (bankKey && logos[bankKey]) return { kind: 'bank', key: bankKey, label: bankLabel(bankKey, '') };
    return { kind: 'glyph', value: clean(loan && loan.icon) || '🏦', label: name || 'وام' };
  }

  function applyLoanVisual(icon, visual, size) {
    if (!icon || !visual) return;
    var visualId = visual.kind === 'bank' ? 'bank:' + visual.key : visual.kind === 'loan' ? 'loan' : 'glyph:' + visual.value;
    if (icon.dataset.hesabnoLoanVisualApplied === visualId &&
        (visual.kind === 'bank' ? icon.querySelector('[data-hesabno-bank-logo="' + visual.key + '"]') && !icon.classList.contains('hesabno-counterparty-icon') :
          visual.kind === 'loan' ? icon.querySelector('[data-hesabno-loan-logo="true"]') :
            icon.dataset.hesabnoLoanGlyph === visual.value && icon.firstElementChild && icon.firstElementChild.textContent === visual.value)) return;

    icon.classList.remove('hesabno-counterparty-icon');
    icon.removeAttribute('data-hesabno-counterparty-icon');
    icon.replaceChildren();
    if (visual.kind === 'bank') {
      var mark = makeMark(visual.key, visual.label, size);
      mark.style.marginInlineEnd = '0';
      icon.appendChild(mark);
      icon.dataset.hesabnoLoanLogoApplied = visual.key;
      icon.style.backgroundColor = '#fff';
      icon.style.borderColor = 'rgba(148, 163, 184, .45)';
      icon.style.borderWidth = '1px';
      icon.style.borderStyle = 'solid';
      delete icon.dataset.hesabnoLoanGlyph;
    } else if (visual.kind === 'loan') {
      var image = document.createElement('img');
      image.dataset.hesabnoLoanLogo = 'true';
      image.src = visual.src;
      image.alt = visual.label;
      image.loading = 'lazy';
      image.style.width = size + 'px';
      image.style.height = size + 'px';
      image.style.objectFit = 'contain';
      image.style.marginInlineEnd = '0';
      icon.appendChild(image);
      icon.style.backgroundColor = '#fff';
      icon.style.borderColor = 'rgba(148, 163, 184, .45)';
      icon.style.borderWidth = '1px';
      icon.style.borderStyle = 'solid';
      delete icon.dataset.hesabnoLoanGlyph;
      icon.dataset.hesabnoLoanLogoApplied = 'custom';
    } else {
      var glyph = document.createElement('span');
      glyph.textContent = visual.value;
      glyph.style.fontSize = size + 'px';
      glyph.style.lineHeight = '1';
      icon.appendChild(glyph);
      icon.style.removeProperty('background-color');
      icon.style.removeProperty('border-color');
      icon.style.removeProperty('border-width');
      icon.style.removeProperty('border-style');
      delete icon.dataset.hesabnoLoanLogoApplied;
      icon.dataset.hesabnoLoanGlyph = visual.value;
    }
    icon.dataset.hesabnoLoanVisualApplied = visualId;
    icon.setAttribute('role', 'img');
    icon.setAttribute('aria-label', visual.label);
    icon.title = visual.label;
  }

  function findLoanTransactionForRow(transactions, loans, title, rowText) {
    return transactions.find(function (transaction) {
      if (!isLoanTransaction(transaction)) return false;
      var transactionTitle = clean(transaction.title || transaction.description);
      var relatedLoan = loanForTransaction(transaction, loans);
      var loanName = clean(relatedLoan && relatedLoan.name || transaction.loanName);
      if (transactionTitle && title && (transactionTitle === title || transactionTitle.indexOf(title) !== -1 || title.indexOf(transactionTitle) !== -1 || rowText.indexOf(transactionTitle) !== -1)) return true;
      if (!loanName || (title !== loanName && title.indexOf(loanName) === -1 && rowText.indexOf(loanName) === -1)) return false;
      var account = clean(transaction.account || transaction.destinationAccount);
      return !account || rowText.indexOf(account) !== -1;
    }) || null;
  }

  function decorateLoanTransactions() {
    var transactions = readTransactions();
    var loans = readLoans();
    transactions.forEach(function (transaction) {
      if (!isLoanTransaction(transaction) || transaction.id == null) return;
      var card = document.getElementById('tx-card-' + String(transaction.id));
      if (!card) return;
      var icon = card.querySelector('span.w-7.h-7') || card.querySelector('span.w-8.h-8') || card.querySelector('div.w-7.h-7') || card.querySelector('div.w-8.h-8');
      applyLoanVisual(icon, loanVisual(loanForTransaction(transaction, loans), transaction, []), 20);
    });
  }

  function decorateLoanRecords() {
    var loans = readLoans();
    Array.from(document.querySelectorAll('h3, h4')).forEach(function (heading) {
      var name = clean(heading.textContent);
      var loan = loans.find(function (item) { return item && clean(item.name || item.title) === name; });
      if (!loan) return;
      var group = heading.closest('div.flex.items-center.gap-3');
      if (!group) return;
      var isSchedule = heading.tagName === 'H4';
      var icon = Array.from(group.children).find(function (child) {
        return child.classList && child.classList.contains(isSchedule ? 'w-9' : 'w-12') && child.classList.contains(isSchedule ? 'h-9' : 'h-12');
      });
      applyLoanVisual(icon, loanVisual(loan, null, []), isSchedule ? 22 : 32);
    });
  }

  function decorateLoanWidgetIcons() {
    var transactions = readTransactions();
    var loans = readLoans();
    var headings = ['آخرین تراکنش‌ها', 'هزینه‌های امروز', 'درآمدهای امروز'];
    headings.forEach(function (headingText) {
      var heading = Array.from(document.querySelectorAll('h2')).find(function (element) {
        return clean(element.textContent).indexOf(headingText) === 0;
      });
      var section = heading && heading.closest('section');
      if (!section) return;
      Array.from(section.querySelectorAll('div[title="برای ویرایش سند کلیک کنید"]')).forEach(function (row) {
        var titleNode = row.querySelector('p.font-bold');
        var title = titleNode && clean(titleNode.textContent);
        var rowText = clean(row.textContent);
        var accountTransaction = findLoanTransactionForRow(transactions, loans, title || '', rowText);
        var hasLoanText = /قسط|اقساط|وام|تسهیلات|خرید اقساطی/.test(rowText);
        if (!accountTransaction && !hasLoanText) return;
        var icon = row.firstElementChild;
        if (!icon || icon.tagName !== 'SPAN' || !icon.classList.contains('w-11') || !icon.classList.contains('h-11')) return;
        var bankValues = accountTransaction ? [accountTransaction.account, accountTransaction.destinationAccount] : Array.from(row.querySelectorAll('.hesabno-recent-bank-name, p, span')).map(function (element) {
          return clean(element.textContent);
        }).filter(function (value) { return value.indexOf('بانک ') !== -1 || value.indexOf('بلوبانک') !== -1; });
        var visual = loanVisual(loanForTransaction(accountTransaction, loans), accountTransaction, bankValues.concat([rowText]));
        applyLoanVisual(icon, visual, 32);
      });
    });
  }

  function decorateLoanSummaryWidget() {
    if (!window.__HESABNO_LOAN_LOGO) return;
    var titles = ['کارت اقساط و وام‌های بانکی', 'تسهیلات بانکی جاری'];
    Array.from(document.querySelectorAll('h1, h2, h3, h4')).forEach(function (heading) {
      if (titles.indexOf(clean(heading.textContent)) === -1) return;
      var section = heading.closest('section') || heading.parentElement && heading.parentElement.parentElement;
      if (!section) return;
      var group = heading.parentElement && heading.parentElement.parentElement;
      var headerIcon = group && (group.querySelector('span.w-8.h-8') || group.querySelector('span.w-10.h-10') ||
        group.querySelector('span.w-11.h-11') || group.querySelector('span.w-12.h-12'));
      var summaryRow = Array.from(section.querySelectorAll('div.p-3')).find(function (row) {
        return clean(row.textContent).indexOf('مانده کل بدهی') !== -1;
      });
      var summaryIcon = summaryRow && summaryRow.querySelector('span.w-8.h-8, span.w-10.h-10, span.w-11.h-11, span.w-12.h-12');
      // Read every icon size first, then write: interleaving reads and writes
      // forces a layout per icon.
      var icons = [headerIcon, summaryIcon].filter(Boolean);
      var sizes = icons.map(function (icon) {
        return Math.max(18, Math.min(32, (icon.clientWidth || 40) - 8));
      });
      icons.forEach(function (icon, i) {
        applyLoanVisual(icon, { kind: 'loan', src: window.__HESABNO_LOAN_LOGO, label: 'وام و تسهیلات' }, sizes[i]);
      });
    });
  }

  function decorateLoanFormIcons() {
    if (!window.__HESABNO_LOAN_LOGO) return;
    var heading = Array.from(document.querySelectorAll('h2')).find(function (element) {
      return clean(element.textContent) === 'ثبت وام بانکی و تسهیلات';
    });
    if (!heading) return;
    var visual = { kind: 'loan', src: window.__HESABNO_LOAN_LOGO, label: 'وام و تسهیلات' };
    var header = heading.closest('div.flex.items-center.gap-3');
    var headerIcon = header && header.querySelector('span.w-10.h-10');
    applyLoanVisual(headerIcon, visual, 28);

    var overlay = heading.closest('.fixed.inset-0');
    var iconLabel = overlay && Array.from(overlay.querySelectorAll('span')).find(function (node) {
      return clean(node.textContent) === 'آیکون نمایش:';
    });
    var parent = iconLabel;
    while (parent && parent !== overlay) {
      var preview = parent.querySelector('span.w-11.h-11');
      if (preview) {
        applyLoanVisual(preview, visual, 32);
        break;
      }
      parent = parent.parentElement;
    }
  }

  function removeGenericWalletIcons() {
    document.querySelectorAll('#field-wallet').forEach(function (field) {
      if (!field.querySelector('[data-hesabno-bank-logo]')) return;
      Array.from(field.children).forEach(function (child) {
        if (clean(child.textContent) === '🏦') child.remove();
      });
    });
  }

  function enhance() {
    decorateExactBankNames();
    decorateReportTransactions();
    decorateLoanRecords();
    decorateLoanTransactions();
    decorateLoanWidgetIcons();
    decorateLoanSummaryWidget();
    decorateLoanFormIcons();
    removeGenericWalletIcons();
  }

  function schedule() {
    if (frame) return;
    frame = requestAnimationFrame(function () {
      frame = 0;
      enhance();
    });
  }

  // True when a DOM node is one of our own decorations (logos/marks).
  // Changes that only add/remove these must not re-run enhance(), otherwise
  // every decoration write triggers another full-document pass.
  function isOwnNode(node) {
    if (!node || node.nodeType !== 1) return false;
    if (node.hasAttribute && node.hasAttribute('data-hesabno-bank-logo')) return true;
    if (node.hasAttribute && node.hasAttribute('data-hesabno-loan-logo')) return true;
    return !!(node.querySelector && node.querySelector('[data-hesabno-bank-logo], [data-hesabno-loan-logo]'));
  }

  function isOwnRecord(record) {
    if (record.type !== 'childList') return false;
    var nodes = Array.prototype.slice.call(record.addedNodes).concat(Array.prototype.slice.call(record.removedNodes));
    if (!nodes.length) return false;
    return nodes.every(isOwnNode);
  }

  // Only newly inserted content (not our own decorations, not pure removals)
  // can need decorating, so only those records schedule a pass.
  function onMutations(records) {
    for (var i = 0; i < records.length; i++) {
      var record = records[i];
      if (record.type !== 'childList' || !record.addedNodes.length) continue;
      if (isOwnRecord(record)) continue;
      schedule();
      return;
    }
  }

  /* لایه‌ی مشترک MutationObserver (مرحله ۴): ثبت در observer مشترک body به‌جای observer مستقل.
     start() فقط یک‌بار اجرا می‌شود، ولی برای اطمینان دو بار ثبت نمی‌کنیم. */
  var observer = null;
  function start() {
    enhance();
    if (!observer && document.body) observer = window.__hesabnoDom.watch(document.body, { childList: true, subtree: true }, onMutations);
    setTimeout(enhance, 250);
    setTimeout(enhance, 900);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
