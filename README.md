# sukkula

> A state-management library aims to combine the best parts of redux and rxjs

[![NPM](https://img.shields.io/npm/v/sukkula.svg)](https://www.npmjs.com/package/sukkula)

## Install

```bash
npm install --save sukkula
```

## Usage

```tsx
import { setupState, setupEffect, createStore } from 'sukkula'
import { interval } from 'rxjs'
import { map, switchMap, takeUntil } from 'rxjs/operators'

// define setup function
let setupCounter = (initialCount = 0) => {
  // setup state via initialState and reducers
  let { state$, actions } = setupState({
    state: initialCount,
    reducers: {
      incre: state => state + 1,
      decre: state => state - 1
    }
  })

  // setup effect action for stopping
  let stop = setupEffect()

  // setup effect action for starting
  let start = setupEffect(input$ => {
    return input$.pipe(
      switchMap((period = 1000) => {
        return interval(1000).pipe(
          map(() => actions.incre()),
          takeUntil(stop.input$)
        )
      })
    )
  })

  // return the pair { state$, actions }
  return {
    state$,
    // merge pure-actions and effect-actions
    actions: {
      ...actions,
      start,
      stop
    }
  }
}

let store = createStore(() => {
  return setupCounter(10)
})

store.state$.subscribe(state => {
  console.log('state', state)
})

store.actions.start()
```

## License

MIT © [Lucifier129](https://github.com/Lucifier129)
