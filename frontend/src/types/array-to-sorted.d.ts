interface Array<T> {
  toSorted(compareFunction?: (a: T, b: T) => number): T[];
}

interface ReadonlyArray<T> {
  toSorted(compareFunction?: (a: T, b: T) => number): T[];
}
