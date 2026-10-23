/*
 * Lightweight getComputedStyle for jsdom tests that do not assert computed CSS.
 * jsdom rescans every stylesheet rule on each lookup; global modal-lock code walks
 * the background document, making otherwise small interaction tests extremely slow.
 * Keep native style computation in the picker under test; use inline/default values
 * for the unrelated background DOM.
 */
function installFastJSDOMStyleLookup(window) {
  const nativeGetComputedStyle = window.getComputedStyle.bind(window);
  window.getComputedStyle = (element, pseudoElement) => {
    if (element && element.closest && element.closest('#persian-datepicker-backdrop')) {
      return nativeGetComputedStyle(element, pseudoElement);
    }

    const inline = element && element.style;
    let hidden = false;
    for (let node = element; node && node.nodeType === 1; node = node.parentElement) {
      if (node.hidden || node.classList && node.classList.contains('hidden') ||
          node.style && (node.style.display === 'none' || node.style.visibility === 'hidden')) {
        hidden = true;
        break;
      }
    }
    const values = {
      display: hidden ? 'none' : inline && inline.display || '',
      visibility: inline && inline.visibility || '',
      zIndex: inline && inline.zIndex || '',
      transform: inline && inline.transform || 'none',
      opacity: inline && inline.opacity || '1',
      overflow: inline && inline.overflow || '',
      overflowX: inline && inline.overflowX || '',
      overflowY: inline && inline.overflowY || '',
    };
    return new Proxy(values, {
      get(target, property) {
        if (property in target) return target[property];
        if (typeof property !== 'string' || !inline || !inline.getPropertyValue) return '';
        const cssName = property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
        return inline.getPropertyValue(cssName);
      },
    });
  };
}

module.exports = { installFastJSDOMStyleLookup };
