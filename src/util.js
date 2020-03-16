import { combineLatest, of, isObservable } from "rxjs";
import { map, tap } from "rxjs/operators";

export const toObservable = obj => (isObservable(obj) ? obj : of(obj));

export const mapValue = (obj, f) => {
  let result = {};

  for (let key in obj) {
    result[key] = f(obj[key], key);
  }

  return result;
};

export const isPlainObject = obj => {
  if (typeof obj !== "object" || obj === null) return false;

  let proto = obj;
  while (Object.getPrototypeOf(proto) !== null) {
    proto = Object.getPrototypeOf(proto);
  }

  return Object.getPrototypeOf(obj) === proto;
};

const combineArray = array => {
  if (!array.length) return array;
  let sourceList = Array(array.length);
  let hasSource = false;
  for (let i = 0; i < array.length; i++) {
    let item = array[i];
    let source = combineIfNeeded(item);
    if (isObservable(source)) {
      hasSource = true;
      sourceList[i] = source;
    } else {
      sourceList[i] = of(item);
    }
  }
  return hasSource ? combineLatest(sourceList) : array;
};

const splitObj = obj => {
  let keys = [];
  let values = [];

  for (let key in obj) {
    keys.push(key);
    values.push(obj[key]);
  }

  return { keys, values };
};

const combineObject = obj => {
  let { keys, values } = splitObj(obj);

  if (!keys.length) return obj;

  let source = combineArray(values);

  if (!isObservable(source)) return obj;

  let toShape = valueList => {
    let result = {};

    for (let i = 0; i < keys.length; i++) {
      result[keys[i]] = valueList[i];
    }

    return result;
  };

  return source.pipe(map(toShape));
};

const combineIfNeeded = input => {
  if (isObservable(input)) {
    return input;
  } else if (Array.isArray(input)) {
    return combineArray(input);
  } else if (isPlainObject(input)) {
    return combineObject(input);
  }
  return input;
};

export const combine = input => {
  return toObservable(combineIfNeeded(input));
};

export const shallowEqual = (objA, objB) => {
  if (objA === objB) {
    return true;
  }

  if (
    typeof objA !== "object" ||
    objA === null ||
    typeof objB !== "object" ||
    objB === null
  ) {
    return false;
  }

  var keysA = Object.keys(objA);
  var keysB = Object.keys(objB);

  if (keysA.length !== keysB.length) {
    return false;
  }

  // Test for A's keys different from B.
  for (var i = 0; i < keysA.length; i++) {
    if (!objB.hasOwnProperty(keysA[i]) || objA[keysA[i]] !== objB[keysA[i]]) {
      return false;
    }
  }

  return true;
};