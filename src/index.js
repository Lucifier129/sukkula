import {
  Observable,
  ReplaySubject,
  Subject,
  merge,
  defer,
  combineLatest,
  isObservable
} from "rxjs";

import {
  map,
  shareReplay,
  withLatestFrom,
  filter,
  take,
  tap,
  ignoreElements
} from "rxjs/operators";

import {
  createStore as createReduxStore,
  combineReducers as combineReduxReducers
} from "redux";

import { createHooks } from "./createHooks";

import { mapValue, combine, shallowEqual, isPlainObject } from "./util";

export { combine };

const ACTION_CREATOR = "@@sukkula/action-creator";
const EFFECT = "@@sukkula/effect";

const { run, hooks } = createHooks({
  setupState: () => {
    throw new Error(
      `setupState can't run out of initilizer function in createStore(initilizer, options)`
    );
  },
  setupEffect: () => {
    throw new Error(
      `setupEffect can't run out of initilizer function in createStore(initilizer, options)`
    );
  },
  setupPreloadEffect: () => {
    throw new Error(
      `setupPreloadEffect can't run out of initilizer function in createStore(initilizer, options)`
    );
  },
  getInjectedContext: () => {
    throw new Error(
      `getInjectedContext can't run out of initilizer function in createStore(initilizer, options)`
    );
  }
});

export const {
  setupState,
  setupEffect,
  setupPreloadEffect,
  getInjectedContext
} = hooks;

const createStorage = () => {
  let list = [];
  let offset = 0;

  return {
    getContent: () => list,
    addItem: item => list.push(item),
    generateId: () => offset++
  };
};

const fromReduxStore = reduxStore => {
  return new Observable(subscriber => {
    let unsubscribe = reduxStore.subscribe(() => {
      subscriber.next(reduxStore.getState());
    });

    subscriber.next(reduxStore.getState());

    return () => {
      unsubscribe();
    };
  });
};

export const createStore = (initializer, options = {}) => {
  let fragmentStorage = createStorage();
  let effectStorage = createStorage();
  let preloadEffectStorage = createStorage();

  let getInjectedContext = () => {
    return options.context;
  };

  let setupState = ({ name, state, actions }) => {
    let id = fragmentStorage.generateId();

    let actionCreators = createActionCreators(id, name, actions);

    let subject = new ReplaySubject(1);

    let state$ = subject.asObservable();

    let fragment = {
      id,
      name,
      subject,
      state,
      actions,
      actionCreators
    };

    fragmentStorage.addItem(fragment);

    subject.next(state);

    return {
      state$,
      actions: actionCreators
    };
  };

  const setupEffect = producer => {
    let id = effectStorage.generateId();

    let actionCreator = enhanceActionCreator(
      createActionCreatorWithPayload(id, "", EFFECT)
    );

    let effect = {
      id,
      producer,
      actionCreators: {
        [EFFECT]: actionCreator
      }
    };

    effectStorage.addItem(effect);

    return actionCreator;
  };

  const setupPreloadEffect = producer => {
    let id = preloadEffectStorage.generateId();

    let preloadEffect = {
      id,
      producer
    };

    preloadEffectStorage.addItem(preloadEffect);
  };

  let implementations = {
    setupState,
    setupEffect,
    setupPreloadEffect,
    getInjectedContext
  };

  let result = run(initializer, implementations);

  if (!result) {
    throw new Error(
      `initializer function must return { state$, actions }, but got ${result}`
    );
  }

  let fragmentList = fragmentStorage.getContent();
  let effectList = effectStorage.getContent();
  let preloadEffectList = preloadEffectStorage.getContent();

  let internalStore = createInternalStore(
    fragmentList,
    options.devtools,
    options.preloadedState
  );

  let dispatchAction = action => {
    if (!action) return;

    if (action.type === EFFECT) {
      emitInput(effectList, action);
    } else {
      emitInput(fragmentList, action);
      internalStore.dispatch(action);
      emitOuput(fragmentList, action);
    }
  };

  let isLocked = false;

  let dispatch = actionList => {
    if (!Array.isArray(actionList)) {
      return dispatchAction(actionList);
    }

    try {
      isLocked = true;

      for (let i = 0; i < actionList.length; i++) {
        if (i === actionList.length - 1) {
          isLocked = false;
        }
        dispatchAction(actionList[i]);
      }
    } finally {
      isLocked = false;
    }
  };

  let prevInternalState = internalStore.getState();

  let sync = () => {
    let currInternalState = internalStore.getState();

    for (let i = 0; i < fragmentList.length; i++) {
      let fragment = fragmentList[i];
      let key = getFragmenmtKey(fragment);

      if (currInternalState.hasOwnProperty(key)) {
        let currValue = currInternalState[key];
        let prevValue = prevInternalState[key];

        if (!shallowEqual(currValue, prevValue)) {
          fragment.subject.next(currValue);
        }
      }
    }

    prevInternalState = currInternalState;
  };

  let actions = bindActionCreators(dispatch, result.actions);

  let isReady = false;
  let ready = () => (isReady = true);

  let preloadEffectActionList$ = combinePreloadEffectAction$(
    preloadEffectList
  ).pipe(take(1), tap(ready, null, ready));

  let effectAction$ = mergeEffectAction$(effectList);
  let action$ = merge(effectAction$, preloadEffectActionList$).pipe(
    tap(dispatch),
    ignoreElements()
  );

  let reduxState$ = fromReduxStore(internalStore);

  let state$ = merge(action$, reduxState$).pipe(
    filter(() => {
      return isReady && !isLocked;
    }),
    // sync state$ bfore read result.state$ when redux store dispatched action
    tap(sync),
    withLatestFrom(result.state$),
    map(([_, state]) => {
      return state;
    }),
    shareReplay({
      bufferSize: 1,
      refCount: true
    })
  );

  return {
    state$,
    actions,
    getInternalState: () => prevInternalState
  };
};

const mergeEffectAction$ = effectList => {
  let action$List = [];

  for (let i = 0; i < effectList.length; i++) {
    let effectAction$ = createEffectAction$(effectList[i]);
    if (effectAction$) action$List.push(effectAction$);
  }

  return merge(...action$List);
};

const createEffectAction$ = effect => {
  let { producer, actionCreators } = effect;
  let { inputSubject, outputSubject } = actionCreators[EFFECT][ACTION_CREATOR];
  let action$ = producer(inputSubject.asObservable());

  if (action$ === void 0) {
    return action$;
  } else if (isObservable(action$)) {
    return action$.pipe(tap(outputSubject));
  } else {
    throw new Error(
      `producer in useEffect(producer) should return undefined or observable, instead received ${action$}`
    );
  }
};

const combinePreloadEffectAction$ = preloadEffectList => {
  let preloadAction$List = [];

  for (let i = 0; i < preloadEffectList.length; i++) {
    let preloadEffectAction$ = createPreloadEffectAction$(preloadEffectList[i]);
    if (preloadEffectAction$) preloadAction$List.push(preloadEffectAction$);
  }

  return combineLatest(...preloadAction$List);
};

const createPreloadEffectAction$ = preloadEffect => {
  let { producer } = preloadEffect;
  let action$ = producer();

  if (action$ === void 0) {
    return action$;
  } else if (isObservable(action$)) {
    return action$.pipe(take(1));
  } else {
    throw new Error(
      `producer in usePreloadEffect(producer) should return undefined or observable, instead received ${action$}`
    );
  }
};

let isBatching = false;
let batchMap = new Map();

const clearBatchMap = () => {
  let map = batchMap;

  batchMap = new Map();

  for (let [dispatch, actionList] of map) {
    dispatch(actionList);
  }

  map.clear();
};

export const batch = f => {
  let status = isBatching;
  isBatching = true;
  try {
    f();
  } finally {
    if (!status) {
      isBatching = false;
      clearBatchMap();
    }
  }
};

const bindActionCreator = (dispatch, actionCreator) => {
  return payload => {
    if (isBatching) {
      if (!batchMap.has(dispatch)) {
        batchMap.set(dispatch, []);
      }
      let actionList = batchMap.get(dispatch);
      actionList.push(actionCreator(payload));
    } else {
      dispatch(actionCreator(payload));
    }
  };
};

const bindActionCreators = (dispatch, actionCreators) => {
  let toDispatcher = actionCreator => {
    if (isActionCreator(actionCreator)) {
      return bindActionCreator(dispatch, actionCreator);
    }
    return bindActionCreators(dispatch, actionCreator);
  };

  if (isPlainObject(actionCreators)) {
    return mapValue(actionCreators, toDispatcher);
  }

  if (Array.isArray(actionCreators)) {
    return actionCreators.map(toDispatcher);
  }

  return actionCreators;
};

const createInternalStore = (fragmentList, devtools, preloadedState) => {
  let reducer = createReducer(fragmentList);

  let initialState = preloadedState
    ? preloadedState
    : createInitialState(fragmentList);

  let reduxDevtoolsNotFound =
    typeof window === "undefined" || !window.__REDUX_DEVTOOLS_EXTENSION__;

  if (!devtools || reduxDevtoolsNotFound) {
    return createReduxStore(reducer, initialState);
  }

  if (typeof devtools === "boolean") {
    return createReduxStore(
      reducer,
      initialState,
      window.__REDUX_DEVTOOLS_EXTENSION__()
    );
  } else {
    return createReduxStore(
      reducer,
      initialState,
      window.__REDUX_DEVTOOLS_EXTENSION__(devtools)
    );
  }
};

const getFragmenmtKey = ({ id, name }) => {
  if (name) {
    return `${name}:${id}`;
  } else {
    return id.toString();
  }
};

const createReducer = fragmentList => {
  let reducers = {};

  for (let i = 0; i < fragmentList.length; i++) {
    let fragment = fragmentList[i];
    let key = getFragmenmtKey(fragment);
    reducers[key] = createReduxReducer(
      fragment.id,
      fragment.actions,
      fragment.state
    );
  }

  let reducer = combineReduxReducers(reducers);

  return reducer;
};

const createInitialState = fragmentList => {
  let initialState = {};

  for (let i = 0; i < fragmentList.length; i++) {
    let fragment = fragmentList[i];
    let key = getFragmenmtKey(fragment);
    initialState[key] = fragment.state;
  }

  return initialState;
};

const emitInput = (list, action) => {
  if (!action) return;

  for (let i = 0; i < list.length; i++) {
    let item = list[i];
    let actionCreator = item.actionCreators[action.type];

    if (action.id === item.id && isActionCreator(actionCreator)) {
      actionCreator[ACTION_CREATOR].inputSubject.next(action.payload);
    }
  }
};

const emitOuput = (list, action) => {
  if (!action) return;

  for (let i = 0; i < list.length; i++) {
    let item = list[i];
    let actionCreator = item.actionCreators[action.type];

    if (action.id === item.id && isActionCreator(actionCreator)) {
      actionCreator[ACTION_CREATOR].outputSubject.next(action.payload);
    }
  }
};

const createReduxReducer = (id, actions, initialState) => {
  let reduxReducer = (state = initialState, action) => {
    if (action.id !== id) {
      return state;
    }

    if (!actions.hasOwnProperty(action.type)) {
      return state;
    }

    let handleAction = actions[action.type];

    if (handleAction.length === 2 && "payload" in action) {
      return handleAction(state, action.payload);
    } else if (handleAction.length === 1) {
      return handleAction(state);
    } else if (handleAction.length === 0) {
      return handleAction();
    }

    return state;
  };

  return reduxReducer;
};

const createActionCreatorWithPayload = (id, name = "", type) => payload => {
  return {
    name,
    id,
    type,
    payload
  };
};

const createActionCreatorWithoutPayload = (id, name = "", type) => () => {
  return {
    name,
    id,
    type
  };
};

const createActionCreators = (id, name = "", actions) => {
  let creators = {};

  for (let type in actions) {
    let handleAction = actions[type];

    let creator;

    if (handleAction.length === 2) {
      creator = createActionCreatorWithPayload(id, name, type);
    } else {
      creator = createActionCreatorWithoutPayload(id, name, type);
    }

    creators[type] = enhanceActionCreator(id, type, creator);
  }

  return creators;
};

const isActionCreator = input => !!(input && input[ACTION_CREATOR]);

const enhanceActionCreator = (id, type, actionCreator) => {
  let inputSubject = new Subject();
  let outputSubject = new Subject();

  let newActionCreator = Object.assign((...args) => actionCreator(...args), {
    input$: inputSubject.asObservable(),
    output$: outputSubject.asObservable(),
    [ACTION_CREATOR]: {
      id,
      type,
      inputSubject,
      outputSubject
    }
  });

  return newActionCreator;
};
