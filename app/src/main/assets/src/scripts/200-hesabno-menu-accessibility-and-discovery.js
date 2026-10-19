(function () {
  var clean = function (value) {
    return String(value || "").replace(/[يى]/g, "ی").replace(/ك/g, "ک").replace(/[\u064B-\u065F]/g, "").replace(/\s+/g, " ").trim().toLocaleLowerCase("fa");
  };
  var setup = function () {
    var main = Array.from(document.querySelectorAll("main")).find(function (node) {
      var heading = node.querySelector("h1");
      return heading && clean(heading.textContent).includes("بیشتر و امکانات");
    });

    document.querySelectorAll("nav.fixed").forEach(function (nav) {
      if (nav.getAttribute("aria-label") !== "ناوبری اصلی") nav.setAttribute("aria-label", "ناوبری اصلی");
      nav.querySelectorAll("button").forEach(function (button) {
        if (button.classList.contains("text-emerald-400")) {
          if (button.getAttribute("aria-current") !== "page") button.setAttribute("aria-current", "page");
        } else if (button.hasAttribute("aria-current")) {
          button.removeAttribute("aria-current");
        }
      });
    });
    if (!main) return;

    var profile = Array.from(main.querySelectorAll("section")).find(function (node) {
      return node.classList.contains("cursor-pointer") && node.classList.contains("group");
    }) || Array.from(main.querySelectorAll("section")).find(function (node) {
      return clean(node.textContent).includes("کاربر My Money");
    });
    if (profile) {
      if (profile.dataset.hesabnoProfileButton !== "true") profile.dataset.hesabnoProfileButton = "true";
      if (profile.getAttribute("role") !== "button") profile.setAttribute("role", "button");
      if (profile.getAttribute("tabindex") !== "0") profile.setAttribute("tabindex", "0");
      var profileName = profile.querySelector("h2");
      var ariaLabel = "ویرایش پروفایل " + (profileName ? profileName.textContent.trim() : "کاربر My Money");
      if (profile.getAttribute("aria-label") !== ariaLabel) profile.setAttribute("aria-label", ariaLabel);
      if (profile.getAttribute("title") !== "ویرایش پروفایل") profile.setAttribute("title", "ویرایش پروفایل");
      var editLabel = Array.from(profile.querySelectorAll("span")).find(function (node) {
        return clean(node.textContent) === "ویرایش";
      });
      if (editLabel) {
        if (editLabel.classList.contains("hidden")) editLabel.classList.remove("hidden");
        if (editLabel.style.display !== "inline") editLabel.style.display = "inline";
      }
    }

    var projectCard = main.querySelector("#hesabno-project-family-card");
    var arrow = projectCard && projectCard.lastElementChild;
    var referenceArrow = projectCard && projectCard.previousElementSibling && projectCard.previousElementSibling.lastElementChild;
    if (referenceArrow && referenceArrow.localName === "svg" && arrow && arrow.localName !== "svg") {
      arrow.replaceWith(referenceArrow.cloneNode(true));
      arrow = projectCard.lastElementChild;
    }
    if (arrow && arrow.localName === "svg" && arrow.getAttribute("aria-hidden") !== "true") arrow.setAttribute("aria-hidden", "true");

  };

  if (!window.__hesabnoMenuKeyboardBound) {
    window.__hesabnoMenuKeyboardBound = true;
    document.addEventListener("keydown", function (event) {
      var card = event.target.closest && event.target.closest('main section[data-hesabno-profile-button="true"]');
      if (!card || (event.key !== "Enter" && event.key !== " ")) return;
      event.preventDefault();
      card.click();
    }, true);
  }

  var queued = false;
  var schedule = function () {
    if (queued) return;
    queued = true;
    Promise.resolve().then(function () { queued = false; setup(); });
  };
  setup();
  if (document.body) {
    window.__hesabnoDom.watch(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] }, schedule);
  }
  })();
