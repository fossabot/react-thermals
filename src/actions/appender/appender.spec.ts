import Store from '../../classes/Store/Store';
import { appender, appenderSync } from './appender';

function getTestStore(initialState: Object) {
  return new Store({ state: initialState });
}
describe('appender(propName)', () => {
  it('should append one or more args', async () => {
    const store = getTestStore({ vowels: [] });
    const addVowel = appender('vowels').bind(store);
    addVowel('a');
    await new Promise(r => setTimeout(r, 15));
    expect(store.getState()).toEqual({ vowels: ['a'] });
    addVowel('e', 'i');
    await new Promise(r => setTimeout(r, 15));
    expect(store.getState()).toEqual({ vowels: ['a', 'e', 'i'] });
  });
  it('should append one or more args with path', async () => {
    const store = getTestStore({ spec: { vowels: [] } });
    const addVowel = appender('spec.vowels').bind(store);
    addVowel('a');
    await new Promise(r => setTimeout(r, 15));
    expect(store.getState()).toEqual({ spec: { vowels: ['a'] } });
    addVowel('e', 'i');
    await new Promise(r => setTimeout(r, 15));
    expect(store.getState()).toEqual({ spec: { vowels: ['a', 'e', 'i'] } });
  });
});
describe('fieldAppenderSync(propName)', () => {
  it('should append one or more args', () => {
    const store = getTestStore({ vowels: [] });
    const addVowel = appenderSync('vowels').bind(store);
    addVowel('a');
    expect(store.getState()).toEqual({ vowels: ['a'] });
    addVowel('e', 'i');
    expect(store.getState()).toEqual({ vowels: ['a', 'e', 'i'] });
  });
});
