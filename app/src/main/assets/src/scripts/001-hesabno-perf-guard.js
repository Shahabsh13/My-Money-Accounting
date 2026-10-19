/* Preserve native browser scheduling for DOM and timer callbacks.
   The previous global MutationObserver wrapper delayed bursts of UI mutations
   by up to 80ms, and the setInterval wrapper clamped every interval to 250ms.
   Page-specific enhancements use these callbacks to apply final styles and
   control geometry; delaying them caused visible layout shifts after render.
   Performance-sensitive observers should be optimized at their own call sites,
   not by changing browser primitives globally. */
