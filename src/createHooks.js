export const createHooks = (defaultHooks = {}) => {
  let currentHooks = defaultHooks;

  let hooks = Object.keys(defaultHooks).reduce((hooks, name) => {
    hooks[name] = (...args) => {
      let handler = currentHooks[name];
      let result = handler(...args);
      return result;
    };
    return hooks;
  }, {});

  let run = (f, implementations = currentHooks) => {
    try {
      currentHooks = implementations || currentHooks;
      return f();
    } finally {
      currentHooks = defaultHooks;
    }
  };

  return { run, hooks };
};
