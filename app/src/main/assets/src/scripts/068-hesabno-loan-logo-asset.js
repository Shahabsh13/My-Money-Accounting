(function () {
  if (window.__HESABNO_LOAN_LOGO) return;
  var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
    '<path d="M7 21 29 8a5 5 0 0 1 5 0l23 13v6H7Z" fill="#dcefe9" stroke="#167c72" stroke-width="3" stroke-linejoin="round"/>' +
    '<path d="M9 30h46M10 53h44M14 49V32M24 49V32M34 49V32M44 49V32" fill="none" stroke="#167c72" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<circle cx="46" cy="44" r="13" fill="#f3c45e" stroke="#a46f18" stroke-width="2.5"/>' +
    '<path d="M46 38v12M41 43h10" fill="none" stroke="#765014" stroke-width="3" stroke-linecap="round"/>' +
    '</svg>';
  window.__HESABNO_LOAN_LOGO = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
})();
