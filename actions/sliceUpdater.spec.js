import createStore from '../src/createStore/createStore.js';
import { sliceUpdater, sliceUpdaterSync } from './sliceUpdater.js';

function getTestStore(initialState) {
  return createStore({ state: initialState });
}

describe('sliceUpdater(path)', () => {
  it('should merge state', async () => {
    const store = getTestStore({ door: 'A', open: false });
    const addPaint = sliceUpdater('@').bind(store);
    addPaint({ color: 'red', finish: 'matte' });
    await new Promise(r => setTimeout(r, 15));
    expect(store.getState()).toEqual({
      door: 'A',
      open: false,
      color: 'red',
      finish: 'matte',
    });
  });
  it('should merge state at path', async () => {
    const store = getTestStore({ doors: [{ door: 'A', open: false }] });
    const addPaint = sliceUpdater('doors[0]').bind(store);
    addPaint({ color: 'blue', finish: 'gloss', open: true });
    await new Promise(r => setTimeout(r, 15));
    expect(store.getState()).toEqual({
      doors: [
        {
          door: 'A',
          open: true,
          color: 'blue',
          finish: 'gloss',
        },
      ],
    });
  });
});
describe('sliceUpdaterSync(path)', () => {
  it('should merge state at path sync', async () => {
    const store = getTestStore({
      doors: [{ door: 'A', open: false }, { door: 'A.2' }],
    });
    const addPaint = sliceUpdaterSync('doors[0]').bind(store);
    addPaint({ color: 'green', finish: 'semigloss', door: 'A.1' });
    expect(store.getState()).toEqual({
      doors: [
        {
          door: 'A.1',
          open: false,
          color: 'green',
          finish: 'semigloss',
        },
        { door: 'A.2' },
      ],
    });
  });
});