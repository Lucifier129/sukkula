import { defineReactStore } from "sukkula/react";
import { setupState } from "sukkula";

export default defineReactStore(() =>
  setupState({
    name: "filter",
    state: "all",
    actions: {
      setFilterType: (_, filterType) => filterType
    }
  })
);
