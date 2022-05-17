import Emitter from '../Emitter/Emitter.js';

// an internal counter for stores
let storeIdx = 1;

/**
 * Creates a new store
 * @param {Object} [config] - An object containing the store setup
 * @property {Object} [config.state] - The store's initial state. It can be of any type.
 * @property {Object} [config.actions] - Named functions that can be dispatched by name and payload
 * @property {Object} [config.options] - Metadata maintained by the store that does not trigger re-renders
 * @property {Boolean} [config.autoReset] - If true, reset the store when all consumer components unmount
 * @property {String} [config.id] - The id string for debugging
 * @return {Object} store - Info and methods for working with the store
 * @property {Function} store.getState - Return the current state value
 * @property {Object} store.actions - Methods that can be called to affect state
 * @property {Function} store.setState - function to set a new state value
 * @property {Function} store.mergeState - function to set a new state value
 * @property {Function<Promise>} store.nextState - function that returns a Promise that resolves on next state value
 * @property {Function} store.reset - Reset the store's state to its original value
 * @property {Function} store.plugin - Pass a plugin to extend the store's functionality
 * @property {String} store.id - The id or number of the store
 * @property {Number} store.idx - The index order of the store in order of definition
 * @property {Function} store._subscribe - A method to add a setState callback that should be notified on changes
 * @property {Function} store._unsubscribe - A method to remove a setState callback
 * @property {Number} store._usedCount - The number of components that have ever used this store
 */
export default function createStore({
  state: initialState = {},
  actions = {},
  options: _options = {},
  autoReset = false,
  id = null,
}) {
  // the current state value
  let _state = initialState;
  // list of setState functions for Components that use this store
  const _setters = [];
  // list of resolve functions for awaiting nextState
  const _nextStateResolvers = [];
  // list of functions that will manipulate state in the next tick
  const _updateQueue = [];

  // define the store object,
  // which should normally not be consumed directly
  const store = {
    getState,
    // an identifier for debugging
    id: String(id || `store-${storeIdx}`),
    // internal counter
    idx: storeIdx++,
    // set the state and rerender all components that use this store
    setState,
    // set partial state without re-rendering
    mergeSync,
    // set the state without re-rendering
    setSync,
    // process all batched state changes immediately
    flushSync,
    // set partial state without updating components
    mergeState,
    // // create a new store with the same initial state and options
    // clone,
    // A store's state can be reset to its original value
    reset,
    // return a Promise that will resolve on next state change
    nextState,
    // get the number of mounted components using this state
    getMountCount,
    // set options that a component can pass to store without causing a re-render
    getOptions,
    // a function that sets any options
    setOptions,
    // register a plugin
    plugin,
    // number of components that are currently using this store
    mountCount: 0,
    // private: allows components to subscribe to all store changes
    _subscribe,
    // private: allows components to unsubscribe from changes
    _unsubscribe,
    // private: A count of the number of times this store has ever been used
    _usedCount: 0,
  };

  // mixin on, off, once, emit
  const emitter = new Emitter(store);
  store._handlers = emitter._handlers;
  store._context = emitter._context;
  store.on = emitter.on;
  store.off = emitter.off;
  store.once = emitter.once;
  store.emit = emitter.emit;

  store.actions = {};
  for (const [name, fn] of Object.entries(actions)) {
    store.actions[name] = fn.bind(store);
  }

  // return this store
  return store;

  //
  // functions only beyond this point
  //

  /**
   * Get the current state of the store
   * @return {*}
   */
  function getState() {
    return _state;
  }

  /**
   * Return a promise that resolves after the state is next updated for all components
   * @return {Promise<Object>}  Promise that resolves to the new state
   */
  function nextState() {
    return new Promise(resolve => {
      _nextStateResolvers.push(resolve);
    });
  }

  /**
   * Add a setState function to notify when state changes
   * @param {Function} setState - Function returned from the useState() inside useStoreState()
   * @private
   */
  function _subscribe(setState) {
    if (store._usedCount++ === 0) {
      store.emit('AfterFirstUse');
    }
    if (_setters.length === 0) {
      store.emit('AfterFirstMount');
    }
    if (_setters.indexOf(setState) === -1) {
      _setters.push(setState);
      store.emit('AfterMount');
    }
  }

  /**
   * Remove a setState function from notification when state changes
   * @param {Function} setState - Function returned from the useState() inside useStoreState()
   * @private
   */
  function _unsubscribe(setState) {
    const idx = _setters.indexOf(setState);
    if (idx > -1) {
      _setters.splice(idx, 1);
    }
    store.emit('AfterUnmount');
    if (_setters.length === 0) {
      if (autoReset) {
        store.reset();
      }
      store.emit('AfterLastUnmount');
    }
  }

  // function clone() {
  //   // create a new store with the current values and options
  //   const copy = createStore({
  //     state: _state,
  //     actions,
  //     autoReset,
  //     id,
  //   });
  //   // re-attach all handlers
  //   for (const [type, handlers] of Object.entries(store._handlers)) {
  //     handlers.map(h => copy.on(type, h));
  //   }
  //   // TODO: copy options??
  //   // return the copy
  //   return copy;
  // }

  /**
   * Reset the store to the initial value
   * @param {Object} withOverrides  An object with values to override the initial state
   * @return {Object}  This store
   * @chainable
   */
  function reset(withOverrides = {}) {
    const current = _state;
    const event = store.emit('BeforeReset', {
      before: current,
      after: { ...initialState, ...withOverrides },
    });
    if (event.defaultPrevented) {
      return store;
    }
    setState(event.data.after);
    store.emit('AfterReset', {
      before: current,
      after: event.data.after,
    });
    return store;
  }

  /**
   * Get the number of mounted components who use this store
   * @return {number}
   * @private
   */
  function getMountCount() {
    return _setters.length;
  }

  /**
   * Set the store's state and notify each affected component
   * @param {*} newState A value to set or a function that accepts old state and returns new state
   * @private
   */
  function setState(newState) {
    _updateQueue.push(newState);
    if (_updateQueue.length === 1) {
      _scheduleUpdates();
    }
  }

  /**
   * Set the store's state but do not notify any components
   * This is useful for plugins that load initial state from localStorage, URL, etc
   * @param {*} newState  A value to set or a function that accepts old state and returns new state
   */
  function setSync(newState) {
    if (typeof newState === 'function') {
      newState = newState(_state);
    }
    _state = newState;
  }

  /**
   * Extend the store's state and notify each affected component
   * @param {*} newState A value to set or a function that accepts old state and returns new state
   * @private
   */
  function mergeState(newState) {
    let updater;
    if (typeof newState === 'function') {
      updater = async old => {
        const partial = await newState(old);
        return { ...old, ...partial };
      };
    } else {
      updater = old => ({ ...old, ...newState });
    }
    _updateQueue.push(updater);
    if (_updateQueue.length === 1) {
      _scheduleUpdates();
    }
  }

  /**
   * Extend the store's state but do not notify any components
   * This is useful for plugins that load initial state from localStorage, URL, etc
   * @param {*} newState  A value to set or a function that accepts old state and returns new state
   */
  function mergeSync(newState) {
    if (typeof newState === 'function') {
      newState = newState(_state);
    }
    _state = { ..._state, ...newState };
  }

  /**
   * Get the current value of options
   * Options are state values that do not cause re-renders.
   * @returns {*}
   * @private
   */
  function getOptions() {
    return _options;
  }

  /**
   * Set any additional options the store may respond to.
   * Options are state values that do not cause re-renders.
   * @param {Object} [options]  An object with one or more options to override
   * @private
   */
  function setOptions(options) {
    Object.assign(_options, options);
    return store;
  }

  /**
   * Register a plugin
   * @param {Function} initializer  A function that receives the store
   * @return {Object}  return this store
   */
  function plugin(initializer) {
    const event = store.emit('BeforePlugin', initializer);
    if (event.defaultPrevented) {
      return store;
    }
    initializer(store);
    store.emit('AfterPlugin', initializer);
    return store;
  }

  /**
   *
   * @param {*} prev  The previous value of state (needed by useSelector and possibly event handlers)
   * @param {*} next  The newly updated state value
   * @return {Function}  A function to run against each setState update
   * @private
   */
  function _updateAffectedComponents(prev, next) {
    return function _maybeSetState(setter) {
      if (typeof setter.mapState === 'function') {
        // component wants only a slice of state
        const prevSelected = setter.mapState(prev);
        const nextSelected = setter.mapState(next);
        if (!setter.equalityFn(prevSelected, nextSelected)) {
          // the slice of state is not equal so rerender component
          setter(nextSelected);
        }
      } else if (typeof setter.equalityFn === 'function') {
        // component wants updates when equalityFn returns false
        /* istanbul ignore next */
        if (!setter.equalityFn(prev, next)) {
          setter(next);
        }
      } else {
        // no mapState; always rerender component
        setter(next);
      }
    };
  }

  /**
   * Run all queued setState updates and return the new state
   * @return {Promise<*>}
   * @private
   */
  async function _getNextState() {
    let nextState = _state;
    // process all updates or update functions
    // use while and shift in case setters trigger more setting
    let failsafe = _updateQueue.length + 100;
    while (_updateQueue.length > 0) {
      if (--failsafe === 0) {
        /* istanbul ignore next */
        throw new Error(
          `react-thermals: Too many setState calls in queue; probably an infinite loop.`
        );
      }
      const updatedState = _updateQueue.shift();
      if (typeof updatedState === 'function') {
        nextState = await updatedState(nextState);
      } else {
        nextState = updatedState;
      }
    }
    return nextState;
  }

  /**
   * Schedule setState update queue to be processed on next tick
   * @private
   */
  function _scheduleUpdates() {
    // Use Promise to queue state update for next tick
    // see https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/queueMicrotask
    Promise.resolve()
      .then(_runUpdates)
      .catch(err => store.emit('SetterException', err));
  }

  /**
   * Run state updates allowing BeforeSet and BeforeUpdate handlers to abort or alter data
   * @return {Promise<void>}
   * @private
   */
  async function _runUpdates() {
    const prevState = _state;
    const event1 = store.emit('BeforeSet', prevState);
    if (event1.defaultPrevented) {
      // handler wants to block running state updaters
      _updateQueue.length = 0;
      return;
    }
    const nextState = await _getNextState();
    const event2 = store.emit('BeforeUpdate', nextState);
    if (event2.defaultPrevented) {
      // handler wants to block saving new state
      return;
    }
    // save final state result (a handler may have altered the final result)
    // then notify affected components
    _notifyComponents(prevState, event2.data);
  }

  function _notifyComponents(prevState, data) {
    // save final state result
    _state = data;
    // update components with no selector or with matching selector
    _setters.forEach(_updateAffectedComponents(prevState, _state));
    // resolve all `await store.nextState()` calls
    _nextStateResolvers.forEach(resolver => resolver(_state));
    // clear out list of those awaiting
    _nextStateResolvers.length = 0;
    // announce the final state
    store.emit('AfterUpdate', { prev: prevState, next: _state });
  }

  function _getNextStateSync() {
    let nextState = _state;
    // process all updates or update functions
    // use while and shift in case setters trigger more setting
    let failsafe = _updateQueue.length + 100;
    while (_updateQueue.length > 0) {
      if (--failsafe === 0) {
        /* istanbul ignore next */
        throw new Error(
          `react-thermals: Too many setState calls in queue; probably an infinite loop.`
        );
      }
      const updatedState = _updateQueue.shift();
      if (typeof updatedState === 'function') {
        const maybeNext = updatedState(nextState);
        if (typeof maybeNext?.then === 'function') {
          maybeNext
            .then(store.setState)
            .catch(err => store.emit('SetterException', err));
        } else {
          nextState = maybeNext;
        }
      } else {
        nextState = updatedState;
      }
    }
    return nextState;
  }

  function flushSync() {
    const prevState = _state;
    const event1 = store.emit('BeforeSet', prevState);
    if (event1.defaultPrevented) {
      // handler wants to block running state updaters
      _updateQueue.length = 0;
      return;
    }
    let nextState;
    try {
      nextState = _getNextStateSync();
    } catch (err) {
      store.emit('SetterException', err);
      return;
    }
    const event2 = store.emit('BeforeUpdate', nextState);
    if (event2.defaultPrevented) {
      // handler wants to block saving new state
      return;
    }
    // save final state result (a handler may have altered the final result)
    // then notify affected components
    _notifyComponents(prevState, event2.data);
    // _notifyComponents sets _state
    return _state;
  }
}
