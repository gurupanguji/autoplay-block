// Save native methods immediately before any page scripts can modify them
export const originalDefineProperty = Object.defineProperty;
export const originalGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
export const originalObjectDefineProperties = Object.defineProperties;
export const originalReflectDefineProperty = typeof Reflect !== 'undefined' ? Reflect.defineProperty : null;
export const originalDateNow = Date.now;
export const originalPromiseReject = Promise.reject;
export const originalDOMException = DOMException;
export const originalFunctionToString = Function.prototype.toString;
export const OriginalMutationObserver = MutationObserver;
export const OriginalWeakSet = WeakSet;
export const OriginalWeakMap = WeakMap;
export const originalReflectApply = typeof Reflect !== 'undefined' ? Reflect.apply : null;
export const safeApply = originalReflectApply
  ? (fn, thisArg, args) => originalReflectApply(fn, thisArg, args)
  : Function.prototype.call.bind(Function.prototype.apply);
export const safeCall = originalReflectApply
  ? (fn, thisArg, ...args) => originalReflectApply(fn, thisArg, args)
  : Function.prototype.call.bind(Function.prototype.call);
export const originalWeakMapHas = WeakMap.prototype.has;
export const originalWeakMapGet = WeakMap.prototype.get;
export const originalWeakMapSet = WeakMap.prototype.set;
export const originalWeakSetHas = WeakSet.prototype.has;
export const originalWeakSetAdd = WeakSet.prototype.add;
export const safeWeakMapHas = (map, key) => safeCall(originalWeakMapHas, map, key);
export const safeWeakMapGet = (map, key) => safeCall(originalWeakMapGet, map, key);
export const safeWeakMapSet = (map, key, value) => safeCall(originalWeakMapSet, map, key, value);
export const safeWeakSetHas = (set, val) => safeCall(originalWeakSetHas, set, val);
export const safeWeakSetAdd = (set, val) => safeCall(originalWeakSetAdd, set, val);
export const originalToUpperCase = String.prototype.toUpperCase;
export const safeToUpperCase = (str) => safeCall(originalToUpperCase, str);
export const originalComposedPath = Event.prototype.composedPath;
export const originalEventTargetDescriptor = originalGetOwnPropertyDescriptor(Event.prototype, 'target');
export const originalEventTargetGet = originalEventTargetDescriptor ? originalEventTargetDescriptor.get : null;
export const originalEventIsTrustedDescriptor = originalGetOwnPropertyDescriptor(Event.prototype, 'isTrusted');
export const originalEventIsTrustedGet = originalEventIsTrustedDescriptor ? originalEventIsTrustedDescriptor.get : null;
export const originalAddEventListener = EventTarget.prototype.addEventListener;
export const originalRemoveAttribute = Element.prototype.removeAttribute;
export const originalSetAttribute = Element.prototype.setAttribute;
export const originalAttachShadow = Element.prototype.attachShadow;
export const originalElementQuerySelectorAll = Element.prototype.querySelectorAll;
export const originalDocumentQuerySelectorAll = Document.prototype.querySelectorAll;
export const originalPause = HTMLMediaElement.prototype.pause;
export const originalPlay = HTMLMediaElement.prototype.play;
export const originalAutoplayDescriptor = originalGetOwnPropertyDescriptor(HTMLMediaElement.prototype, 'autoplay');
export const ACTIVATION_WINDOW_MS = 3000;
export const LOG_PREFIX = '[autoplay-blocker]';
const savedConsoleDebug = typeof console !== 'undefined' ? console.debug : null;
export function dbg(context, err) {
  if (typeof savedConsoleDebug !== 'function') return;
  try {
    safeApply(savedConsoleDebug, console, [`${LOG_PREFIX} ${context}`, err]);
  } catch (e) { /* avoid recursive logging */ }
}
