export function getApiErrorMessage(error: unknown, fallback: string): string {
  const maybeError = error as {
    message?: string;
    response?: { status?: number; data?: { message?: string } };
  };

  const status = maybeError.response?.status;
  const message =
    maybeError.response?.data?.message?.trim() ?? maybeError.message?.trim() ?? '';

  if (!message) {
    if (status === 401) return 'Your session has expired. Please sign in again.';
    if (status === 403) return 'You do not have access to this action.';
    if (status === 404) {
      return 'We could not find what you were looking for right now.';
    }
    if (status === 409) return 'This action conflicts with the current state. Please refresh and try again.';
    if (status && status >= 500) {
      return 'Something went wrong on our side. Please try again shortly.';
    }
    return fallback;
  }

  switch (message) {
    case 'Invalid credentials':
      return 'The email or password you entered is incorrect. Please check both details and try again.';
    case 'Please verify your email before logging in.':
      return 'Your account is not verified yet. Please complete email verification before signing in.';
    case 'Network Error':
    case 'Failed to fetch':
      return 'We could not reach the server. Please check your connection and try again.';
    case 'Unauthorized':
    case 'Access denied':
    case 'Request failed with status code 401':
      return 'Your session has expired. Please sign in again.';
    case 'Unable to resolve tenant from request':
      return 'This workspace is not linked to a business portal yet. Reload the app in the correct tenant portal and try again.';
    case 'Forbidden':
    case 'Request failed with status code 403':
      return 'You do not have access to this action.';
    case 'Cannot GET /api/v1/users/me':
    case 'Cannot GET /api/v1/wallet/me':
    case 'Cannot GET /api/v1/orders/me':
      return 'That part of the app is not available right now. Please refresh and try again.';
    default:
      if (/^Cannot GET\s+/i.test(message) || /^Request failed with status code 404$/i.test(message)) {
        return 'That part of the app is not available right now. Please refresh and try again.';
      }
      if (/^Request failed with status code 5\d\d$/i.test(message)) {
        return 'Something went wrong on our side. Please try again shortly.';
      }
      return message;
  }
}

export function getHumanLoginErrorMessage(error: unknown): string {
  return getApiErrorMessage(
    error,
    'We could not sign you in right now. Please try again.',
  );
}
