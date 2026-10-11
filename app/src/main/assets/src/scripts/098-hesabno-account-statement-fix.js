(function () {
   var clean = function (value) { return String(value || "").replace(/\s+/g, " ").trim(); };
   var digits = function (value) {
     return String(value || "").replace(/[0-9]/g, function (digit) { return "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]; });
   };
   var readAccounts = function () {
     try {
       var accounts = JSON.parse(localStorage.getItem("hesabno:accounts_v5") || "[]");
       return Array.isArray(accounts) ? accounts : [];
     } catch (error) { return []; }
   };
   var enhance = function () {
     var accounts = readAccounts();
     document.querySelectorAll("div.fixed").forEach(function (panel) {
       var heading = panel.querySelector("h1");
       if (!heading || clean(heading.textContent).indexOf("صورتحساب ") !== 0) return;
       panel.classList.add("hesabno-account-statement-panel");
       var originalName = panel.dataset.hesabnoStatementAccount || clean(heading.textContent).replace(/^صورتحساب\s+/, "");
       panel.dataset.hesabnoStatementAccount = originalName;
       var account = accounts.find(function (item) { return item && item.name === originalName; });
       var bankName = clean(account && account.bankName) || originalName;
       var accountNumber = clean(account && account.accountNumber);
       heading.textContent = bankName;
       heading.classList.add("hesabno-statement-bank-name");
       var titleRow = heading.parentElement;
       if (titleRow) {
         Array.from(titleRow.querySelectorAll("span")).forEach(function (node) {
           if (/گردش$/.test(clean(node.textContent))) node.remove();
         });
       }
       var titleBlock = heading.parentElement && heading.parentElement.parentElement;
       var balanceLine = titleBlock && titleBlock.querySelector("p");
       if (balanceLine) {
         balanceLine.textContent = accountNumber ? "شماره حساب: " + digits(accountNumber) : "حساب بانکی";
         balanceLine.classList.add("hesabno-statement-account-number");
       }
       var columns = Array.from(panel.querySelectorAll("div.grid.grid-cols-3")).find(function (node) {
         return clean(node.textContent).indexOf("تاریخ و سند") !== -1 && clean(node.textContent).indexOf("مبلغ گردش") !== -1;
       });
       if (columns) columns.classList.add("hesabno-statement-columns");
        var opening = panel.querySelector('[title="مانده اولیه و افتتاحیه حساب"]');
        if (opening) {
          opening.classList.add("hesabno-statement-opening-balance");
          Array.from(opening.querySelectorAll("span")).forEach(function (node) {
            var text = clean(node.textContent);
            if (text === "مانده اولیه") node.classList.add("hesabno-statement-opening-balance-label");
            if (text.indexOf("مانده افتتاحیه") === 0) node.classList.add("hesabno-statement-opening-balance-description");
          });
        }
     });
   };
   enhance();
   if (document.body) new MutationObserver(enhance).observe(document.body, { childList: true, subtree: true });
 })();
