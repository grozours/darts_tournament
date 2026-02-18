import '@testing-library/jest-dom';

// Mock matchMedia for components/tests that rely on it
Object.defineProperty(globalThis, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: undefined,
    addListener: () => {}, // deprecated
    removeListener: () => {}, // deprecated
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Mock scrollTo
Object.defineProperty(globalThis, 'scrollTo', { value: () => {}, writable: true });
