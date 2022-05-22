import React from 'react';
import { render, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import createStore from '../../src/createStore/createStore.js';
import observable from './observable.js';
import useStoreState from '../../src/useStoreState/useStoreState.js';

describe('observable()', () => {
  let store, CountComponent;
  beforeEach(() => {
    store = createStore({
      state: 0,
      actions: {
        increment() {
          store.setState(old => old + 1);
        },
        thrower() {
          store.setState(() => {
            throw new Error('my error');
          });
        },
      },
    });
    store.plugin(observable());
    CountComponent = () => {
      const state = useStoreState(store);
      const { increment, thrower } = store.actions;
      return (
        <div className="Count">
          <span title="count">{state}</span>
          <button onClick={thrower}>throw</button>
          <button onClick={increment}>+1</button>
        </div>
      );
    };
  });
  it('should fire on change', async () => {
    const observer = { next: jest.fn() };
    store.subscribe(observer);
    store.actions.increment();
    await store.nextState();
    expect(store.getState()).toBe(1);
    expect(observer.next).toHaveBeenCalledWith(1);
  });
  it('should fire on user actions', async () => {
    const observer = {
      next: jest.fn(),
      complete: jest.fn(),
      error: jest.fn(),
    };
    store.subscribe(observer);
    const { getByText, getByTitle, unmount } = render(<CountComponent />);
    await act(() => {
      fireEvent.click(getByText('+1'));
    });
    expect(store.getState()).toBe(1);
    expect(observer.next).toHaveBeenCalledWith(1);
    expect(getByTitle('count')).toHaveTextContent(/^1$/);
    await act(() => {
      fireEvent.click(getByText('throw'));
    });
    expect(observer.error.mock.calls[0][0].message).toBe('my error');
    unmount();
    expect(observer.complete).toHaveBeenCalled();
  });
});
