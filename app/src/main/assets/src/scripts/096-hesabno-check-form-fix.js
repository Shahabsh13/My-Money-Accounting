(function () {
   var clean = function (value) { return String(value || "").replace(/\s+/g, " ").trim(); };
   var scheduled = false;
   var enhance = function () {
     var due = document.getElementById("field-due-date");
     if (!due) return;
     var section = due.closest("section");
     if (section) {
       Array.from(section.querySelectorAll("span")).forEach(function (node) {
         if (clean(node.textContent) === "چک دریافتی مشتری") node.remove();
       });
     }
     var unselected = Array.from(due.querySelectorAll("span")).some(function (node) {
       return clean(node.textContent) === "انتخاب نشده";
     });
     if (!unselected || scheduled) return;
     var next = document.getElementById("check-due-date-next-day");
     if (!next) return;
     scheduled = true;
     next.click();
     window.setTimeout(function () {
       var previous = document.getElementById("check-due-date-prev-day");
       if (previous) previous.click();
       scheduled = false;
     }, 120);
   };
   enhance();
   if (document.body) new MutationObserver(enhance).observe(document.body, { childList: true, subtree: true });
 })();
