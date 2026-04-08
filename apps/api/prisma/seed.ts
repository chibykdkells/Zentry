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

  // ── Users ────────────────────────────────────────────────────

  const adminPassword = await bcrypt.hash('Admin@Zentry2024!', BCRYPT_ROUNDS);
  const testPassword = await bcrypt.hash('Test@1234!', BCRYPT_ROUNDS);
  const testPin = await bcrypt.hash('123456', PIN_ROUNDS);

  const legacyIndividual = await prisma.user.findUnique({
    where: { email: 'student@test.com' },
    select: { id: true },
  });

  const currentIndividual = await prisma.user.findUnique({
    where: { email: 'user@test.com' },
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
      },
    });
  }

  const admin = await prisma.user.upsert({
    where: { email: 'admin@zentry.ng' },
    update: {
      firstName: 'Zentry',
      lastName: 'Admin',
      phone: '+2348000000001',
      passwordHash: adminPassword,
      walletPin: testPin,
      role: UserRole.SUPER_ADMIN,
      isEmailVerified: true,
      isPhoneVerified: true,
    },
    create: {
      firstName: 'Zentry',
      lastName: 'Admin',
      email: 'admin@zentry.ng',
      phone: '+2348000000001',
      passwordHash: adminPassword,
      walletPin: testPin,
      role: UserRole.SUPER_ADMIN,
      isEmailVerified: true,
      isPhoneVerified: true,
    },
  });

  await prisma.wallet.upsert({
    where: { userId: admin.id },
    update: {
      availableBalance: 0n,
      escrowBalance: 0n,
      totalEarned: 0n,
      totalWithdrawn: 0n,
    },
    create: { userId: admin.id },
  });

  const individual = await prisma.user.upsert({
    where: { email: 'user@test.com' },
    update: {
      firstName: 'Test',
      lastName: 'User',
      phone: '+2348000000002',
      passwordHash: testPassword,
      walletPin: testPin,
      role: UserRole.INDIVIDUAL,
      isEmailVerified: true,
      isPhoneVerified: false,
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
    },
  });

  const individualWallet = await prisma.wallet.upsert({
    where: { userId: individual.id },
    update: {
      availableBalance: 500000n,
      escrowBalance: 0n,
      totalEarned: 0n,
      totalWithdrawn: 0n,
    },
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
    reference: 'SEED-IND-FUND-002',
    type: TransactionType.WALLET_FUNDING,
    amount: 150000n,
    balanceBefore: 350000n,
    balanceAfter: 500000n,
    description: 'Second wallet funding for manual acceptance checks',
    gateway: PaymentGateway.FLUTTERWAVE,
    gatewayRef: 'seed-flw-ind-002',
  });

  const cbtUser = await prisma.user.upsert({
    where: { email: 'cbt@test.com' },
    update: {
      firstName: 'Test',
      lastName: 'CBT',
      phone: '+2348000000003',
      passwordHash: testPassword,
      walletPin: testPin,
      role: UserRole.CBT_CENTER,
      isEmailVerified: true,
      isPhoneVerified: false,
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
    reference: 'SEED-CBT-WITHDRAW-001',
    type: TransactionType.WITHDRAWAL,
    amount: 50000n,
    balanceBefore: 120000n,
    balanceAfter: 70000n,
    description: 'Completed seeded withdrawal payout',
  });

  await prisma.cbtProfile.upsert({
    where: { userId: cbtUser.id },
    update: {},
    create: {
      userId: cbtUser.id,
      centerName: 'Test CBT Center',
      licenseNumber: 'CBT-TEST-001',
      licenseDocUrl: 'https://example.com/license.pdf',
      address: '1 Test Street, Lagos',
      state: 'Lagos',
      lga: 'Lagos Island',
      approvalStatus: CbtApprovalStatus.APPROVED,
      approvedAt: new Date(),
      approvedById: admin.id,
    },
  });

  const cafe = await prisma.user.upsert({
    where: { email: 'cafe@test.com' },
    update: {
      firstName: 'Test',
      lastName: 'Cafe',
      phone: '+2348000000004',
      passwordHash: testPassword,
      walletPin: testPin,
      role: UserRole.CYBER_CAFE,
      isEmailVerified: true,
      isPhoneVerified: false,
    },
    create: {
      firstName: 'Test',
      lastName: 'Cafe',
      email: 'cafe@test.com',
      phone: '+2348000000004',
      passwordHash: testPassword,
      walletPin: testPin,
      role: UserRole.CYBER_CAFE,
      isEmailVerified: true,
    },
  });

  const cafeWallet = await prisma.wallet.upsert({
    where: { userId: cafe.id },
    update: {
      availableBalance: 200000n,
      escrowBalance: 50000n,
      totalEarned: 0n,
      totalWithdrawn: 0n,
    },
    create: {
      userId: cafe.id,
      availableBalance: 200000n,
      escrowBalance: 50000n,
      totalEarned: 0n,
      totalWithdrawn: 0n,
    },
  });

  await upsertSeedTransaction({
    walletId: cafeWallet.id,
    userId: cafe.id,
    reference: 'SEED-CAFE-FUND-001',
    type: TransactionType.WALLET_FUNDING,
    amount: 250000n,
    balanceBefore: 0n,
    balanceAfter: 250000n,
    description: 'Seeded cafe wallet funding for walk-in operations',
    gateway: PaymentGateway.FINTAVAPAY,
    gatewayRef: 'seed-fintava-cafe-001',
  });

  await upsertSeedTransaction({
    walletId: cafeWallet.id,
    userId: cafe.id,
    reference: 'SEED-CAFE-ESCROW-001',
    type: TransactionType.ESCROW_LOCK,
    amount: 50000n,
    balanceBefore: 250000n,
    balanceAfter: 200000n,
    description: 'Escrow locked for a seeded customer service request',
  });

  await prisma.cyberCafeProfile.upsert({
    where: { userId: cafe.id },
    update: {},
    create: {
      userId: cafe.id,
      businessName: 'Test Cyber Cafe',
      address: '2 Test Avenue, Abuja',
      state: 'FCT',
    },
  });

  // ── Service Categories ────────────────────────────────────────

  const jamb = await prisma.serviceCategoryModel.upsert({
    where: { slug: 'jamb' },
    update: {},
    create: { name: 'JAMB', slug: 'jamb', description: 'JAMB examination services', sortOrder: 1 },
  });

  const nimc = await prisma.serviceCategoryModel.upsert({
    where: { slug: 'nimc' },
    update: {},
    create: { name: 'NIMC', slug: 'nimc', description: 'National Identity Management Commission services', sortOrder: 2 },
  });

  const neco = await prisma.serviceCategoryModel.upsert({
    where: { slug: 'neco' },
    update: {},
    create: { name: 'NECO', slug: 'neco', description: 'NECO examination services', sortOrder: 3 },
  });

  const airtimeCat = await prisma.serviceCategoryModel.upsert({
    where: { slug: 'vtu-airtime' },
    update: {},
    create: { name: 'Airtime Topup', slug: 'vtu-airtime', description: 'Buy airtime for any network', sortOrder: 4 },
  });

  const dataCat = await prisma.serviceCategoryModel.upsert({
    where: { slug: 'vtu-data' },
    update: {},
    create: { name: 'Data Subscription', slug: 'vtu-data', description: 'Buy data bundles', sortOrder: 5 },
  });

  const cableCat = await prisma.serviceCategoryModel.upsert({
    where: { slug: 'vtu-cable' },
    update: {},
    create: { name: 'Cable TV', slug: 'vtu-cable', description: 'Pay for DStv, GOtv, StarTimes', sortOrder: 6 },
  });

  const electricityCat = await prisma.serviceCategoryModel.upsert({
    where: { slug: 'vtu-electricity' },
    update: {},
    create: { name: 'Electricity', slug: 'vtu-electricity', description: 'Pay electricity bills', sortOrder: 7 },
  });

  // ── Services ──────────────────────────────────────────────────

  const jambServices = [
    {
      name: 'JAMB Original Result Printing',
      slug: 'jamb-result-printing',
      platformFee: 50000n,
      cbtCommission: 30000n,
      deliveryMode: ServiceDeliveryMode.CBT_MANUAL,
    },
    {
      name: 'JAMB Admission Letter Printing',
      slug: 'jamb-admission-letter',
      platformFee: 50000n,
      cbtCommission: 30000n,
      deliveryMode: ServiceDeliveryMode.CBT_MANUAL,
    },
    {
      name: 'JAMB Reprinting',
      slug: 'jamb-reprinting',
      platformFee: 50000n,
      cbtCommission: 30000n,
      deliveryMode: ServiceDeliveryMode.CBT_MANUAL,
    },
    {
      name: 'Check JAMB Admission Status',
      slug: 'jamb-admission-status',
      platformFee: 20000n,
      cbtCommission: 0n,
      deliveryMode: ServiceDeliveryMode.API_AUTOMATED,
    },
    {
      name: "JAMB O'Level Result Screenshot",
      slug: 'jamb-olevel-screenshot',
      platformFee: 30000n,
      cbtCommission: 30000n,
      deliveryMode: ServiceDeliveryMode.CBT_MANUAL,
    },
    {
      name: 'JAMB Profile Code Retrieval',
      slug: 'jamb-profile-code',
      platformFee: 20000n,
      cbtCommission: 0n,
      deliveryMode: ServiceDeliveryMode.API_AUTOMATED,
    },
    {
      name: 'JAMB Registration Number Retrieval',
      slug: 'jamb-reg-number',
      platformFee: 20000n,
      cbtCommission: 0n,
      deliveryMode: ServiceDeliveryMode.API_AUTOMATED,
    },
  ];

  for (const s of jambServices) {
    await prisma.service.upsert({
      where: { slug: s.slug },
      update: {
        categoryId: jamb.id,
        name: s.name,
        deliveryMode: s.deliveryMode,
        fulfillmentType:
          s.deliveryMode === ServiceDeliveryMode.CBT_MANUAL
            ? FulfillmentType.MANUAL
            : FulfillmentType.AUTOMATED,
        providerCost: 0n,
        platformFee: s.platformFee,
        totalPrice: s.platformFee,
        cbtCommission: s.cbtCommission,
        requiredFields: [{ name: 'registrationNumber', label: 'JAMB Registration Number', type: 'text', required: true }],
        requiredDocuments: [],
      },
      create: {
        categoryId: jamb.id,
        name: s.name,
        slug: s.slug,
        deliveryMode: s.deliveryMode,
        fulfillmentType:
          s.deliveryMode === ServiceDeliveryMode.CBT_MANUAL
            ? FulfillmentType.MANUAL
            : FulfillmentType.AUTOMATED,
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
    {
      name: 'NIN Slip Printing',
      slug: 'nimc-nin-slip',
      platformFee: 30000n,
      cbtCommission: 0n,
      deliveryMode: ServiceDeliveryMode.API_AUTOMATED,
    },
    {
      name: 'NIN Validation',
      slug: 'nimc-nin-validation',
      platformFee: 20000n,
      cbtCommission: 0n,
      deliveryMode: ServiceDeliveryMode.API_AUTOMATED,
    },
    {
      name: 'NIN Modification',
      slug: 'nimc-nin-modification',
      platformFee: 50000n,
      cbtCommission: 25000n,
      deliveryMode: ServiceDeliveryMode.CBT_MANUAL,
    },
  ];

  for (const s of nimcServices) {
    await prisma.service.upsert({
      where: { slug: s.slug },
      update: {
        categoryId: nimc.id,
        name: s.name,
        deliveryMode: s.deliveryMode,
        fulfillmentType:
          s.deliveryMode === ServiceDeliveryMode.CBT_MANUAL
            ? FulfillmentType.MANUAL
            : FulfillmentType.AUTOMATED,
        providerCost: 0n,
        platformFee: s.platformFee,
        totalPrice: s.platformFee,
        cbtCommission: s.cbtCommission,
        requiredFields: [{ name: 'nin', label: 'NIN (11 digits)', type: 'text', required: true }],
        requiredDocuments:
          s.slug === 'nimc-nin-modification'
            ? [
                {
                  name: 'nin-slip',
                  label: 'Existing NIN Slip',
                  required: true,
                  acceptedTypes: ['PDF', 'JPG', 'PNG'],
                  description: 'Upload the current slip or slip print used for the modification request.',
                },
                {
                  name: 'supporting-proof',
                  label: 'Supporting Proof',
                  required: true,
                  acceptedTypes: ['PDF', 'JPG', 'PNG'],
                  description: 'Upload the correction evidence, such as date-of-birth or name support document.',
                },
              ]
            : [],
      },
      create: {
        categoryId: nimc.id,
        name: s.name,
        slug: s.slug,
        deliveryMode: s.deliveryMode,
        fulfillmentType:
          s.deliveryMode === ServiceDeliveryMode.CBT_MANUAL
            ? FulfillmentType.MANUAL
            : FulfillmentType.AUTOMATED,
        providerCost: 0n,
        platformFee: s.platformFee,
        totalPrice: s.platformFee,
        cbtCommission: s.cbtCommission,
        requiredFields: [{ name: 'nin', label: 'NIN (11 digits)', type: 'text', required: true }],
        requiredDocuments:
          s.slug === 'nimc-nin-modification'
            ? [
                {
                  name: 'nin-slip',
                  label: 'Existing NIN Slip',
                  required: true,
                  acceptedTypes: ['PDF', 'JPG', 'PNG'],
                  description: 'Upload the current slip or slip print used for the modification request.',
                },
                {
                  name: 'supporting-proof',
                  label: 'Supporting Proof',
                  required: true,
                  acceptedTypes: ['PDF', 'JPG', 'PNG'],
                  description: 'Upload the correction evidence, such as date-of-birth or name support document.',
                },
              ]
            : [],
      },
    });
  }

  await prisma.service.upsert({
    where: { slug: 'neco-e-verification' },
    update: {
      categoryId: neco.id,
      name: 'NECO e-Verification',
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
        {
          name: 'result-copy',
          label: 'Result Copy',
          required: true,
          acceptedTypes: ['PDF', 'JPG', 'PNG'],
          description: 'Upload a clear copy or screenshot of the result to verify.',
        },
      ],
    },
    create: {
      categoryId: neco.id,
      name: 'NECO e-Verification',
      slug: 'neco-e-verification',
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
        {
          name: 'result-copy',
          label: 'Result Copy',
          required: true,
          acceptedTypes: ['PDF', 'JPG', 'PNG'],
          description: 'Upload a clear copy or screenshot of the result to verify.',
        },
      ],
    },
  });

  // VTU services (automated — no CBT commission)
  const vtuServices = [
    { categoryId: airtimeCat.id, name: 'MTN Airtime', slug: 'airtime-mtn', providerKey: 'MTN' },
    { categoryId: airtimeCat.id, name: 'GLO Airtime', slug: 'airtime-glo', providerKey: 'GLO' },
    { categoryId: airtimeCat.id, name: 'Airtel Airtime', slug: 'airtime-airtel', providerKey: 'AIRTEL' },
    { categoryId: airtimeCat.id, name: '9Mobile Airtime', slug: 'airtime-9mobile', providerKey: '9MOBILE' },
    { categoryId: dataCat.id, name: 'MTN Data', slug: 'data-mtn', providerKey: 'MTN' },
    { categoryId: dataCat.id, name: 'GLO Data', slug: 'data-glo', providerKey: 'GLO' },
    { categoryId: dataCat.id, name: 'Airtel Data', slug: 'data-airtel', providerKey: 'AIRTEL' },
    { categoryId: dataCat.id, name: '9Mobile Data', slug: 'data-9mobile', providerKey: '9MOBILE' },
    { categoryId: cableCat.id, name: 'DStv Subscription', slug: 'cable-dstv', providerKey: 'DSTV' },
    { categoryId: cableCat.id, name: 'GOtv Subscription', slug: 'cable-gotv', providerKey: 'GOTV' },
    { categoryId: cableCat.id, name: 'StarTimes Subscription', slug: 'cable-startimes', providerKey: 'STARTIMES' },
    { categoryId: electricityCat.id, name: 'EKEDC (Eko Electric)', slug: 'electricity-ekedc', providerKey: 'EKEDC' },
    { categoryId: electricityCat.id, name: 'IKEDC (Ikeja Electric)', slug: 'electricity-ikedc', providerKey: 'IKEDC' },
    { categoryId: electricityCat.id, name: 'AEDC (Abuja Electric)', slug: 'electricity-aedc', providerKey: 'AEDC' },
  ];

  for (const s of vtuServices) {
    await prisma.service.upsert({
      where: { slug: s.slug },
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
        requiredFields: [],
        requiredDocuments: [],
      },
      create: {
        categoryId: s.categoryId,
        name: s.name,
        slug: s.slug,
        deliveryMode: ServiceDeliveryMode.API_AUTOMATED,
        fulfillmentType: FulfillmentType.AUTOMATED,
        providerCost: 0n, // Updated by admin with real provider cost
        platformFee: 5000n, // ₦50 markup
        totalPrice: 5000n,
        cbtCommission: 0n,
        providerKey: s.providerKey,
        requiredFields: [],
        requiredDocuments: [],
      },
    });
  }

  // ── Seeded manual orders for requester/admin/CBT workspaces ───────────────

  const nimcModificationService = await prisma.service.findUniqueOrThrow({
    where: { slug: 'nimc-nin-modification' },
    select: {
      id: true,
      totalPrice: true,
      platformFee: true,
      cbtCommission: true,
      deliveryMode: true,
      fulfillmentType: true,
    },
  });

  const jambResultService = await prisma.service.findUniqueOrThrow({
    where: { slug: 'jamb-result-printing' },
    select: {
      id: true,
      totalPrice: true,
      platformFee: true,
      cbtCommission: true,
      deliveryMode: true,
      fulfillmentType: true,
    },
  });

  const seedCafePendingOrder = await prisma.order.upsert({
    where: { orderNumber: 'ZTR-SEED-CAFE-001' },
    update: {
      requesterId: cafe.id,
      serviceId: nimcModificationService.id,
      status: 'PENDING',
      deliveryMode: nimcModificationService.deliveryMode,
      fulfillmentType: nimcModificationService.fulfillmentType,
      submittedData: {
        nin: '22334455667',
      },
      requesterDocUrls: [
        'https://example.com/seed/nin-slip.pdf',
        'https://example.com/seed/supporting-proof.pdf',
      ],
      totalAmount: nimcModificationService.totalPrice,
      platformFee: nimcModificationService.platformFee,
      cbtCommission: nimcModificationService.cbtCommission,
      assignedCbtId: null,
      assignedAt: null,
      completedAt: null,
      cbtNotes: null,
      adminNotes: 'Seeded pending manual order for CBT job-pool visibility.',
    },
    create: {
      orderNumber: 'ZTR-SEED-CAFE-001',
      requesterId: cafe.id,
      serviceId: nimcModificationService.id,
      status: 'PENDING',
      deliveryMode: nimcModificationService.deliveryMode,
      fulfillmentType: nimcModificationService.fulfillmentType,
      submittedData: {
        nin: '22334455667',
      },
      requesterDocUrls: [
        'https://example.com/seed/nin-slip.pdf',
        'https://example.com/seed/supporting-proof.pdf',
      ],
      totalAmount: nimcModificationService.totalPrice,
      platformFee: nimcModificationService.platformFee,
      cbtCommission: nimcModificationService.cbtCommission,
      adminNotes: 'Seeded pending manual order for CBT job-pool visibility.',
    },
  });

  const seedAssignedOrder = await prisma.order.upsert({
    where: { orderNumber: 'ZTR-SEED-CBT-001' },
    update: {
      requesterId: individual.id,
      serviceId: jambResultService.id,
      status: 'IN_PROGRESS',
      deliveryMode: jambResultService.deliveryMode,
      fulfillmentType: jambResultService.fulfillmentType,
      submittedData: {
        registrationNumber: '202600000001AA',
      },
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
      serviceId: jambResultService.id,
      status: 'IN_PROGRESS',
      deliveryMode: jambResultService.deliveryMode,
      fulfillmentType: jambResultService.fulfillmentType,
      submittedData: {
        registrationNumber: '202600000001AA',
      },
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

  const seedReadyForReleaseOrder = await prisma.order.upsert({
    where: { orderNumber: 'ZTR-SEED-READY-001' },
    update: {
      requesterId: individual.id,
      serviceId: jambResultService.id,
      status: 'COMPLETED',
      deliveryMode: jambResultService.deliveryMode,
      fulfillmentType: jambResultService.fulfillmentType,
      submittedData: {
        registrationNumber: '202600000002BB',
      },
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
      serviceId: jambResultService.id,
      status: 'COMPLETED',
      deliveryMode: jambResultService.deliveryMode,
      fulfillmentType: jambResultService.fulfillmentType,
      submittedData: {
        registrationNumber: '202600000002BB',
      },
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

  const seedBlockedReleaseOrder = await prisma.order.upsert({
    where: { orderNumber: 'ZTR-SEED-BLOCKED-001' },
    update: {
      requesterId: individual.id,
      serviceId: jambResultService.id,
      status: 'COMPLETED',
      deliveryMode: jambResultService.deliveryMode,
      fulfillmentType: jambResultService.fulfillmentType,
      submittedData: {
        registrationNumber: '202600000003CC',
      },
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
      serviceId: jambResultService.id,
      status: 'COMPLETED',
      deliveryMode: jambResultService.deliveryMode,
      fulfillmentType: jambResultService.fulfillmentType,
      submittedData: {
        registrationNumber: '202600000003CC',
      },
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
    },
    create: {
      orderId: seedBlockedReleaseOrder.id,
      raisedById: individual.id,
      reason: 'Seeded dispute keeps this completed order out of the release queue.',
      evidenceUrls: ['https://example.com/seed/evidence/dispute-note.pdf'],
      status: 'OPEN',
    },
  });

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
    reference: 'SEED-IND-ESCROW-002',
    type: TransactionType.ESCROW_LOCK,
    amount: jambResultService.totalPrice,
    balanceBefore: 450000n,
    balanceAfter: 430000n,
    description: 'Escrow locked for seeded JAMB result request awaiting release',
  });

  await prisma.transaction.update({
    where: { reference: 'SEED-IND-ESCROW-001' },
    data: {
      orderId: seedAssignedOrder.id,
      metadata: {
        orderNumber: seedAssignedOrder.orderNumber,
        scope: 'seeded-order-link',
      },
    },
  });

  await prisma.transaction.update({
    where: { reference: 'SEED-IND-ESCROW-002' },
    data: {
      orderId: seedReadyForReleaseOrder.id,
      metadata: {
        orderNumber: seedReadyForReleaseOrder.orderNumber,
        scope: 'seeded-release-ready-order',
      },
    },
  });

  await upsertSeedTransaction({
    walletId: individualWallet.id,
    userId: individual.id,
    reference: 'SEED-IND-ESCROW-003',
    type: TransactionType.ESCROW_LOCK,
    amount: jambResultService.totalPrice,
    balanceBefore: 430000n,
    balanceAfter: 410000n,
    description: 'Escrow locked for seeded disputed JAMB result request',
  });

  await prisma.transaction.update({
    where: { reference: 'SEED-IND-ESCROW-003' },
    data: {
      orderId: seedBlockedReleaseOrder.id,
      metadata: {
        orderNumber: seedBlockedReleaseOrder.orderNumber,
        scope: 'seeded-blocked-release-order',
      },
    },
  });

  await prisma.transaction.update({
    where: { reference: 'SEED-CAFE-ESCROW-001' },
    data: {
      orderId: seedCafePendingOrder.id,
      metadata: {
        orderNumber: seedCafePendingOrder.orderNumber,
        scope: 'seeded-order-link',
      },
    },
  });

  // ── System Config ─────────────────────────────────────────────

  const configs = [
    { key: 'DISPUTE_WINDOW_HOURS', value: '2', description: 'Hours after result upload before escrow auto-releases' },
    { key: 'PLATFORM_MIN_WITHDRAWAL_KOBO', value: '100000', description: 'Minimum withdrawal amount in Kobo (₦1,000)' },
    { key: 'MAINTENANCE_MODE', value: 'false', description: 'Set to true to put platform in maintenance mode' },
    { key: 'MAX_PIN_ATTEMPTS', value: '5', description: 'Max wrong PIN attempts before lockout' },
    { key: 'PIN_LOCKOUT_MINUTES', value: '15', description: 'PIN lockout duration in minutes' },
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
  console.log('  Super Admin : admin@zentry.ng      / Admin@Zentry2024!  PIN: 123456');
  console.log('  Individual  : user@test.com        / Test@1234!         PIN: 123456');
  console.log('  CBT Center  : cbt@test.com         / Test@1234!         PIN: 123456');
  console.log('  Cyber Cafe  : cafe@test.com        / Test@1234!         PIN: 123456');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
