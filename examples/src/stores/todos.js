import { defineReactStore } from "sukkula/react";
import { setupState, setupEffect, setupPreloadEffect } from "sukkula";
import { interval, defer, timer, from, of } from "rxjs";
import {
  map,
  startWith,
  take,
  delay,
  switchMap,
  skip,
  tap,
  skipUntil
} from "rxjs/operators";

export default defineReactStore(() => {
  let todos = setupState({
    name: "todos",
    state: [],
    actions: {
      addTodo,
      removeTodo,
      updateTodoContent,
      updateTodoStatus,
      toggleTodo,
      toggleAll,
      clearCompleted
    }
  });

  let actions = todos.actions;
  let state$ = todos.state$;

  setupEffect(() => {
    return interval(100).pipe(
      take(10),
      map(n => {
        return [actions.toggleAll(), actions.addTodo(n)];
      })
    );
  });

  setupPreloadEffect(() => {
    return from(Promise.resolve(123)).pipe(
      delay(2000),
      map(n => actions.addTodo(n))
    );
  });

  return {
    state$,
    actions
  };
});

const addTodo = (todos, content) => {
  let todo = {
    id: Date.now(),
    content,
    completed: false
  };
  return todos.concat(todo);
};

const removeTodo = (todos, id) => {
  return todos.filter(todo => todo.id !== id);
};

const updateTodoContent = (todos, { id, content }) => {
  return todos.map(todo => {
    if (todo.id !== id) return todo;
    return {
      ...todo,
      content: content
    };
  });
};

const updateTodoStatus = (todos, { id, completed }) => {
  return todos.map(todo => {
    if (todo.id !== id) return todo;
    return {
      ...todo,
      completed
    };
  });
};

const toggleTodo = (todos, id) => {
  return todos.map(todo => {
    if (todo.id !== id) return todo;
    return {
      ...todo,
      completed: !todo.completed
    };
  });
};

const toggleAll = todos => {
  let isAllCompleted = todos.every(todo => todo.completed);

  return todos.map(todo => {
    return {
      ...todo,
      completed: !isAllCompleted
    };
  });
};

const clearCompleted = todos => {
  return todos.filter(todo => !todo.completed);
};
