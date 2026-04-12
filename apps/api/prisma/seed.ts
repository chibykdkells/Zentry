import {
  PrismaClient,
  UserRole,
  CbtApprovalStatus,
  FulfillmentType,
  ServiceDeliveryMode,
  PaymentGateway,
  TransactionStatus,
  TransactionType,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function upsertSeedTransaction(input: {
  walletId: string;
  userId: string;
  tenantId: string | null;
  reference: string;
  type: TransactionType;
  status?: TransactionStatus;
  amount: bigint;
  balanceBefore: bigint;
  balanceAfter: bigint;
  description: string;
  gateway?: PaymentGateway;
  gatewayRef?: string;
}) {
  await prisma.transaction.upsert({
    where: { reference: input.reference },
    update: {
      walletId: input.walletId,
      userId: input.userId,
      tenantId: input.tenantId,
      type: input.type,
      status: input.status ?? TransactionStatus.SUCCESS,
      amount: input.amount,
      balanceBefore: input.balanceBefore,
      balanceAfter: input.balanceAfter,
      description: input.description,
      gateway: input.gateway,
      gatewayRef: input.gatewayRef,
    },
    create: {
      walletId: input.walletId,
      userId: input.userId,
      tenantId: input.tenantId,
      reference: input.reference,
      type: input.type,
      status: input.status ?? TransactionStatus.SUCCESS,
      amount: input.amount,
      balanceBefore: input.balanceBefore,
      balanceAfter: input.balanceAfter,
      description: input.description,
      gateway: input.gateway,
      gatewayRef: input.gatewayRef,
    },
  });
}

async function main() {
  console.log('🌱 Seeding Zentry database...');

  const BCRYPT_ROUNDS = 12;
  const PIN_ROUNDS = 10;

  const adminPassword = await bcrypt.hash('Admin@Zentry2024!', BCRYPT_ROUNDS);
  const testPassword = await bcrypt.hash('Test@1234!', BCRYPT_ROUNDS);
  const testPin = await bcrypt.hash('123456', PIN_ROUNDS);

  // ── Tenant ────────────────────────────────────────────────────

  const testTenant = await prisma.tenant.upsert({
    where: { slug: 'testbiz' },
    update: {
      name: 'Test Business',
      primaryColor: '#0D1B3E',
      accentColor: '#F5A623',
      tenantMarginRate: 500, // 5% tenant margin (on top of platform rate)
      isActive: true,
    },
    create: {
      name: 'Test Business',
      slug: 'testbiz',
      primaryColor: '#0D1B3E',
      accentColor: '#F5A623',
      tenantMarginRate: 500,
      isActive: true,
    },
  });

  // ── Users ────────────────────────────────────────────────────

  // Super Admin — platform-level, no tenantId
  const existingAdmin = await prisma.user.findFirst({
    where: {
      email: 'admin@zentry.ng',
      tenantId: null,
    },
    select: { id: true },
  });

  const admin = existingAdmin
    ? await prisma.user.update({
        where: { id: existingAdmin.id },
        data: {
          firstName: 'Zentry',
          lastName: 'Admin',
          phone: '+2348000000001',
          passwordHash: adminPassword,
          walletPin: testPin,
          role: UserRole.SUPER_ADMIN,
          isEmailVerified: true,
          isPhoneVerified: true,
          tenantId: null,
        },
      })
    : await prisma.user.create({
        data: {
          firstName: 'Zentry',
          lastName: 'Admin',
          email: 'admin@zentry.ng',
          phone: '+2348000000001',
          passwordHash: adminPassword,
          walletPin: testPin,
          role: UserRole.SUPER_ADMIN,
          isEmailVerified: true,
          isPhoneVerified: true,
          tenantId: null,
        },
      });

  await prisma.wallet.upsert({
    where: { userId: admin.id },
    update: { availableBalance: 0n, escrowBalance: 0n, totalEarned: 0n, totalWithdrawn: 0n },
    create: { userId: admin.id },
  });

  // Tenant Admin — belongs to testbiz tenant
  const tenantAdmin = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: testTenant.id,
        email: 'tenant@test.com',
      },
    },
    update: {
      firstName: 'Test',
      lastName: 'TenantAdmin',
      phone: '+2348000000005',
      passwordHash: testPassword,
      walletPin: testPin,
      role: UserRole.TENANT_ADMIN,
      isEmailVerified: true,
      isPhoneVerified: false,
      tenantId: testTenant.id,
    },
    create: {
      firstName: 'Test',
      lastName: 'TenantAdmin',
      email: 'tenant@test.com',
      phone: '+2348000000005',
      passwordHash: testPassword,
      walletPin: testPin,
      role: UserRole.TENANT_ADMIN,
      isEmailVerified: true,
      tenantId: testTenant.id,
    },
  });

  await prisma.wallet.upsert({
    where: { userId: tenantAdmin.id },
    update: { availableBalance: 0n, escrowBalance: 0n, totalEarned: 0n, totalWithdrawn: 0n },
    create: { userId: tenantAdmin.id },
  });

  // Handle legacy student email migration
  const legacyIndividual = await prisma.user.findFirst({
    where: {
      email: 'student@test.com',
      tenantId: testTenant.id,
    },
    select: { id: true },
  });
  const currentIndividual = await prisma.user.findFirst({
    where: {
      email: 'user@test.com',
      tenantId: testTenant.id,
    },
    select: { id: true },
  });
  if (legacyIndividual && !currentIndividual) {
    await prisma.user.update({
      where: { id: legacyIndividual.id },
      data: {
        firstName: 'Test',
        lastName: 'User',
        email: 'user@test.com',
        phone: '+2348000000002',
        passwordHash: testPassword,
        walletPin: testPin,
        role: UserRole.INDIVIDUAL,
        isEmailVerified: true,
        isPhoneVerified: false,
        tenantId: testTenant.id,
      },
    });
  }

  // Individual user — belongs to testbiz tenant
  const individual = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: testTenant.id,
        email: 'user@test.com',
      },
    },
    update: {
      firstName: 'Test',
      lastName: 'User',
      phone: '+2348000000002',
      passwordHash: testPassword,
      walletPin: testPin,
      role: UserRole.INDIVIDUAL,
      isEmailVerified: true,
      tenantId: testTenant.id,
    },
    create: {
      firstName: 'Test',
      lastName: 'User',
      email: 'user@test.com',
      phone: '+2348000000002',
      passwordHash: testPassword,
      walletPin: testPin,
      role: UserRole.INDIVIDUAL,
      isEmailVerified: true,
      tenantId: testTenant.id,
    },
  });

  const individualWallet = await prisma.wallet.upsert({
    where: { userId: individual.id },
    update: { availableBalance: 500000n, escrowBalance: 0n, totalEarned: 0n, totalWithdrawn: 0n },
    create: {
      userId: individual.id,
      availableBalance: 500000n,
      escrowBalance: 0n,
      totalEarned: 0n,
      totalWithdrawn: 0n,
    },
  });

  await upsertSeedTransaction({
    walletId: individualWallet.id,
    userId: individual.id,
    tenantId: testTenant.id,
    reference: 'SEED-IND-FUND-001',
    type: TransactionType.WALLET_FUNDING,
    amount: 350000n,
    balanceBefore: 0n,
    balanceAfter: 350000n,
    description: 'Initial wallet funding from seeded account setup',
    gateway: PaymentGateway.PAYSTACK,
    gatewayRef: 'seed-paystack-ind-001',
  });

  await upsertSeedTransaction({
    walletId: individualWallet.id,
    userId: individual.id,
    tenantId: testTenant.id,
    reference: 'SEED-IND-REFUND-001',
    type: TransactionType.REFUND,
    amount: 50000n,
    balanceBefore: 300000n,
    balanceAfter: 350000n,
    description: 'Seeded refund after a cancelled service request',
  });

  await upsertSeedTransaction({
    walletId: individualWallet.id,
    userId: individual.id,
    tenantId: testTenant.id,
    reference: 'SEED-IND-FUND-002',
    type: TransactionType.WALLET_FUNDING,
    amount: 150000n,
    balanceBefore: 350000n,
    balanceAfter: 500000n,
    description: 'Second wallet funding for manual acceptance checks',
    gateway: PaymentGateway.FLUTTERWAVE,
    gatewayRef: 'seed-flw-ind-002',
  });

  // CBT Center — belongs to testbiz tenant
  const cbtUser = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: testTenant.id,
        email: 'cbt@test.com',
      },
    },
    update: {
      firstName: 'Test',
      lastName: 'CBT',
      phone: '+2348000000003',
      passwordHash: testPassword,
      walletPin: testPin,
      role: UserRole.CBT_CENTER,
      isEmailVerified: true,
      tenantId: testTenant.id,
    },
    create: {
      firstName: 'Test',
      lastName: 'CBT',
      email: 'cbt@test.com',
      phone: '+2348000000003',
      passwordHash: testPassword,
      walletPin: testPin,
      role: UserRole.CBT_CENTER,
      isEmailVerified: true,
      tenantId: testTenant.id,
    },
  });

  const cbtWallet = await prisma.wallet.upsert({
    where: { userId: cbtUser.id },
    update: {
      availableBalance: 70000n,
      escrowBalance: 0n,
      totalEarned: 120000n,
      totalWithdrawn: 50000n,
    },
    create: {
      userId: cbtUser.id,
      availableBalance: 70000n,
      escrowBalance: 0n,
      totalEarned: 120000n,
      totalWithdrawn: 50000n,
    },
  });

  await upsertSeedTransaction({
    walletId: cbtWallet.id,
    userId: cbtUser.id,
    tenantId: testTenant.id,
    reference: 'SEED-CBT-EARN-001',
    type: TransactionType.CBT_COMMISSION,
    amount: 120000n,
    balanceBefore: 0n,
    balanceAfter: 120000n,
    description: 'Commission earned from seeded CBT fulfillment',
  });

  await upsertSeedTransaction({
    walletId: cbtWallet.id,
    userId: cbtUser.id,
    tenantId: testTenant.id,
    reference: 'SEED-CBT-WITHDRAW-001',
    type: TransactionType.WITHDRAWAL,
    amount: 50000n,
    balanceBefore: 120000n,
    balanceAfter: 70000n,
    description: 'Completed seeded withdrawal payout',
  });

  await prisma.cbtProfile.upsert({
    where: { userId: cbtUser.id },
    update: { tenantId: testTenant.id },
    create: {
      userId: cbtUser.id,
      tenantId: testTenant.id,
      centerName: 'Test CBT Center',
      licenseNumber: 'CBT-TEST-001',
      address: '1 Test Street, Lagos',
      state: 'Lagos',
      lga: 'Lagos Island',
      approvalStatus: CbtApprovalStatus.APPROVED,
      approvedAt: new Date(),
      approvedById: admin.id,
    },
  });

  // ── Service Categories (per tenant) ──────────────────────────

  const jamb = await prisma.serviceCategoryModel.upsert({
    where: { slug_tenantId: { slug: 'jamb', tenantId: testTenant.id } },
    update: {},
    create: {
      name: 'JAMB',
      slug: 'jamb',
      description: 'JAMB examination services',
      sortOrder: 1,
      tenantId: testTenant.id,
    },
  });

  const nimc = await prisma.serviceCategoryModel.upsert({
    where: { slug_tenantId: { slug: 'nimc', tenantId: testTenant.id } },
    update: {},
    create: {
      name: 'NIMC',
      slug: 'nimc',
      description: 'National Identity Management Commission services',
      sortOrder: 2,
      tenantId: testTenant.id,
    },
  });

  const neco = await prisma.serviceCategoryModel.upsert({
    where: { slug_tenantId: { slug: 'neco', tenantId: testTenant.id } },
    update: {},
    create: {
      name: 'NECO',
      slug: 'neco',
      description: 'NECO examination services',
      sortOrder: 3,
      tenantId: testTenant.id,
    },
  });

  const airtimeCat = await prisma.serviceCategoryModel.upsert({
    where: { slug_tenantId: { slug: 'vtu-airtime', tenantId: testTenant.id } },
    update: {},
    create: {
      name: 'Airtime Topup',
      slug: 'vtu-airtime',
      description: 'Buy airtime for any network',
      sortOrder: 4,
      tenantId: testTenant.id,
    },
  });

  const dataCat = await prisma.serviceCategoryModel.upsert({
    where: { slug_tenantId: { slug: 'vtu-data', tenantId: testTenant.id } },
    update: {},
    create: {
      name: 'Data Subscription',
      slug: 'vtu-data',
      description: 'Buy data bundles',
      sortOrder: 5,
      tenantId: testTenant.id,
    },
  });

  const cableCat = await prisma.serviceCategoryModel.upsert({
    where: { slug_tenantId: { slug: 'vtu-cable', tenantId: testTenant.id } },
    update: {},
    create: {
      name: 'Cable TV',
      slug: 'vtu-cable',
      description: 'Pay for DStv, GOtv, StarTimes',
      sortOrder: 6,
      tenantId: testTenant.id,
    },
  });

  const electricityCat = await prisma.serviceCategoryModel.upsert({
    where: { slug_tenantId: { slug: 'vtu-electricity', tenantId: testTenant.id } },
    update: {},
    create: {
      name: 'Electricity',
      slug: 'vtu-electricity',
      description: 'Pay electricity bills',
      sortOrder: 7,
      tenantId: testTenant.id,
    },
  });

  // ── Services (per tenant) ──────────────────────────────────────

  const jambServices = [
    { name: 'JAMB Original Result Printing',    slug: 'jamb-result-printing',  platformFee: 50000n, cbtCommission: 30000n, deliveryMode: ServiceDeliveryMode.CBT_MANUAL },
    { name: 'JAMB Admission Letter Printing',    slug: 'jamb-admission-letter', platformFee: 50000n, cbtCommission: 30000n, deliveryMode: ServiceDeliveryMode.CBT_MANUAL },
    { name: 'JAMB Reprinting',                  slug: 'jamb-reprinting',        platformFee: 50000n, cbtCommission: 30000n, deliveryMode: ServiceDeliveryMode.CBT_MANUAL },
    { name: 'Check JAMB Admission Status',       slug: 'jamb-admission-status', platformFee: 20000n, cbtCommission: 0n,     deliveryMode: ServiceDeliveryMode.API_AUTOMATED },
    { name: "JAMB O'Level Result Screenshot",    slug: 'jamb-olevel-screenshot',platformFee: 30000n, cbtCommission: 30000n, deliveryMode: ServiceDeliveryMode.CBT_MANUAL },
    { name: 'JAMB Profile Code Retrieval',       slug: 'jamb-profile-code',     platformFee: 20000n, cbtCommission: 0n,     deliveryMode: ServiceDeliveryMode.API_AUTOMATED },
    { name: 'JAMB Registration Number Retrieval',slug: 'jamb-reg-number',       platformFee: 20000n, cbtCommission: 0n,     deliveryMode: ServiceDeliveryMode.API_AUTOMATED },
  ];

  for (const s of jambServices) {
    await prisma.service.upsert({
      where: { slug_tenantId: { slug: s.slug, tenantId: testTenant.id } },
      update: {
        categoryId: jamb.id,
        name: s.name,
        deliveryMode: s.deliveryMode,
        fulfillmentType: s.deliveryMode === ServiceDeliveryMode.CBT_MANUAL ? FulfillmentType.MANUAL : FulfillmentType.AUTOMATED,
        providerCost: 0n,
        platformFee: s.platformFee,
        totalPrice: s.platformFee,
        cbtCommission: s.cbtCommission,
        tenantId: testTenant.id,
        requiredFields: [{ name: 'registrationNumber', label: 'JAMB Registration Number', type: 'text', required: true }],
        requiredDocuments: [],
      },
      create: {
        categoryId: jamb.id,
        name: s.name,
        slug: s.slug,
        tenantId: testTenant.id,
        deliveryMode: s.deliveryMode,
        fulfillmentType: s.deliveryMode === ServiceDeliveryMode.CBT_MANUAL ? FulfillmentType.MANUAL : FulfillmentType.AUTOMATED,
        providerCost: 0n,
        platformFee: s.platformFee,
        totalPrice: s.platformFee,
        cbtCommission: s.cbtCommission,
        requiredFields: [{ name: 'registrationNumber', label: 'JAMB Registration Number', type: 'text', required: true }],
        requiredDocuments: [],
      },
    });
  }

  const nimcServices = [
    { name: 'NIN Slip Printing',  slug: 'nimc-nin-slip',        platformFee: 30000n, cbtCommission: 0n,     deliveryMode: ServiceDeliveryMode.API_AUTOMATED },
    { name: 'NIN Validation',     slug: 'nimc-nin-validation',  platformFee: 20000n, cbtCommission: 0n,     deliveryMode: ServiceDeliveryMode.API_AUTOMATED },
    { name: 'NIN Modification',   slug: 'nimc-nin-modification',platformFee: 50000n, cbtCommission: 25000n, deliveryMode: ServiceDeliveryMode.CBT_MANUAL },
  ];

  for (const s of nimcServices) {
    const nimcDocs =
      s.slug === 'nimc-nin-modification'
        ? [
            { name: 'nin-slip', label: 'Existing NIN Slip', required: true, acceptedTypes: ['PDF', 'JPG', 'PNG'], description: 'Upload the current slip or slip print used for the modification request.' },
            { name: 'supporting-proof', label: 'Supporting Proof', required: true, acceptedTypes: ['PDF', 'JPG', 'PNG'], description: 'Upload the correction evidence, such as date-of-birth or name support document.' },
          ]
        : [];

    await prisma.service.upsert({
      where: { slug_tenantId: { slug: s.slug, tenantId: testTenant.id } },
      update: {
        categoryId: nimc.id,
        name: s.name,
        deliveryMode: s.deliveryMode,
        fulfillmentType: s.deliveryMode === ServiceDeliveryMode.CBT_MANUAL ? FulfillmentType.MANUAL : FulfillmentType.AUTOMATED,
        providerCost: 0n,
        platformFee: s.platformFee,
        totalPrice: s.platformFee,
        cbtCommission: s.cbtCommission,
        tenantId: testTenant.id,
        requiredFields: [{ name: 'nin', label: 'NIN (11 digits)', type: 'text', required: true }],
        requiredDocuments: nimcDocs,
      },
      create: {
        categoryId: nimc.id,
        name: s.name,
        slug: s.slug,
        tenantId: testTenant.id,
        deliveryMode: s.deliveryMode,
        fulfillmentType: s.deliveryMode === ServiceDeliveryMode.CBT_MANUAL ? FulfillmentType.MANUAL : FulfillmentType.AUTOMATED,
        providerCost: 0n,
        platformFee: s.platformFee,
        totalPrice: s.platformFee,
        cbtCommission: s.cbtCommission,
        requiredFields: [{ name: 'nin', label: 'NIN (11 digits)', type: 'text', required: true }],
        requiredDocuments: nimcDocs,
      },
    });
  }

  await prisma.service.upsert({
    where: { slug_tenantId: { slug: 'neco-e-verification', tenantId: testTenant.id } },
    update: {
      categoryId: neco.id,
      name: 'NECO e-Verification',
      deliveryMode: ServiceDeliveryMode.CBT_MANUAL,
      fulfillmentType: FulfillmentType.MANUAL,
      providerCost: 0n,
      platformFee: 30000n,
      totalPrice: 30000n,
      cbtCommission: 15000n,
      tenantId: testTenant.id,
      requiredFields: [
        { name: 'examNumber', label: 'NECO Exam Number', type: 'text', required: true },
        { name: 'examYear', label: 'Exam Year', type: 'number', required: true },
      ],
      requiredDocuments: [
        { name: 'result-copy', label: 'Result Copy', required: true, acceptedTypes: ['PDF', 'JPG', 'PNG'], description: 'Upload a clear copy or screenshot of the result to verify.' },
      ],
    },
    create: {
      categoryId: neco.id,
      name: 'NECO e-Verification',
      slug: 'neco-e-verification',
      tenantId: testTenant.id,
      deliveryMode: ServiceDeliveryMode.CBT_MANUAL,
      fulfillmentType: FulfillmentType.MANUAL,
      providerCost: 0n,
      platformFee: 30000n,
      totalPrice: 30000n,
      cbtCommission: 15000n,
      requiredFields: [
        { name: 'examNumber', label: 'NECO Exam Number', type: 'text', required: true },
        { name: 'examYear', label: 'Exam Year', type: 'number', required: true },
      ],
      requiredDocuments: [
        { name: 'result-copy', label: 'Result Copy', required: true, acceptedTypes: ['PDF', 'JPG', 'PNG'], description: 'Upload a clear copy or screenshot of the result to verify.' },
      ],
    },
  });

  // VTU services (automated — no CBT commission)
  const vtuServices = [
    { categoryId: airtimeCat.id, name: 'MTN Airtime',           slug: 'airtime-mtn',          providerKey: 'MTN' },
    { categoryId: airtimeCat.id, name: 'GLO Airtime',           slug: 'airtime-glo',          providerKey: 'GLO' },
    { categoryId: airtimeCat.id, name: 'Airtel Airtime',        slug: 'airtime-airtel',       providerKey: 'AIRTEL' },
    { categoryId: airtimeCat.id, name: '9Mobile Airtime',       slug: 'airtime-9mobile',      providerKey: '9MOBILE' },
    { categoryId: dataCat.id,    name: 'MTN Data',              slug: 'data-mtn',             providerKey: 'MTN' },
    { categoryId: dataCat.id,    name: 'GLO Data',              slug: 'data-glo',             providerKey: 'GLO' },
    { categoryId: dataCat.id,    name: 'Airtel Data',           slug: 'data-airtel',          providerKey: 'AIRTEL' },
    { categoryId: dataCat.id,    name: '9Mobile Data',          slug: 'data-9mobile',         providerKey: '9MOBILE' },
    { categoryId: cableCat.id,   name: 'DStv Subscription',     slug: 'cable-dstv',           providerKey: 'DSTV' },
    { categoryId: cableCat.id,   name: 'GOtv Subscription',     slug: 'cable-gotv',           providerKey: 'GOTV' },
    { categoryId: cableCat.id,   name: 'StarTimes Subscription',slug: 'cable-startimes',      providerKey: 'STARTIMES' },
    { categoryId: electricityCat.id, name: 'EKEDC (Eko Electric)',  slug: 'electricity-ekedc',providerKey: 'EKEDC' },
    { categoryId: electricityCat.id, name: 'IKEDC (Ikeja Electric)',slug: 'electricity-ikedc',providerKey: 'IKEDC' },
    { categoryId: electricityCat.id, name: 'AEDC (Abuja Electric)', slug: 'electricity-aedc', providerKey: 'AEDC' },
  ];

  for (const s of vtuServices) {
    const requiredFields = s.slug.startsWith('airtime-')
      ? [
          { name: 'phone', label: 'Phone Number', type: 'text', required: true },
          { name: 'amountNaira', label: 'Airtime Amount (Naira)', type: 'number', required: true },
        ]
      : s.slug.startsWith('data-')
        ? [
            { name: 'phone', label: 'Phone Number', type: 'text', required: true },
            { name: 'planCode', label: 'Data Plan', type: 'select', required: true },
          ]
        : s.slug.startsWith('cable-')
          ? [
              { name: 'smartcardNumber', label: 'Smartcard / IUC Number', type: 'text', required: true },
              { name: 'bouquetCode', label: 'Bouquet', type: 'select', required: true },
            ]
          : [
              { name: 'meterNumber', label: 'Meter Number', type: 'text', required: true },
              { name: 'meterType', label: 'Meter Type', type: 'select', required: true },
              { name: 'amountNaira', label: 'Amount (Naira)', type: 'number', required: true },
            ];

    await prisma.service.upsert({
      where: { slug_tenantId: { slug: s.slug, tenantId: testTenant.id } },
      update: {
        categoryId: s.categoryId,
        name: s.name,
        deliveryMode: ServiceDeliveryMode.API_AUTOMATED,
        fulfillmentType: FulfillmentType.AUTOMATED,
        providerCost: 0n,
        platformFee: 5000n,
        totalPrice: 5000n,
        cbtCommission: 0n,
        providerKey: s.providerKey,
        tenantId: testTenant.id,
        requiredFields,
        requiredDocuments: [],
      },
      create: {
        categoryId: s.categoryId,
        name: s.name,
        slug: s.slug,
        tenantId: testTenant.id,
        deliveryMode: ServiceDeliveryMode.API_AUTOMATED,
        fulfillmentType: FulfillmentType.AUTOMATED,
        providerCost: 0n,
        platformFee: 5000n,
        totalPrice: 5000n,
        cbtCommission: 0n,
        providerKey: s.providerKey,
        requiredFields,
        requiredDocuments: [],
      },
    });
  }

  // ── Seeded Orders ─────────────────────────────────────────────

  const nimcModificationService = await prisma.service.findFirstOrThrow({
    where: { slug: 'nimc-nin-modification', tenantId: testTenant.id },
    select: { id: true, totalPrice: true, platformFee: true, cbtCommission: true, deliveryMode: true, fulfillmentType: true },
  });

  const jambResultService = await prisma.service.findFirstOrThrow({
    where: { slug: 'jamb-result-printing', tenantId: testTenant.id },
    select: { id: true, totalPrice: true, platformFee: true, cbtCommission: true, deliveryMode: true, fulfillmentType: true },
  });

  // Pending order (from individual, for CBT job-pool visibility)
  const seedPendingOrder = await prisma.order.upsert({
    where: { orderNumber: 'ZTR-SEED-PENDING-001' },
    update: {
      requesterId: individual.id,
      tenantId: testTenant.id,
      serviceId: nimcModificationService.id,
      status: 'PENDING',
      deliveryMode: nimcModificationService.deliveryMode,
      fulfillmentType: nimcModificationService.fulfillmentType,
      submittedData: { nin: '22334455667' },
      requesterDocUrls: ['https://example.com/seed/nin-slip.pdf', 'https://example.com/seed/supporting-proof.pdf'],
      totalAmount: nimcModificationService.totalPrice,
      platformFee: nimcModificationService.platformFee,
      cbtCommission: nimcModificationService.cbtCommission,
      assignedCbtId: null,
      completedAt: null,
      adminNotes: 'Seeded pending manual order for CBT job-pool visibility.',
    },
    create: {
      orderNumber: 'ZTR-SEED-PENDING-001',
      requesterId: individual.id,
      tenantId: testTenant.id,
      serviceId: nimcModificationService.id,
      status: 'PENDING',
      deliveryMode: nimcModificationService.deliveryMode,
      fulfillmentType: nimcModificationService.fulfillmentType,
      submittedData: { nin: '22334455667' },
      requesterDocUrls: ['https://example.com/seed/nin-slip.pdf', 'https://example.com/seed/supporting-proof.pdf'],
      totalAmount: nimcModificationService.totalPrice,
      platformFee: nimcModificationService.platformFee,
      cbtCommission: nimcModificationService.cbtCommission,
      adminNotes: 'Seeded pending manual order for CBT job-pool visibility.',
    },
  });

  // In-progress order (assigned to CBT)
  const seedAssignedOrder = await prisma.order.upsert({
    where: { orderNumber: 'ZTR-SEED-CBT-001' },
    update: {
      requesterId: individual.id,
      tenantId: testTenant.id,
      serviceId: jambResultService.id,
      status: 'IN_PROGRESS',
      deliveryMode: jambResultService.deliveryMode,
      fulfillmentType: jambResultService.fulfillmentType,
      submittedData: { registrationNumber: '202600000001AA' },
      requesterDocUrls: [],
      totalAmount: jambResultService.totalPrice,
      platformFee: jambResultService.platformFee,
      cbtCommission: jambResultService.cbtCommission,
      assignedCbtId: cbtUser.id,
      assignedAt: new Date('2026-04-06T09:30:00.000Z'),
      cbtNotes: 'Seeded in-progress CBT assignment for dashboard and my-jobs visibility.',
      adminNotes: 'Seeded assignment linked to CBT workspace.',
    },
    create: {
      orderNumber: 'ZTR-SEED-CBT-001',
      requesterId: individual.id,
      tenantId: testTenant.id,
      serviceId: jambResultService.id,
      status: 'IN_PROGRESS',
      deliveryMode: jambResultService.deliveryMode,
      fulfillmentType: jambResultService.fulfillmentType,
      submittedData: { registrationNumber: '202600000001AA' },
      requesterDocUrls: [],
      totalAmount: jambResultService.totalPrice,
      platformFee: jambResultService.platformFee,
      cbtCommission: jambResultService.cbtCommission,
      assignedCbtId: cbtUser.id,
      assignedAt: new Date('2026-04-06T09:30:00.000Z'),
      cbtNotes: 'Seeded in-progress CBT assignment for dashboard and my-jobs visibility.',
      adminNotes: 'Seeded assignment linked to CBT workspace.',
    },
  });

  // Completed order (ready for release)
  const seedReadyForReleaseOrder = await prisma.order.upsert({
    where: { orderNumber: 'ZTR-SEED-READY-001' },
    update: {
      requesterId: individual.id,
      tenantId: testTenant.id,
      serviceId: jambResultService.id,
      status: 'COMPLETED',
      deliveryMode: jambResultService.deliveryMode,
      fulfillmentType: jambResultService.fulfillmentType,
      submittedData: { registrationNumber: '202600000002BB' },
      requesterDocUrls: [],
      resultFileUrl: 'https://example.com/seed/results/jamb-result-ready.pdf',
      resultUploadedAt: new Date('2026-04-06T07:00:00.000Z'),
      totalAmount: jambResultService.totalPrice,
      platformFee: jambResultService.platformFee,
      cbtCommission: jambResultService.cbtCommission,
      assignedCbtId: cbtUser.id,
      assignedAt: new Date('2026-04-06T06:30:00.000Z'),
      completedAt: new Date('2026-04-06T07:00:00.000Z'),
      disputeWindowExpiresAt: new Date('2026-04-06T09:00:00.000Z'),
      escrowReleasedAt: null,
      cbtNotes: 'Seeded completed order ready for delayed release review.',
      adminNotes: 'Seeded completed manual order for release-readiness visibility.',
    },
    create: {
      orderNumber: 'ZTR-SEED-READY-001',
      requesterId: individual.id,
      tenantId: testTenant.id,
      serviceId: jambResultService.id,
      status: 'COMPLETED',
      deliveryMode: jambResultService.deliveryMode,
      fulfillmentType: jambResultService.fulfillmentType,
      submittedData: { registrationNumber: '202600000002BB' },
      requesterDocUrls: [],
      resultFileUrl: 'https://example.com/seed/results/jamb-result-ready.pdf',
      resultUploadedAt: new Date('2026-04-06T07:00:00.000Z'),
      totalAmount: jambResultService.totalPrice,
      platformFee: jambResultService.platformFee,
      cbtCommission: jambResultService.cbtCommission,
      assignedCbtId: cbtUser.id,
      assignedAt: new Date('2026-04-06T06:30:00.000Z'),
      completedAt: new Date('2026-04-06T07:00:00.000Z'),
      disputeWindowExpiresAt: new Date('2026-04-06T09:00:00.000Z'),
      cbtNotes: 'Seeded completed order ready for delayed release review.',
      adminNotes: 'Seeded completed manual order for release-readiness visibility.',
    },
  });

  // Completed + disputed order (blocked from release)
  const seedBlockedReleaseOrder = await prisma.order.upsert({
    where: { orderNumber: 'ZTR-SEED-BLOCKED-001' },
    update: {
      requesterId: individual.id,
      tenantId: testTenant.id,
      serviceId: jambResultService.id,
      status: 'COMPLETED',
      deliveryMode: jambResultService.deliveryMode,
      fulfillmentType: jambResultService.fulfillmentType,
      submittedData: { registrationNumber: '202600000003CC' },
      requesterDocUrls: [],
      resultFileUrl: 'https://example.com/seed/results/jamb-result-disputed.pdf',
      resultUploadedAt: new Date('2026-04-06T08:00:00.000Z'),
      totalAmount: jambResultService.totalPrice,
      platformFee: jambResultService.platformFee,
      cbtCommission: jambResultService.cbtCommission,
      assignedCbtId: cbtUser.id,
      assignedAt: new Date('2026-04-06T07:30:00.000Z'),
      completedAt: new Date('2026-04-06T08:00:00.000Z'),
      disputeWindowExpiresAt: new Date('2026-04-06T10:00:00.000Z'),
      escrowReleasedAt: null,
      cbtNotes: 'Seeded completed order intentionally held by dispute.',
      adminNotes: 'Seeded blocked release candidate for scheduler audit visibility.',
    },
    create: {
      orderNumber: 'ZTR-SEED-BLOCKED-001',
      requesterId: individual.id,
      tenantId: testTenant.id,
      serviceId: jambResultService.id,
      status: 'COMPLETED',
      deliveryMode: jambResultService.deliveryMode,
      fulfillmentType: jambResultService.fulfillmentType,
      submittedData: { registrationNumber: '202600000003CC' },
      requesterDocUrls: [],
      resultFileUrl: 'https://example.com/seed/results/jamb-result-disputed.pdf',
      resultUploadedAt: new Date('2026-04-06T08:00:00.000Z'),
      totalAmount: jambResultService.totalPrice,
      platformFee: jambResultService.platformFee,
      cbtCommission: jambResultService.cbtCommission,
      assignedCbtId: cbtUser.id,
      assignedAt: new Date('2026-04-06T07:30:00.000Z'),
      completedAt: new Date('2026-04-06T08:00:00.000Z'),
      disputeWindowExpiresAt: new Date('2026-04-06T10:00:00.000Z'),
      cbtNotes: 'Seeded completed order intentionally held by dispute.',
      adminNotes: 'Seeded blocked release candidate for scheduler audit visibility.',
    },
  });

  await prisma.dispute.upsert({
    where: { orderId: seedBlockedReleaseOrder.id },
    update: {
      raisedById: individual.id,
      reason: 'Seeded dispute keeps this completed order out of the release queue.',
      evidenceUrls: ['https://example.com/seed/evidence/dispute-note.pdf'],
      status: 'OPEN',
      resolvedById: null,
      resolutionNote: null,
      resolvedAt: null,
      redoDeadline: null,
      redoCompletedAt: null,
      tenantId: testTenant.id,
    },
    create: {
      orderId: seedBlockedReleaseOrder.id,
      raisedById: individual.id,
      reason: 'Seeded dispute keeps this completed order out of the release queue.',
      evidenceUrls: ['https://example.com/seed/evidence/dispute-note.pdf'],
      status: 'OPEN',
      tenantId: testTenant.id,
    },
  });

  // Update individual wallet to reflect escrowed orders
  await prisma.wallet.update({
    where: { id: individualWallet.id },
    data: {
      availableBalance: 410000n,
      escrowBalance: 90000n,
      totalEarned: 0n,
      totalWithdrawn: 0n,
    },
  });

  await upsertSeedTransaction({
    walletId: individualWallet.id,
    userId: individual.id,
    tenantId: testTenant.id,
    reference: 'SEED-IND-ESCROW-001',
    type: TransactionType.ESCROW_LOCK,
    amount: jambResultService.totalPrice,
    balanceBefore: 500000n,
    balanceAfter: 450000n,
    description: 'Escrow locked for seeded JAMB result request',
  });

  await upsertSeedTransaction({
    walletId: individualWallet.id,
    userId: individual.id,
    tenantId: testTenant.id,
    reference: 'SEED-IND-ESCROW-002',
    type: TransactionType.ESCROW_LOCK,
    amount: jambResultService.totalPrice,
    balanceBefore: 450000n,
    balanceAfter: 430000n,
    description: 'Escrow locked for seeded JAMB result request awaiting release',
  });

  await upsertSeedTransaction({
    walletId: individualWallet.id,
    userId: individual.id,
    tenantId: testTenant.id,
    reference: 'SEED-IND-ESCROW-003',
    type: TransactionType.ESCROW_LOCK,
    amount: jambResultService.totalPrice,
    balanceBefore: 430000n,
    balanceAfter: 410000n,
    description: 'Escrow locked for seeded disputed JAMB result request',
  });

  // Link transactions to orders
  await prisma.transaction.update({
    where: { reference: 'SEED-IND-ESCROW-001' },
    data: { orderId: seedAssignedOrder.id, metadata: { orderNumber: seedAssignedOrder.orderNumber, scope: 'seeded-order-link' } },
  });
  await prisma.transaction.update({
    where: { reference: 'SEED-IND-ESCROW-002' },
    data: { orderId: seedReadyForReleaseOrder.id, metadata: { orderNumber: seedReadyForReleaseOrder.orderNumber, scope: 'seeded-release-ready-order' } },
  });
  await prisma.transaction.update({
    where: { reference: 'SEED-IND-ESCROW-003' },
    data: { orderId: seedBlockedReleaseOrder.id, metadata: { orderNumber: seedBlockedReleaseOrder.orderNumber, scope: 'seeded-blocked-release-order' } },
  });

  // Also link pending order escrow (if needed later)
  void seedPendingOrder;

  // ── System Config ─────────────────────────────────────────────

  const configs = [
    { key: 'DISPUTE_WINDOW_HOURS',         value: '2',       description: 'Hours after result upload before escrow auto-releases' },
    { key: 'PLATFORM_COMMISSION_RATE',     value: '500',     description: 'Platform commission rate in basis points (500 = 5%)' },
    { key: 'PLATFORM_MIN_WITHDRAWAL_KOBO', value: '100000',  description: 'Minimum withdrawal amount in Kobo (₦1,000)' },
    { key: 'MAINTENANCE_MODE',             value: 'false',   description: 'Set to true to put platform in maintenance mode' },
    { key: 'MAX_PIN_ATTEMPTS',             value: '5',       description: 'Max wrong PIN attempts before lockout' },
    { key: 'PIN_LOCKOUT_MINUTES',          value: '15',      description: 'PIN lockout duration in minutes' },
  ];

  for (const c of configs) {
    await prisma.systemConfig.upsert({
      where: { key: c.key },
      update: {},
      create: c,
    });
  }

  console.log('✅ Seed complete!');
  console.log('');
  console.log('Test accounts:');
  console.log('  Super Admin   : admin@zentry.ng   / Admin@Zentry2024!  PIN: 123456  (platform-level)');
  console.log('  Tenant Admin  : tenant@test.com   / Test@1234!         PIN: 123456  (tenant: testbiz)');
  console.log('  Individual    : user@test.com     / Test@1234!         PIN: 123456  (tenant: testbiz)');
  console.log('  CBT Center    : cbt@test.com      / Test@1234!         PIN: 123456  (tenant: testbiz)');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
