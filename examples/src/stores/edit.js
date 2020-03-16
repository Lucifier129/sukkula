import { setupState } from "sukkula";
import { defineReactStore } from "sukkula/react";

const initialState = {
  status: false,
  content: ""
};

export default defineReactStore(() => {
  let edit = setupState({
    name: "edit",
    state: initialState,
    actions: {
      enable: (state, content) => {
        return {
          ...state,
          status: true,
          content
        };
      },
      disable: () => {
        return initialState;
      },
      updateContent: (state, content) => {
        return {
          ...state,
          content
        };
      }
    }
  });

  return edit;
}, initialState);
