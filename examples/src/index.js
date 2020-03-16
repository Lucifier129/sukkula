import "./base.css";
import "./index.css";

import React from "react";
import ReactDOM from "react-dom";
import { createReactStore } from "sukkula/react";
import * as stores from "./stores";
import App from "./App";

const store = createReactStore(stores, {
  devtools: {
    name: "sukkula-todo-app"
  }
});

ReactDOM.render(
  <store.Provider>
    <App />
  </store.Provider>,
  document.getElementById("root")
);
