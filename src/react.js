import React, {
  useContext,
  useState as useReactState,
  useMemo,
  useEffect,
  useLayoutEffect
} from "react";

import { identity } from "rxjs";

import {
  map,
  tap,
  take,
  distinctUntilChanged,
  ignoreElements
} from "rxjs/operators";

import { combine, createStore } from "./index";

import { isPlainObject, mapValue, shallowEqual } from "./util";

const StoreContext = React.createContext(null);

let uid = 0;
const getUid = () => (uid++).toString();

export const defineReactStore = (initilizer, initialState) => {
  let id = getUid();

  let useState = (selector = identity, compare = shallowEqual) => {
    let { current, store } = useContext(StoreContext);
    let [state, setState] = useReactState(() => selector(current[id]));

    useEffect(() => {
      let subscription = store.state$
        .pipe(
          map(state => {
            return selector(state[id]);
          }),
          distinctUntilChanged(compare)
        )
        .subscribe(setState);

      return () => {
        subscription.unsubscribe();
      };
    }, []);

    return state;
  };

  let useActions = () => {
    let { store } = useContext(StoreContext);
    return store.actions[id];
  };

  let clone = () => {
    return createReactStore(initilizer, initialState);
  };

  return {
    id,
    initilizer,
    initialState,
    clone,
    useState,
    useActions
  };
};

export const useReactStore = (reactStore, options) => {
  let [state, setState] = useReactState(reactStore.initialState);

  let store = useMemo(() => {
    return createStore(reactStore.initilizer, options);
  }, []);

  useEffect(() => {
    let subscription = store.state$.subscribe(setState);
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return {
    state,
    actions: store.actions
  };
};

const combineStores = stores => {
  let state$ = combine(mapValue(stores, item => item.state$));
  let actions = {};

  for (let key in stores) {
    let store = stores[key];
    actions[key] = store.actions;
  }

  return {
    state$,
    actions
  };
};

const observableToPromise = observable => {
  return new Promise((resolve, reject) => {
    observable.pipe(take(1)).subscribe(resolve, reject, resolve);
  });
};

export const createReactStore = (reactStores, options) => {
  if (!isPlainObject(reactStores) && !Array.isArray(reactStores)) {
    throw new Error(
      `The second argument in combineViewStore should be an object or an array, instead received ${reactStores}`
    );
  }

  let reactStoreList = isPlainObject(reactStores)
    ? Object.values(reactStores)
    : reactStores;

  let initilizerMap = reactStoreList.reduce((obj, store) => {
    if (obj.hasOwnProperty(store.id)) return obj;
    obj[store.id] = store.initilizer;
    return obj;
  }, {});

  let store = createStore(() => {
    let stores = mapValue(initilizerMap, initilizer => initilizer());
    return combineStores(stores);
  }, options);

  let context = {
    store,
    current: void 0
  };

  let Provider = ({ children }) => {
    let [ready, setReady] = useReactState(false);

    useLayoutEffect(() => {
      let subscription = store.state$.subscribe(state => {
        context.current = state;
        setReady(() => true);
      });

      return () => {
        subscription.unsubscribe();
      };
    }, []);

    if (!ready) return null;

    return (
      <StoreContext.Provider value={context}>{children}</StoreContext.Provider>
    );
  };

  let getOneShotProvider = async () => {
    let state = await observableToPromise(store.state$);

    let context = {
      store: {
        ...store,
        // getOneShotProvider is used for one-shot rendering, no other value should be emitted
        state$: store.state$.pipe(ignoreElements())
      },
      current: state
    };

    let OneShotProvider = ({ children }) => {
      return (
        <StoreContext.Provider value={context}>
          {children}
        </StoreContext.Provider>
      );
    };

    return OneShotProvider;
  };

  return {
    ...store,
    Provider,
    getOneShotProvider
  };
};
