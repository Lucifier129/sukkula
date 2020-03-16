import { defineReactStore } from "sukkula/react";
import { setupState } from "sukkula";

export default defineReactStore(() =>
  setupState({
    name: "header",
    state: "",
    actions: {
      setHeaderText: (_, text) => text
    }
  })
);
