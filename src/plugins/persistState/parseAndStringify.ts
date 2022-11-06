export function tryParse(parse: Function, json: string) {
  try {
    return parse(json);
  } catch (error) {
    console.error('react-thermals: persistState plugin parse error: ', error);
    return undefined;
  }
}
export function tryStringify(stringify: Function, value: any) {
  try {
    return stringify(value);
  } catch (error) {
    console.error(
      'react-thermals: persistState plugin stringify error: ',
      error
    );
    return '';
  }
}