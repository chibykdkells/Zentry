import { PrismaClient, UserRole, CbtApprovalStatus, FulfillmentType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

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
    update: {},
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

  await prisma.wallet.upsert({
    where: { userId: individual.id },
    update: {},
    create: { userId: individual.id, availableBalance: BigInt(500000) }, // ₦5,000 seed balance
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

  await prisma.wallet.upsert({
    where: { userId: cbtUser.id },
    update: {},
    create: { userId: cbtUser.id },
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

  await prisma.wallet.upsert({
    where: { userId: cafe.id },
    update: {},
    create: { userId: cafe.id, availableBalance: BigInt(200000) }, // ₦2,000 seed balance
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
    { name: 'JAMB Original Result Printing', slug: 'jamb-result-printing', platformFee: 50000n, cbtCommission: 30000n },
    { name: 'JAMB Admission Letter Printing', slug: 'jamb-admission-letter', platformFee: 50000n, cbtCommission: 30000n },
    { name: 'JAMB Reprinting', slug: 'jamb-reprinting', platformFee: 50000n, cbtCommission: 30000n },
    { name: 'Check JAMB Admission Status', slug: 'jamb-admission-status', platformFee: 20000n, cbtCommission: 10000n },
    { name: "JAMB O'Level Result Screenshot", slug: 'jamb-olevel-screenshot', platformFee: 30000n, cbtCommission: 15000n },
    { name: 'JAMB Profile Code Retrieval', slug: 'jamb-profile-code', platformFee: 20000n, cbtCommission: 10000n },
    { name: 'JAMB Registration Number Retrieval', slug: 'jamb-reg-number', platformFee: 20000n, cbtCommission: 10000n },
  ];

  for (const s of jambServices) {
    await prisma.service.upsert({
      where: { slug: s.slug },
      update: {},
      create: {
        categoryId: jamb.id,
        name: s.name,
        slug: s.slug,
        fulfillmentType: FulfillmentType.MANUAL,
        providerCost: 0n,
        platformFee: s.platformFee,
        totalPrice: s.platformFee,
        cbtCommission: s.cbtCommission,
        requiredFields: [{ name: 'registrationNumber', label: 'JAMB Registration Number', type: 'text', required: true }],
      },
    });
  }

  const nimcServices = [
    { name: 'NIN Slip Printing', slug: 'nimc-nin-slip', platformFee: 30000n, cbtCommission: 15000n },
    { name: 'NIN Validation', slug: 'nimc-nin-validation', platformFee: 20000n, cbtCommission: 10000n },
    { name: 'NIN Modification', slug: 'nimc-nin-modification', platformFee: 50000n, cbtCommission: 25000n },
  ];

  for (const s of nimcServices) {
    await prisma.service.upsert({
      where: { slug: s.slug },
      update: {},
      create: {
        categoryId: nimc.id,
        name: s.name,
        slug: s.slug,
        fulfillmentType: FulfillmentType.MANUAL,
        providerCost: 0n,
        platformFee: s.platformFee,
        totalPrice: s.platformFee,
        cbtCommission: s.cbtCommission,
        requiredFields: [{ name: 'nin', label: 'NIN (11 digits)', type: 'text', required: true }],
      },
    });
  }

  await prisma.service.upsert({
    where: { slug: 'neco-e-verification' },
    update: {},
    create: {
      categoryId: neco.id,
      name: 'NECO e-Verification',
      slug: 'neco-e-verification',
      fulfillmentType: FulfillmentType.MANUAL,
      providerCost: 0n,
      platformFee: 30000n,
      totalPrice: 30000n,
      cbtCommission: 15000n,
      requiredFields: [
        { name: 'examNumber', label: 'NECO Exam Number', type: 'text', required: true },
        { name: 'examYear', label: 'Exam Year', type: 'number', required: true },
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
      update: {},
      create: {
        categoryId: s.categoryId,
        name: s.name,
        slug: s.slug,
        fulfillmentType: FulfillmentType.AUTOMATED,
        providerCost: 0n, // Updated by admin with real provider cost
        platformFee: 5000n, // ₦50 markup
        totalPrice: 5000n,
        cbtCommission: 0n,
        providerKey: s.providerKey,
        requiredFields: [],
      },
    });
  }

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
