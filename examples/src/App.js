import React, { useState } from "react";
import cx from "classnames";
import { batch } from 'sukkula'
import { useReactStore } from "sukkula/react";
import * as Stores from "./stores";
import EditStore from "./stores/edit";

const App = () => {
  return (
    <>
      <section className="todoapp">
        <Header />
        <section className="main">
          <Toggler />
          <TodoList />
        </section>
        <Footer />
      </section>
      <Info />
    </>
  );
};

const Header = () => {
  let text = Stores.Header.useState();
  let { setHeaderText } = Stores.Header.useActions();
  let { addTodo } = Stores.Todos.useActions();

  let handleChange = ({ target }) => {
    setHeaderText(target.value);
  };

  let handleKeyUp = ({ key }) => {
    if (key !== "Enter") return;

    if (text === "") {
      alert("todo content is empty");
      return;
    }

    batch(() => {
      addTodo(text);
      setHeaderText("");
    })
  };

  return (
    <header className="header">
      <h1>todos</h1>
      <input
        className="new-todo"
        placeholder="What needs to be done?"
        value={text}
        onChange={handleChange}
        onKeyUp={handleKeyUp}
        autoFocus
      />
    </header>
  );
};

const TodoList = () => {
  let todos = Stores.Todos.useState();
  let filterType = Stores.Filter.useState();

  let list = todos.filter(todo => {
    if (filterType === "all") {
      return true;
    }

    if (filterType === "active") {
      return !todo.completed;
    }

    if (filterType === "completed") {
      return todo.completed;
    }

    return false;
  });

  return (
    <ul className="todo-list">
      {list.map(todo => {
        return <TodoItem key={todo.id} todo={todo} />;
      })}
    </ul>
  );
};

const TodoItem = ({ todo }) => {
  let edit = useReactStore(EditStore);
  let { updateTodoContent, removeTodo, toggleTodo } = Stores.Todos.useActions();

  let handleEnableEditing = () => {
    edit.actions.enable(todo.content);
  };

  let handleDisableEditing = () => {
    edit.actions.disable();
  };

  let handleEditing = ({ target }) => {
    edit.actions.updateContent(target.value);
  };

  let handleSubmit = () => {
    if (edit.state.content === "") {
      handleRemove();
      return;
    }
    updateTodoContent({
      id: todo.id,
      content: edit.state.content
    });
    handleDisableEditing();
  };

  let handleKeyUp = event => {
    if (event.key === "Enter") {
      handleSubmit();
    }
    if (event.key === "Escape") {
      handleDisableEditing();
    }
  };

  let handleToggle = () => {
    toggleTodo(todo.id);
  };

  let handleRemove = () => {
    removeTodo(todo.id);
  };

  return (
    <li
      className={cx({ completed: todo.completed, editing: edit.state.status })}
    >
      <div className="view">
        <input
          className="toggle"
          type="checkbox"
          checked={todo.completed}
          onClick={handleToggle}
          onChange={() => {}}
        />
        <label onDoubleClick={handleEnableEditing}>{todo.content}</label>
        <button className="destroy" onClick={handleRemove}></button>
      </div>
      {edit.state.status && (
        <input
          className="edit"
          value={edit.state.content}
          onChange={handleEditing}
          onBlur={handleSubmit}
          onKeyUp={handleKeyUp}
          autoFocus
        />
      )}
    </li>
  );
};

const Toggler = () => {
  let { toggleAll } = Stores.Todos.useActions();

  let { isAllCompleted, hasNoTodos } = Stores.Todos.useState(todos => {
    let isAllCompleted = todos.every(todo => todo.completed);
    let hasNoTodos = todos.length === 0;
    return { isAllCompleted, hasNoTodos };
  });

  if (hasNoTodos) return null;

  let handleToggleAll = () => {
    toggleAll();
  };

  return (
    <>
      <input
        className="toggle-all"
        checked={isAllCompleted}
        type="checkbox"
        onChange={() => {}}
      />
      <label onClick={handleToggleAll}>Mark all as complete</label>
    </>
  );
};

const Footer = () => {
  let filterType = Stores.Filter.useState();
  let todos = Stores.Todos.useState();
  let { setFilterType } = Stores.Filter.useActions();
  let { clearCompleted } = Stores.Todos.useActions();

  let activeTodos = todos.filter(todo => !todo.completed);
  let completedTodos = todos.filter(todo => todo.completed);

  let handleFilterChange = selectedFilter => {
    setFilterType(selectedFilter);
  };

  let handleClearCompleted = () => {
    clearCompleted();
  };

  if (todos.length === 0) {
    return null;
  }

  let aLen = activeTodos.length;
  let cLen = completedTodos.length;

  return (
    <footer className="footer">
      <span className="todo-count">
        <strong>{aLen}</strong> {aLen === 1 ? "item" : "items"} left
      </span>
      <ul className="filters">
        <FilterItem
          selected={filterType === "all"}
          onClick={() => handleFilterChange("all")}
        >
          All
        </FilterItem>
        <FilterItem
          selected={filterType === "active"}
          onClick={() => handleFilterChange("active")}
        >
          Active
        </FilterItem>
        <FilterItem
          selected={filterType === "completed"}
          onClick={() => handleFilterChange("completed")}
        >
          Completed
        </FilterItem>
      </ul>
      {cLen > 0 && (
        <button className="clear-completed" onClick={handleClearCompleted}>
          Clear completed
        </button>
      )}
    </footer>
  );
};

const FilterItem = ({ children, onClick, selected }) => {
  let handleClick = event => {
    event.preventDefault();
    if (onClick) onClick(event);
  };
  return (
    <li>
      <a className={selected ? "selected" : ""} onClick={handleClick}>
        {children}
      </a>
    </li>
  );
};

const Info = () => {
  return (
    <footer className="info">
      <p>Double-click to edit a todo</p>
      <p>
        Github{" "}
        <a href="https://github.com/Lucifier129/sukkula-todos">sukkula-todos</a>
      </p>
      <p>
        Powerd by <a href="https://github.com/Lucifier129/sukkula">sukkula</a>
      </p>
    </footer>
  );
};

export default App;
