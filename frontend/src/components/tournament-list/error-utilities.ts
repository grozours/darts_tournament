export const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error) {
    return getErrorMessage(error.message, fallback);
  }

  if (typeof error === 'string') {
    try {
      const parsedError = JSON.parse(error) as {
        error?: { message?: unknown };
      };
      if (parsedError?.error?.message && typeof parsedError.error.message === 'string') {
        return parsedError.error.message;
      }
    } catch {
      // Ignore JSON parse errors and fall back to raw string.
    }

    return error;
  }

  if (error && typeof error === 'object' && 'error' in error) {
    const errorObject = (error as { error?: { message?: unknown } }).error;
    if (errorObject && typeof errorObject.message === 'string') {
      return errorObject.message;
    }
  }

  return fallback;
};
