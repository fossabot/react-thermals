/**
 * Create a copy of the given value, shallowly overriding properties
 * @param {*} value
 * @param {*} overrides
 * @return {*}
 */
export default function shallowOverride(value, overrides) {
  if (value instanceof Map) {
    const copy = new Map(value);
    if (overrides instanceof Map) {
      for (const [key, val] of overrides.entries()) {
        copy.set(key, val);
      }
    }
    return copy;
  } else if (value instanceof Set) {
    const copy = new Set(value);
    if (overrides instanceof Set) {
      for (const item of overrides) {
        copy.add(item);
      }
    }
    return copy;
  } else if (Array.isArray(value)) {
    const copy = [...value];
    if (Array.isArray(overrides)) {
      for (let i = 0, len = overrides.length; i < len; i++) {
        copy[i] = overrides[i];
      }
    }
    return copy;
  } else if (value && typeof value === 'object') {
    const copy = { ...value };
    if (overrides && typeof overrides === 'object') {
      Object.assign(copy, overrides);
    }
    return copy;
  }
  return overrides === undefined ? value : overrides;
}
