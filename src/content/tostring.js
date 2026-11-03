import { dbg } from './natives.js';
import { OriginalWeakMap, originalDefineProperty, originalFunctionToString, safeApply, safeWeakMapGet, safeWeakMapHas, safeWeakMapSet } from './natives.js';

export const customToStringMap = new OriginalWeakMap();
export const makeNativeToString = (fn, originalFn) => {
  if (!fn || !originalFn) return;
  try {
    const originalString = safeApply(originalFunctionToString, originalFn, []);
    safeWeakMapSet(customToStringMap, fn, originalString);
    const customFnToString = function () { return originalString; };
    safeWeakMapSet(customToStringMap, customFnToString, safeApply(originalFunctionToString, originalFunctionToString, []));
    originalDefineProperty(fn, 'toString', {
      value: customFnToString,
      configurable: true,
      writable: true
    });
  } catch (e) { dbg('tostring:function-hook', e); }
};

export const overrideToStringOnWindow = (win) => {
  try {
    const winFunctionProto = win.Function.prototype;
    const winOriginalToString = winFunctionProto.toString;
    if (typeof winOriginalToString !== 'function') return;
    const winCustomFunctionToString = function () {
      if (this && (typeof this === 'object' || typeof this === 'function')) {
        if (safeWeakMapHas(customToStringMap, this)) return safeWeakMapGet(customToStringMap, this);
      }
      return safeApply(winOriginalToString, this, arguments);
    };
    safeWeakMapSet(customToStringMap, winCustomFunctionToString, safeApply(originalFunctionToString, winOriginalToString, []));
    originalDefineProperty(winFunctionProto, 'toString', {
      value: winCustomFunctionToString, writable: true, configurable: true, enumerable: false
    });
  } catch (e) { dbg('tostring:window-hook', e); }
};

try {
  const customFunctionToString = function () {
    if (this && (typeof this === 'object' || typeof this === 'function')) {
      if (safeWeakMapHas(customToStringMap, this)) return safeWeakMapGet(customToStringMap, this);
    }
    return safeApply(originalFunctionToString, this, arguments);
  };
  safeWeakMapSet(customToStringMap, customFunctionToString, safeApply(originalFunctionToString, originalFunctionToString, []));
  originalDefineProperty(Function.prototype, 'toString', {
    value: customFunctionToString, writable: true, configurable: true, enumerable: false
  });
} catch (e) { dbg('tostring:realm-hook', e); }
