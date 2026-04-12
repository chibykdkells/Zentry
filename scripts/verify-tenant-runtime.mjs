const API_URL = process.env.ZENTRY_VERIFY_API_URL ?? 'http://localhost:4000';
const WEB_URL = process.env.ZENTRY_VERIFY_WEB_URL ?? 'http://localhost:3000';
const TENANT_SLUG = process.env.ZENTRY_VERIFY_TENANT_SLUG ?? 'testbiz';

const tenantAdminAccount = {
  email: 'tenant@test.com',
  password: 'Test@1234!',
  role: 'TENANT_ADMIN',
  defaultRoute: '/tenant/dashboard',
};

const tenantIndividualAccount = {
  email: 'user@test.com',
  password: 'Test@1234!',
  role: 'INDIVIDUAL',
  defaultRoute: '/home',
};

const tenantCbtAccount = {
  email: 'cbt@test.com',
  password: 'Test@1234!',
  role: 'CBT_CENTER',
  defaultRoute: '/dashboard',
};

const superAdminAccount = {
  email: 'admin@zentry.ng',
  password: 'Admin@Zentry2024!',
  role: 'SUPER_ADMIN',
};

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function buildTenantHeaders(extraHeaders = {}, tenantSlug = TENANT_SLUG) {
  return {
    'Content-Type': 'application/json',
    ...(tenantSlug ? { 'x-tenant-slug': tenantSlug } : {}),
    ...extraHeaders,
  };
}

function parseSetCookieHeader(headers) {
  const setCookie = headers.get('set-cookie');
  if (!setCookie) {
    return null;
  }

  const [cookiePair] = setCookie.split(';');
  return cookiePair;
}

function toBigInt(value) {
  return BigInt(String(value ?? '0'));
}

async function requestJson(url, init = {}) {
  const response = await fetch(url, {
    redirect: 'manual',
    ...init,
    headers: {
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

async function apiRequest(path, accessToken, cookie, init = {}, tenantSlug = TENANT_SLUG) {
  return requestJson(`${API_URL}/api/v1${path}`, {
    ...init,
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...(tenantSlug ? { 'x-tenant-slug': tenantSlug } : {}),
      ...(init.headers ?? {}),
    },
  });
}

async function uploadResultFile(path, accessToken, cookie, note) {
  const form = new FormData();
  form.append(
    'file',
    new Blob([`%PDF-1.4\nRuntime result ${Date.now()}\n%%EOF`], {
      type: 'application/pdf',
    }),
    'runtime-result.pdf',
  );

  if (note) {
    form.append('cbtNotes', note);
  }

  return apiRequest(path, accessToken, cookie, {
    method: 'POST',
    body: form,
  });
}

async function loginAccount(account, tenantSlug = TENANT_SLUG) {
  const login = await requestJson(`${API_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: buildTenantHeaders({}, tenantSlug),
    body: JSON.stringify({
      email: account.email,
      password: account.password,
    }),
  });

  assert(login.response.status === 200, `${account.email}: login failed`);
  assert(
    login.body?.data?.user?.role === account.role,
    `${account.email}: login returned wrong role`,
  );

  const refreshCookie = parseSetCookieHeader(login.response.headers);
  assert(refreshCookie, `${account.email}: login did not set refresh cookie`);

  return {
    accessToken: login.body.data.accessToken,
    cookie: refreshCookie,
    user: login.body.data.user,
  };
}

async function verifyTenantConfig() {
  const viaWeb = await requestJson(
    `${WEB_URL}/api/v1/tenants/config?slug=${encodeURIComponent(TENANT_SLUG)}`,
  );

  assert(viaWeb.response.status === 200, 'tenant config via web proxy failed');
  assert(
    viaWeb.body?.data?.slug === TENANT_SLUG,
    'tenant config via web proxy returned wrong tenant',
  );

  const viaApi = await requestJson(
    `${API_URL}/api/v1/tenants/config?slug=${encodeURIComponent(TENANT_SLUG)}`,
  );

  assert(viaApi.response.status === 200, 'tenant config via api failed');
  assert(
    viaApi.body?.data?.slug === TENANT_SLUG,
    'tenant config via api returned wrong tenant',
  );
}

async function verifyTenantRegistration() {
  const seed = Date.now();

  const individualPayload = {
    firstName: 'Runtime',
    lastName: 'Individual',
    email: `runtime.individual.${seed}@example.com`,
    phone: `080${String(seed).slice(-8)}`,
    password: 'Test@1234!',
    confirmPassword: 'Test@1234!',
  };

  const individualRegister = await requestJson(
    `${API_URL}/api/v1/auth/register/individual`,
    {
      method: 'POST',
      headers: buildTenantHeaders(),
      body: JSON.stringify(individualPayload),
    },
  );

  assert(
    individualRegister.response.status === 201,
    `tenant individual registration failed (${individualRegister.response.status})`,
  );
  assert(
    individualRegister.body?.data?.role === 'INDIVIDUAL',
    'tenant individual registration returned wrong role',
  );

  const cbtPayload = {
    firstName: 'Runtime',
    lastName: 'Cbt',
    email: `runtime.cbt.${seed}@example.com`,
    phone: `081${String(seed).slice(-8)}`,
    password: 'Test@1234!',
    confirmPassword: 'Test@1234!',
    centerName: 'Runtime CBT Center',
    licenseNumber: `CBT-${seed}`,
    address: '12 Runtime Street, Lagos',
    state: 'Lagos',
    lga: 'Ikeja',
  };

  const cbtRegister = await requestJson(`${API_URL}/api/v1/auth/register/cbt`, {
    method: 'POST',
    headers: buildTenantHeaders(),
    body: JSON.stringify(cbtPayload),
  });

  assert(
    cbtRegister.response.status === 201,
    `tenant CBT registration failed (${cbtRegister.response.status})`,
  );
  assert(
    cbtRegister.body?.data?.role === 'CBT_CENTER',
    'tenant CBT registration returned wrong role',
  );

  return {
    individualEmail: individualPayload.email,
    cbtEmail: cbtPayload.email,
  };
}

async function verifyTenantAdminAccess() {
  const login = await loginAccount(tenantAdminAccount);
  const refreshCookie = login.cookie;

  const me = await requestJson(`${API_URL}/api/v1/auth/me`, {
    headers: {
      Authorization: `Bearer ${login.accessToken}`,
      Cookie: refreshCookie,
      'x-tenant-slug': TENANT_SLUG,
    },
  });

  assert(me.response.status === 200, 'tenant admin /auth/me failed');
  assert(me.body?.data?.role === 'TENANT_ADMIN', 'tenant admin /auth/me returned wrong role');

  const loginRedirect = await fetch(`${WEB_URL}/login?tenant=${encodeURIComponent(TENANT_SLUG)}`, {
    redirect: 'manual',
    headers: {
      Cookie: refreshCookie,
    },
  });

  assert(
    loginRedirect.status >= 300 && loginRedirect.status < 400,
    'tenant admin /login did not redirect when authenticated',
  );
  assert(
    loginRedirect.headers.get('location') === tenantAdminAccount.defaultRoute,
    'tenant admin /login redirected to wrong route',
  );

  const dashboard = await fetch(`${WEB_URL}/tenant/dashboard`, {
    redirect: 'manual',
    headers: { Cookie: refreshCookie },
  });
  assert(dashboard.status === 200, 'tenant dashboard did not load');

  const users = await fetch(`${WEB_URL}/tenant/users`, {
    redirect: 'manual',
    headers: { Cookie: refreshCookie },
  });
  assert(users.status === 200, 'tenant users page did not load');

  const settings = await fetch(`${WEB_URL}/tenant/settings`, {
    redirect: 'manual',
    headers: { Cookie: refreshCookie },
  });
  assert(settings.status === 200, 'tenant settings page did not load');

  const disallowed = await fetch(`${WEB_URL}/admin/dashboard`, {
    redirect: 'manual',
    headers: { Cookie: refreshCookie },
  });

  assert(
    disallowed.status >= 300 && disallowed.status < 400,
    'tenant admin disallowed route did not redirect',
  );
  assert(
    disallowed.headers.get('location') === tenantAdminAccount.defaultRoute,
    'tenant admin disallowed route redirected incorrectly',
  );

  const overview = await requestJson(`${API_URL}/api/v1/tenants/me`, {
    headers: {
      Authorization: `Bearer ${login.accessToken}`,
      Cookie: refreshCookie,
      'x-tenant-slug': TENANT_SLUG,
    },
  });
  if (overview.response.status !== 200) {
    const summary = `${overview.response.status} ${
      overview.body?.message ?? 'unknown error'
    }`;
    throw new Error(
      `tenant overview endpoint failed (${summary}). If tenant login and /tenant pages worked, your local API on :4000 is likely stale and needs a restart.`,
    );
  }
  assert(overview.body?.data?.tenant?.slug === TENANT_SLUG, 'tenant overview returned wrong tenant');

  const tenantUsers = await requestJson(`${API_URL}/api/v1/tenants/me/users?page=1&limit=5`, {
    headers: {
      Authorization: `Bearer ${login.accessToken}`,
      Cookie: refreshCookie,
      'x-tenant-slug': TENANT_SLUG,
    },
  });
  assert(tenantUsers.response.status === 200, 'tenant users endpoint failed');
  assert(
    Array.isArray(tenantUsers.body?.data?.users),
    'tenant users endpoint did not return a users list',
  );

  return {
    cookie: refreshCookie,
    accessToken: login.accessToken,
    overview: overview.body.data,
  };
}

async function verifyTenantIndividualFlow() {
  const login = await loginAccount(tenantIndividualAccount);

  const protectedPages = ['/home', '/services', '/orders', '/wallet', '/profile'];
  for (const route of protectedPages) {
    const response = await fetch(`${WEB_URL}${route}`, {
      redirect: 'manual',
      headers: { Cookie: login.cookie },
    });
    assert(response.status === 200, `tenant individual page failed: ${route}`);
  }

  const apis = [
    '/auth/me',
    '/users/me',
    '/wallet/me',
    '/orders/me',
    '/services/catalog',
  ];

  for (const route of apis) {
    const response = await requestJson(`${API_URL}/api/v1${route}`, {
      headers: {
        Authorization: `Bearer ${login.accessToken}`,
        Cookie: login.cookie,
        'x-tenant-slug': TENANT_SLUG,
      },
    });
    assert(response.response.status === 200, `tenant individual api failed: ${route}`);
  }

  const disallowed = await fetch(`${WEB_URL}/tenant/dashboard`, {
    redirect: 'manual',
    headers: { Cookie: login.cookie },
  });
  assert(
    disallowed.status >= 300 && disallowed.status < 400,
    'tenant individual disallowed tenant-admin route did not redirect',
  );
  assert(
    disallowed.headers.get('location') === tenantIndividualAccount.defaultRoute,
    'tenant individual disallowed route redirected incorrectly',
  );
}

async function getCatalogForUser(login) {
  const catalog = await apiRequest(
    '/services/catalog',
    login.accessToken,
    login.cookie,
  );
  assert(catalog.response.status === 200, 'service catalog fetch failed');
  assert(Array.isArray(catalog.body?.data?.services), 'service catalog did not return services');
  return catalog.body.data.services;
}

function buildSubmittedDataForService(service) {
  const fields = Array.isArray(service.requiredFields) ? service.requiredFields : [];

  return Object.fromEntries(
    fields.map((field, index) => {
      const name = String(field.name ?? '').trim();
      const label = String(field.label ?? '').trim().toLowerCase();
      const key = name.toLowerCase();
      const combined = `${key} ${label}`;

      if (key === 'phone' || combined.includes('phone')) {
        return [name, '08012345678'];
      }

      if (key === 'amountnaira' || key === 'amount' || combined.includes('amount')) {
        return [name, '100'];
      }

      if (key === 'email' || combined.includes('email')) {
        return [name, 'runtime.order@example.com'];
      }

      if (combined.includes('name')) {
        return [name, 'Runtime Customer'];
      }

      if (combined.includes('number') || combined.includes('reference')) {
        return [name, `REF-${Date.now()}-${index + 1}`];
      }

      return [name, `Runtime value ${index + 1}`];
    }),
  );
}

function pickTransactionalServices(services) {
  const automatedService = services.find(
    (service) =>
      service.deliveryMode === 'API_AUTOMATED' &&
      service.category?.slug === 'vtu-airtime',
  );

  const manualService = services.find(
    (service) =>
      service.deliveryMode === 'CBT_MANUAL' &&
      service.requiredDocumentsCount === 0,
  );

  assert(automatedService, 'no tenant automated airtime service was available');
  assert(manualService, 'no tenant manual CBT service without documents was available');

  return { automatedService, manualService };
}

async function verifyTenantSettingsPersistence(tenantAdmin) {
  const originalOverview = tenantAdmin.overview;
  const originalName = originalOverview.tenant.name;
  const originalAccent = originalOverview.tenant.accentColor;
  const updatedName = `${originalName} Runtime`;
  const updatedAccent = originalAccent === '#F5A623' ? '#E28743' : '#F5A623';

  const update = await requestJson(`${API_URL}/api/v1/tenants/me`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${tenantAdmin.accessToken}`,
      Cookie: tenantAdmin.cookie,
      'x-tenant-slug': TENANT_SLUG,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: updatedName,
      accentColor: updatedAccent,
    }),
  });
  assert(update.response.status === 200, 'tenant settings update failed');

  const refreshed = await requestJson(`${API_URL}/api/v1/tenants/me`, {
    headers: {
      Authorization: `Bearer ${tenantAdmin.accessToken}`,
      Cookie: tenantAdmin.cookie,
      'x-tenant-slug': TENANT_SLUG,
    },
  });
  assert(refreshed.response.status === 200, 'tenant settings verification fetch failed');
  assert(refreshed.body?.data?.tenant?.name === updatedName, 'tenant name did not persist');
  assert(
    refreshed.body?.data?.tenant?.accentColor === updatedAccent,
    'tenant accent color did not persist',
  );

  const restore = await requestJson(`${API_URL}/api/v1/tenants/me`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${tenantAdmin.accessToken}`,
      Cookie: tenantAdmin.cookie,
      'x-tenant-slug': TENANT_SLUG,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: originalName,
      accentColor: originalAccent,
    }),
  });
  assert(restore.response.status === 200, 'tenant settings restore failed');
}

async function verifyTenantUserFiltering(tenantAdmin, registrations) {
  const searchRes = await requestJson(
    `${API_URL}/api/v1/tenants/me/users?page=1&limit=10&search=${encodeURIComponent(
      'runtime.individual',
    )}`,
    {
      headers: {
        Authorization: `Bearer ${tenantAdmin.accessToken}`,
        Cookie: tenantAdmin.cookie,
        'x-tenant-slug': TENANT_SLUG,
      },
    },
  );
  assert(searchRes.response.status === 200, 'tenant user search failed');
  assert(
    searchRes.body?.data?.users?.some((user) => user.email === registrations.individualEmail),
    'tenant user search did not return the runtime individual',
  );

  const roleFilter = await requestJson(
    `${API_URL}/api/v1/tenants/me/users?page=1&limit=10&role=CBT_CENTER`,
    {
      headers: {
        Authorization: `Bearer ${tenantAdmin.accessToken}`,
        Cookie: tenantAdmin.cookie,
        'x-tenant-slug': TENANT_SLUG,
      },
    },
  );
  assert(roleFilter.response.status === 200, 'tenant user role filter failed');
  assert(
    roleFilter.body?.data?.users?.every((user) => user.role === 'CBT_CENTER'),
    'tenant user role filter returned non-CBT users',
  );
}

async function verifyTenantTransactionalFlows(tenantAdmin) {
  const individual = await loginAccount(tenantIndividualAccount);
  const cbt = await loginAccount(tenantCbtAccount);
  const superAdmin = await loginAccount(superAdminAccount, null);

  const services = await getCatalogForUser(individual);
  const { automatedService, manualService } = pickTransactionalServices(services);

  const walletBefore = await apiRequest(
    '/wallet/me',
    individual.accessToken,
    individual.cookie,
  );
  assert(walletBefore.response.status === 200, 'wallet overview before purchase failed');
  const availableBefore = toBigInt(walletBefore.body?.data?.availableBalance);
  const heldBefore = toBigInt(walletBefore.body?.data?.escrowBalance);

  const automatedOrder = await apiRequest(
    '/orders',
    individual.accessToken,
    individual.cookie,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceId: automatedService.id,
        submittedData: buildSubmittedDataForService(automatedService),
      }),
    },
  );
  assert(
    automatedOrder.response.status === 201,
    `tenant automated order creation failed (${automatedOrder.response.status})`,
  );
  assert(
    automatedOrder.body?.data?.status === 'COMPLETED',
    'tenant automated order did not complete immediately',
  );

  const walletAfterAutomated = await apiRequest(
    '/wallet/me',
    individual.accessToken,
    individual.cookie,
  );
  assert(walletAfterAutomated.response.status === 200, 'wallet overview after automated order failed');
  const availableAfterAutomated = toBigInt(
    walletAfterAutomated.body?.data?.availableBalance,
  );
  const heldAfterAutomated = toBigInt(walletAfterAutomated.body?.data?.escrowBalance);
  assert(
    availableAfterAutomated < availableBefore,
    'wallet available balance did not decrease after automated purchase',
  );
  assert(
    heldAfterAutomated === heldBefore,
    'held funds changed during automated purchase when they should not',
  );

  const transactionsAfterAutomated = await apiRequest(
    '/wallet/transactions?page=1&limit=20',
    individual.accessToken,
    individual.cookie,
  );
  assert(
    transactionsAfterAutomated.response.status === 200,
    'wallet transaction fetch after automated purchase failed',
  );
  assert(
    transactionsAfterAutomated.body?.data?.items?.some(
      (item) =>
        item.type === 'SERVICE_PURCHASE' &&
        item.description?.includes(automatedService.name),
    ),
    'wallet history did not record the automated service purchase',
  );

  const manualOrder = await apiRequest(
    '/orders',
    individual.accessToken,
    individual.cookie,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceId: manualService.id,
        submittedData: buildSubmittedDataForService(manualService),
      }),
    },
  );
  assert(
    manualOrder.response.status === 201,
    `tenant manual order creation failed (${manualOrder.response.status})`,
  );
  assert(
    manualOrder.body?.data?.status === 'PENDING',
    'tenant manual order was not created in pending state',
  );

  const manualOrderId = manualOrder.body?.data?.id;
  const manualOrderNumber = manualOrder.body?.data?.orderNumber;
  assert(manualOrderId && manualOrderNumber, 'manual order did not return id/order number');

  const walletAfterManual = await apiRequest(
    '/wallet/me',
    individual.accessToken,
    individual.cookie,
  );
  assert(walletAfterManual.response.status === 200, 'wallet overview after manual order failed');
  const availableAfterManual = toBigInt(walletAfterManual.body?.data?.availableBalance);
  const heldAfterManual = toBigInt(walletAfterManual.body?.data?.escrowBalance);
  assert(
    availableAfterManual < availableAfterAutomated,
    'wallet available balance did not decrease after manual order',
  );
  assert(
    heldAfterManual > heldAfterAutomated,
    'held funds did not increase after manual order',
  );

  const transactionsAfterManual = await apiRequest(
    '/wallet/transactions?page=1&limit=20',
    individual.accessToken,
    individual.cookie,
  );
  assert(
    transactionsAfterManual.response.status === 200,
    'wallet transaction fetch after manual order failed',
  );
  assert(
    transactionsAfterManual.body?.data?.items?.some(
      (item) =>
        item.type === 'ESCROW_LOCK' &&
        item.description?.includes(manualService.name),
    ),
    'wallet history did not record the held-funds lock for the manual order',
  );

  const cbtJobPool = await apiRequest(
    '/orders/cbt/job-pool?page=1&limit=20&search=' +
      encodeURIComponent(manualOrderNumber),
    cbt.accessToken,
    cbt.cookie,
  );
  assert(cbtJobPool.response.status === 200, 'tenant CBT job pool fetch failed');
  assert(
    cbtJobPool.body?.data?.items?.some((item) => item.id === manualOrderId),
    'manual tenant order did not appear in the tenant CBT job pool',
  );

  const claim = await apiRequest(
    `/orders/cbt/${manualOrderId}/claim`,
    cbt.accessToken,
    cbt.cookie,
    { method: 'POST' },
  );
  assert(claim.response.status === 201, 'tenant CBT claim failed');
  assert(
    claim.body?.data?.assignedCbt?.email === tenantCbtAccount.email,
    'tenant CBT claim did not assign the expected CBT user',
  );

  const cbtJobPoolAfterClaim = await apiRequest(
    '/orders/cbt/job-pool?page=1&limit=20&search=' +
      encodeURIComponent(manualOrderNumber),
    cbt.accessToken,
    cbt.cookie,
  );
  assert(
    cbtJobPoolAfterClaim.response.status === 200,
    'tenant CBT job pool fetch after claim failed',
  );
  assert(
    !cbtJobPoolAfterClaim.body?.data?.items?.some((item) => item.id === manualOrderId),
    'claimed manual order still appeared in the tenant CBT job pool',
  );

  const cbtMyJobs = await apiRequest(
    '/orders/cbt/my-jobs?page=1&limit=20&search=' +
      encodeURIComponent(manualOrderNumber),
    cbt.accessToken,
    cbt.cookie,
  );
  assert(cbtMyJobs.response.status === 200, 'tenant CBT my-jobs fetch failed');
  assert(
    cbtMyJobs.body?.data?.items?.some((item) => item.id === manualOrderId),
    'claimed manual order did not appear in tenant CBT my jobs',
  );

  const adminOrderView = await apiRequest(
    '/orders/admin?search=' + encodeURIComponent(manualOrderNumber),
    superAdmin.accessToken,
    superAdmin.cookie,
    {},
    null,
  );
  assert(adminOrderView.response.status === 200, 'platform admin order lookup failed');
  assert(
    adminOrderView.body?.data?.items?.some((item) => item.id === manualOrderId),
    'platform admin could not see the tenant manual order',
  );

  const adminWalletView = await apiRequest(
    '/wallet/admin/transactions?page=1&limit=50',
    superAdmin.accessToken,
    superAdmin.cookie,
    {},
    null,
  );
  assert(
    adminWalletView.response.status === 200,
    'platform admin wallet transaction lookup failed',
  );
  assert(
    adminWalletView.body?.data?.items?.some(
      (item) =>
        item.user?.email === tenantIndividualAccount.email &&
        (item.type === 'SERVICE_PURCHASE' || item.type === 'ESCROW_LOCK'),
    ),
    'platform admin wallet transaction lookup did not return tenant user order activity',
  );

  const tenantAdminOrders = await apiRequest(
    '/orders/admin',
    tenantAdmin.accessToken,
    tenantAdmin.cookie,
  );
  assert(
    tenantAdminOrders.response.status === 403,
    'tenant admin should not be able to access platform order admin endpoints',
  );

  const tenantAdminWallet = await apiRequest(
    '/wallet/admin/transactions?page=1&limit=5',
    tenantAdmin.accessToken,
    tenantAdmin.cookie,
  );
  assert(
    tenantAdminWallet.response.status === 403,
    'tenant admin should not be able to access platform wallet admin endpoints',
  );

  return {
    manualOrderId,
    automatedOrderNumber: automatedOrder.body.data.orderNumber,
    manualOrderNumber,
    automatedServiceName: automatedService.name,
    manualServiceName: manualService.name,
  };
}

async function verifyTenantBusinessStateFlows(tenantAdmin, transactionalFlows) {
  const individual = await loginAccount(tenantIndividualAccount);
  const cbt = await loginAccount(tenantCbtAccount);
  const superAdmin = await loginAccount(superAdminAccount, null);
  const orderId = transactionalFlows.manualOrderId;
  const orderNumber = transactionalFlows.manualOrderNumber;

  const start = await apiRequest(
    `/orders/cbt/${orderId}/start`,
    cbt.accessToken,
    cbt.cookie,
    { method: 'POST' },
  );
  assert(start.response.status === 201, 'tenant CBT start job failed');
  assert(
    start.body?.data?.status === 'IN_PROGRESS',
    'tenant CBT start did not move the job into progress',
  );

  const complete = await uploadResultFile(
    `/orders/cbt/${orderId}/result`,
    cbt.accessToken,
    cbt.cookie,
    'Runtime tenant completion proof',
  );
  assert(complete.response.status === 201, 'tenant CBT result upload failed');
  assert(
    complete.body?.data?.status === 'COMPLETED',
    'tenant CBT result upload did not complete the order',
  );
  assert(
    typeof complete.body?.data?.resultFileUrl === 'string' &&
      complete.body.data.resultFileUrl.length > 0,
    'tenant CBT completion did not return a result file URL',
  );

  const requesterDetail = await apiRequest(
    `/orders/me/${orderId}`,
    individual.accessToken,
    individual.cookie,
  );
  assert(requesterDetail.response.status === 200, 'tenant requester order detail failed after completion');
  assert(
    requesterDetail.body?.data?.status === 'COMPLETED',
    'tenant requester order detail did not reflect completion',
  );
  assert(
    typeof requesterDetail.body?.data?.resultFileUrl === 'string' &&
      requesterDetail.body.data.resultFileUrl.length > 0,
    'tenant requester could not see the uploaded finished work',
  );

  const dispute = await apiRequest(
    `/orders/me/${orderId}/dispute`,
    individual.accessToken,
    individual.cookie,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reason: 'The delivered result needs admin review for tenant runtime verification.',
        evidenceUrls: ['https://example.com/runtime-evidence.png'],
      }),
    },
  );
  assert(dispute.response.status === 201, 'tenant dispute creation failed');
  assert(
    dispute.body?.data?.status === 'DISPUTED' &&
      dispute.body?.data?.dispute?.status === 'OPEN',
    'tenant dispute creation did not move the order into disputed/open state',
  );

  const requesterDisputes = await apiRequest(
    '/orders/me/disputes?page=1&limit=10',
    individual.accessToken,
    individual.cookie,
  );
  assert(requesterDisputes.response.status === 200, 'tenant requester dispute list failed');
  assert(
    requesterDisputes.body?.data?.items?.some((item) => item.order?.id === orderId),
    'tenant requester dispute list did not include the newly raised dispute',
  );

  const adminDisputeQueue = await apiRequest(
    '/orders/admin/disputes?page=1&limit=20&search=' + encodeURIComponent(orderNumber),
    superAdmin.accessToken,
    superAdmin.cookie,
    {},
    null,
  );
  assert(adminDisputeQueue.response.status === 200, 'platform admin dispute queue lookup failed');
  assert(
    adminDisputeQueue.body?.data?.items?.some((item) => item.order?.id === orderId),
    'platform admin dispute queue did not include the tenant dispute',
  );

  const tenantAdminDisputeQueue = await apiRequest(
    '/orders/admin/disputes?page=1&limit=5',
    tenantAdmin.accessToken,
    tenantAdmin.cookie,
  );
  assert(
    tenantAdminDisputeQueue.response.status === 403,
    'tenant admin should not be able to access the platform dispute queue',
  );

  const resolveDispute = await apiRequest(
    `/orders/admin/${orderId}/dispute`,
    superAdmin.accessToken,
    superAdmin.cookie,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'RESOLVED_FOR_CBT',
        resolutionNote: 'Runtime tenant dispute resolved in favor of the CBT after review.',
      }),
    },
    null,
  );
  assert(resolveDispute.response.status === 200, 'platform admin dispute resolution failed');
  assert(
    resolveDispute.body?.data?.status === 'COMPLETED' &&
      resolveDispute.body?.data?.dispute?.status === 'RESOLVED_FOR_CBT',
    'platform admin dispute resolution did not restore the order to completed/CBT-resolved state',
  );

  const withdrawalsBefore = await apiRequest(
    '/wallet/withdrawals?page=1&limit=10',
    cbt.accessToken,
    cbt.cookie,
  );
  assert(withdrawalsBefore.response.status === 200, 'tenant CBT withdrawal list fetch failed before submission');

  const withdrawal = await apiRequest(
    '/wallet/withdrawals',
    cbt.accessToken,
    cbt.cookie,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amountNaira: 100,
        bankName: 'Runtime Bank',
        bankCode: '999',
        accountNumber: '0123456789',
        accountName: 'Runtime CBT Center',
      }),
    },
  );
  assert(withdrawal.response.status === 201, 'tenant CBT withdrawal request failed');
  assert(
    withdrawal.body?.data?.request?.status === 'PENDING',
    'tenant CBT withdrawal request was not created in pending state',
  );
  const withdrawalId = withdrawal.body?.data?.request?.id;
  assert(withdrawalId, 'tenant CBT withdrawal request did not return an id');

  const tenantAdminWithdrawalReview = await apiRequest(
    `/wallet/admin/withdrawals/${withdrawalId}`,
    tenantAdmin.accessToken,
    tenantAdmin.cookie,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'REJECTED',
        note: 'Tenant admins must not review platform payout requests.',
      }),
    },
  );
  assert(
    tenantAdminWithdrawalReview.response.status === 403,
    'tenant admin should not be able to review platform withdrawal requests',
  );

  const adminWithdrawals = await apiRequest(
    '/wallet/admin/withdrawals?page=1&limit=20&search=' +
      encodeURIComponent(tenantCbtAccount.email),
    superAdmin.accessToken,
    superAdmin.cookie,
    {},
    null,
  );
  assert(adminWithdrawals.response.status === 200, 'platform admin withdrawal queue lookup failed');
  assert(
    adminWithdrawals.body?.data?.items?.some((item) => item.id === withdrawalId),
    'platform admin withdrawal queue did not include the tenant CBT request',
  );

  const rejectWithdrawal = await apiRequest(
    `/wallet/admin/withdrawals/${withdrawalId}`,
    superAdmin.accessToken,
    superAdmin.cookie,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'REJECTED',
        note: 'Runtime tenant withdrawal verification completed; funds restored.',
      }),
    },
    null,
  );
  assert(rejectWithdrawal.response.status === 200, 'platform admin withdrawal review failed');
  assert(
    rejectWithdrawal.body?.data?.status === 'REJECTED',
    'platform admin withdrawal review did not reject the tenant CBT request',
  );

  const withdrawalsAfter = await apiRequest(
    '/wallet/withdrawals?page=1&limit=10',
    cbt.accessToken,
    cbt.cookie,
  );
  assert(withdrawalsAfter.response.status === 200, 'tenant CBT withdrawal list fetch failed after review');
  assert(
    withdrawalsAfter.body?.data?.items?.some(
      (item) => item.id === withdrawalId && item.status === 'REJECTED',
    ),
    'tenant CBT withdrawal list did not reflect the reviewed request',
  );

  return {
    orderNumber,
    withdrawalId,
  };
}

async function expectPageStatus(path, cookie, expectedStatus, label) {
  const response = await fetch(`${WEB_URL}${path}`, {
    redirect: 'manual',
    headers: cookie ? { Cookie: cookie } : {},
  });
  assert(response.status === expectedStatus, label);
  return response;
}

async function expectRedirect(path, cookie, expectedLocation, label) {
  const response = await fetch(`${WEB_URL}${path}`, {
    redirect: 'manual',
    headers: cookie ? { Cookie: cookie } : {},
  });
  assert(
    response.status >= 300 && response.status < 400,
    `${label}: expected redirect`,
  );
  assert(response.headers.get('location') === expectedLocation, label);
}

async function verifyAdminFinanceAndReportingSurfaces(tenantAdmin) {
  const superAdmin = await loginAccount(superAdminAccount, null);
  const individual = await loginAccount(tenantIndividualAccount);
  const cbt = await loginAccount(tenantCbtAccount);

  const adminPages = [
    '/admin/dashboard',
    '/admin/finance',
    '/admin/services',
    '/admin/users',
    '/admin/orders',
    '/admin/disputes',
  ];

  for (const path of adminPages) {
    await expectPageStatus(path, superAdmin.cookie, 200, `platform admin page failed: ${path}`);
  }

  for (const path of adminPages) {
    await expectRedirect(
      path,
      tenantAdmin.cookie,
      tenantAdminAccount.defaultRoute,
      `tenant admin should be redirected away from platform page ${path}`,
    );
    await expectRedirect(
      path,
      cbt.cookie,
      tenantCbtAccount.defaultRoute,
      `tenant CBT should be redirected away from platform page ${path}`,
    );
    await expectRedirect(
      path,
      individual.cookie,
      tenantIndividualAccount.defaultRoute,
      `tenant individual should be redirected away from platform page ${path}`,
    );
  }

  const superAdminApiChecks = [
    '/wallet/admin/overview',
    '/wallet/admin/cbt-earnings',
    '/wallet/admin/wallets?page=1&limit=5',
    '/wallet/admin/transactions?page=1&limit=5',
    '/wallet/admin/withdrawals?page=1&limit=5',
    '/orders/admin/overview',
    '/orders/admin/release-scheduler-preview',
    '/orders/admin?page=1&limit=5',
    '/orders/admin/disputes?page=1&limit=5',
    '/services/admin/categories',
    '/services/admin/services?page=1&limit=5',
    '/services/admin/provider-readiness',
  ];

  for (const path of superAdminApiChecks) {
    const response = await apiRequest(path, superAdmin.accessToken, superAdmin.cookie, {}, null);
    assert(response.response.status === 200, `platform admin api failed: ${path}`);
  }

  const tenantDeniedChecks = [
    '/wallet/admin/overview',
    '/wallet/admin/cbt-earnings',
    '/wallet/admin/wallets?page=1&limit=5',
    '/wallet/admin/transactions?page=1&limit=5',
    '/wallet/admin/withdrawals?page=1&limit=5',
    '/orders/admin/overview',
    '/orders/admin/release-scheduler-preview',
    '/orders/admin?page=1&limit=5',
    '/orders/admin/disputes?page=1&limit=5',
    '/services/admin/categories',
    '/services/admin/services?page=1&limit=5',
    '/services/admin/provider-readiness',
  ];

  for (const path of tenantDeniedChecks) {
    const tenantAdminResponse = await apiRequest(
      path,
      tenantAdmin.accessToken,
      tenantAdmin.cookie,
    );
    assert(
      tenantAdminResponse.response.status === 403,
      `tenant admin should not access platform api ${path}`,
    );

    const cbtResponse = await apiRequest(path, cbt.accessToken, cbt.cookie);
    assert(
      cbtResponse.response.status === 403,
      `tenant CBT should not access platform api ${path}`,
    );

    const individualResponse = await apiRequest(
      path,
      individual.accessToken,
      individual.cookie,
    );
    assert(
      individualResponse.response.status === 403,
      `tenant individual should not access platform api ${path}`,
    );
  }

  const tenantPages = ['/tenant/dashboard', '/tenant/users', '/tenant/settings'];

  for (const path of tenantPages) {
    await expectRedirect(
      path,
      superAdmin.cookie,
      superAdminAccount.role === 'SUPER_ADMIN' ? '/admin/dashboard' : '/login',
      `platform admin should be redirected away from tenant page ${path}`,
    );
  }

  return {
    checkedAdminPages: adminPages.length,
    checkedAdminApis: superAdminApiChecks.length,
  };
}

async function verifyCrossTenantDenial(tenantAdmin, registrations) {
  const superAdmin = await loginAccount(superAdminAccount, null);
  const seed = Date.now();
  const secondSlug = `runtime-tenant-${seed}`;

  const createTenant = await requestJson(`${API_URL}/api/v1/tenants`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${superAdmin.accessToken}`,
      Cookie: superAdmin.cookie,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: `Runtime Tenant ${seed}`,
      slug: secondSlug,
      primaryColor: '#102A43',
      accentColor: '#D97706',
    }),
  });
  assert(createTenant.response.status === 201, 'second tenant creation failed');
  const secondTenantId = createTenant.body?.id ?? createTenant.body?.data?.id;
  assert(secondTenantId, 'second tenant creation did not return an id');

  const createAdmin = await requestJson(`${API_URL}/api/v1/tenants/${secondTenantId}/admins`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${superAdmin.accessToken}`,
      Cookie: superAdmin.cookie,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      firstName: 'Runtime',
      lastName: 'TenantAdmin',
      email: `runtime.tenantadmin.${seed}@example.com`,
      phone: `090${String(seed).slice(-8)}`,
    }),
  });
  assert(createAdmin.response.status === 201, 'second tenant admin creation failed');

  const sameTenantDuplicate = await requestJson(
    `${API_URL}/api/v1/auth/register/individual`,
    {
      method: 'POST',
      headers: buildTenantHeaders(),
      body: JSON.stringify({
        firstName: 'Duplicate',
        lastName: 'TenantUser',
        email: tenantIndividualAccount.email,
        phone: '08011112222',
        password: 'Test@1234!',
        confirmPassword: 'Test@1234!',
      }),
    },
  );
  assert(
    sameTenantDuplicate.response.status === 409,
    'same-tenant duplicate email registration should be rejected',
  );

  const wrongTenantLogin = await requestJson(`${API_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: buildTenantHeaders({}, secondSlug),
    body: JSON.stringify({
      email: registrations.individualEmail,
      password: 'Test@1234!',
    }),
  });
  assert(
    wrongTenantLogin.response.status === 401,
    'login should fail when a tenant-only identity is used under the wrong tenant',
  );

  const crossTenantDuplicate = await requestJson(
    `${API_URL}/api/v1/auth/register/individual`,
    {
      method: 'POST',
      headers: buildTenantHeaders({}, secondSlug),
      body: JSON.stringify({
        firstName: 'Cross',
        lastName: 'TenantUser',
        email: tenantIndividualAccount.email,
        phone: '08087654321',
        password: 'Test@1234!',
        confirmPassword: 'Test@1234!',
      }),
    },
  );
  assert(
    crossTenantDuplicate.response.status === 201,
    `cross-tenant duplicate identity registration failed (${crossTenantDuplicate.response.status})`,
  );

  const mismatch = await requestJson(`${API_URL}/api/v1/tenants/me`, {
    headers: {
      Authorization: `Bearer ${tenantAdmin.accessToken}`,
      Cookie: tenantAdmin.cookie,
      'x-tenant-slug': secondSlug,
    },
  });
  assert(mismatch.response.status === 403, 'cross-tenant access was not denied');
}

async function main() {
  await verifyTenantConfig();
  const registrations = await verifyTenantRegistration();
  const tenantAdmin = await verifyTenantAdminAccess();
  await verifyTenantIndividualFlow();
  await verifyTenantSettingsPersistence(tenantAdmin);
  await verifyTenantUserFiltering(tenantAdmin, registrations);
  await verifyCrossTenantDenial(tenantAdmin, registrations);
  const transactionalFlows = await verifyTenantTransactionalFlows(tenantAdmin);
  const businessStateFlows = await verifyTenantBusinessStateFlows(
    tenantAdmin,
    transactionalFlows,
  );
  const adminSurfaceCoverage = await verifyAdminFinanceAndReportingSurfaces(
    tenantAdmin,
  );

  console.log('Tenant runtime verification passed.');
  console.log(`- tenant config resolved for ${TENANT_SLUG}`);
  console.log(`- individual registration worked for ${registrations.individualEmail}`);
  console.log(`- CBT registration worked for ${registrations.cbtEmail}`);
  console.log(`- tenant admin login, route access, and tenant endpoints all passed`);
  console.log(`- tenant individual pages and core APIs passed`);
  console.log(`- tenant settings persistence and restore passed`);
  console.log(`- tenant user search/filter and cross-tenant denial passed`);
  console.log(
    `- tenant transactional flows passed (${transactionalFlows.automatedServiceName}: ${transactionalFlows.automatedOrderNumber}, ${transactionalFlows.manualServiceName}: ${transactionalFlows.manualOrderNumber})`,
  );
  console.log(
    `- tenant completion, dispute, and withdrawal flows passed (${businessStateFlows.orderNumber}, withdrawal ${businessStateFlows.withdrawalId})`,
  );
  console.log(
    `- admin finance/reporting isolation passed (${adminSurfaceCoverage.checkedAdminPages} pages, ${adminSurfaceCoverage.checkedAdminApis} APIs)`,
  );
}

main().catch((error) => {
  console.error('Tenant runtime verification failed.');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
