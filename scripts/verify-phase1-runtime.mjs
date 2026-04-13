const API_URL = process.env.ZENTRY_VERIFY_API_URL ?? 'http://localhost:4000';
const WEB_URL = process.env.ZENTRY_VERIFY_WEB_URL ?? 'http://localhost:3000';

const accounts = [
  {
    label: 'individual',
    email: 'user@test.com',
    password: 'Test@1234!',
    role: 'INDIVIDUAL',
    tenantSlug: 'testbiz',
    defaultRoute: '/home',
    disallowedRoute: '/dashboard',
  },
  {
    label: 'tenant-admin',
    email: 'tenant@test.com',
    password: 'Test@1234!',
    role: 'TENANT_ADMIN',
    tenantSlug: 'testbiz',
    defaultRoute: '/tenant/dashboard',
    disallowedRoute: '/admin/dashboard',
  },
  {
    label: 'cbt-center',
    email: 'cbt@test.com',
    password: 'Test@1234!',
    role: 'CBT_CENTER',
    tenantSlug: 'testbiz',
    defaultRoute: '/dashboard',
    disallowedRoute: '/admin/dashboard',
  },
  {
    label: 'super-admin',
    email: 'admin@zentry.ng',
    password: 'Admin@Zentry2024!',
    role: 'SUPER_ADMIN',
    defaultRoute: '/admin/dashboard',
    disallowedRoute: '/job-pool',
  },
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function parseSetCookieHeader(headers) {
  const setCookie = headers.get('set-cookie');
  if (!setCookie) {
    return null;
  }

  const [cookiePair] = setCookie.split(';');
  return cookiePair;
}

async function requestJson(url, init = {}) {
  const response = await fetch(url, {
    redirect: 'manual',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  const text = await response.text();
  let body = null;

  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  return { response, body };
}

async function verifyAccount(account) {
  const login = await requestJson(`${API_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: {
      ...(account.tenantSlug ? { 'x-tenant-slug': account.tenantSlug } : {}),
    },
    body: JSON.stringify({
      email: account.email,
      password: account.password,
    }),
  });

  assert(login.response.status === 200, `${account.label}: login failed`);
  assert(
    login.body?.data?.user?.role === account.role,
    `${account.label}: unexpected role from login`,
  );

  const firstCookie = parseSetCookieHeader(login.response.headers);
  assert(firstCookie, `${account.label}: login did not set refresh cookie`);

  const me = await requestJson(`${API_URL}/api/v1/auth/me`, {
    headers: {
      Authorization: `Bearer ${login.body.data.accessToken}`,
      Cookie: firstCookie,
      ...(account.tenantSlug ? { 'x-tenant-slug': account.tenantSlug } : {}),
    },
  });

  assert(me.response.status === 200, `${account.label}: /auth/me failed`);
  assert(
    me.body?.data?.role === account.role,
    `${account.label}: /auth/me returned wrong role`,
  );

  const loginRedirect = await fetch(`${WEB_URL}/login`, {
    redirect: 'manual',
    headers: { Cookie: firstCookie },
  });

  assert(
    loginRedirect.status >= 300 && loginRedirect.status < 400,
    `${account.label}: /login did not redirect when authenticated`,
  );
  assert(
    loginRedirect.headers.get('location') === account.defaultRoute,
    `${account.label}: /login redirected to wrong route`,
  );

  const disallowedRedirect = await fetch(`${WEB_URL}${account.disallowedRoute}`, {
    redirect: 'manual',
    headers: { Cookie: firstCookie },
  });

  assert(
    disallowedRedirect.status >= 300 && disallowedRedirect.status < 400,
    `${account.label}: disallowed route did not redirect`,
  );
  assert(
    disallowedRedirect.headers.get('location') === account.defaultRoute,
    `${account.label}: disallowed route redirected incorrectly`,
  );

  const refresh = await requestJson(`${API_URL}/api/v1/auth/refresh`, {
    method: 'POST',
    headers: { Cookie: firstCookie },
  });

  assert(refresh.response.status === 200, `${account.label}: refresh failed`);
  assert(
    typeof refresh.body?.data?.accessToken === 'string',
    `${account.label}: refresh did not return access token`,
  );

  const refreshedCookie = parseSetCookieHeader(refresh.response.headers);
  assert(
    refreshedCookie && refreshedCookie !== firstCookie,
    `${account.label}: refresh did not rotate refresh cookie`,
  );

  const logout = await requestJson(`${API_URL}/api/v1/auth/logout`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${refresh.body.data.accessToken}`,
      Cookie: refreshedCookie,
    },
  });

  assert(logout.response.status === 200, `${account.label}: logout failed`);
  const clearedCookie = parseSetCookieHeader(logout.response.headers);
  assert(clearedCookie, `${account.label}: logout did not clear refresh cookie`);

  const protectedRedirect = await fetch(`${WEB_URL}${account.defaultRoute}`, {
    redirect: 'manual',
    headers: { Cookie: clearedCookie },
  });

  assert(
    protectedRedirect.status >= 300 && protectedRedirect.status < 400,
    `${account.label}: protected route did not redirect after logout`,
  );
  assert(
    protectedRedirect.headers.get('location')?.startsWith('/login'),
    `${account.label}: protected route did not redirect to login after logout`,
  );

  return {
    account: account.label,
    role: account.role,
    defaultRoute: account.defaultRoute,
  };
}

async function main() {
  const results = [];

  for (const account of accounts) {
    results.push(await verifyAccount(account));
  }

  console.log('Phase 1 runtime verification passed.');
  for (const result of results) {
    console.log(
      `- ${result.account}: login, refresh, logout, and redirect checks passed (${result.defaultRoute})`,
    );
  }
}

main().catch((error) => {
  console.error('Phase 1 runtime verification failed.');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
