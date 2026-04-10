import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ── Plans SaaS ────────────────────────────────────────────────────────
  const plans = [
    {
      code: 'BASIC' as any,
      name: 'Basic',
      description: 'Pour les petites équipes',
      priceMonthly: 49,
      priceYearly: 490,
      maxAgents: 5,
      maxCalls: 2000,
      maxStorage: 5120,
      modules: ['clients', 'calls', 'call-logs', 'campaigns', 'leads', 'agenda'],
    },
    {
      code: 'PRO' as any,
      name: 'Pro',
      description: 'Pour les équipes en croissance',
      priceMonthly: 149,
      priceYearly: 1490,
      maxAgents: 20,
      maxCalls: 10000,
      maxStorage: 51200,
      modules: [
        'clients', 'calls', 'call-logs', 'campaigns', 'leads', 'agenda',
        'analytics', 'kpi', 'reports', 'sales', 'recordings', 'supervision',
        'imports', 'lists', 'blacklist', 'quotes', 'invoices',
      ],
    },
    {
      code: 'ENTERPRISE' as any,
      name: 'Enterprise',
      description: 'Pour les grandes organisations',
      priceMonthly: 399,
      priceYearly: 3990,
      maxAgents: 999,
      maxCalls: 999999,
      maxStorage: 512000,
      modules: ['*'],
    },
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({ where: { code: plan.code }, create: plan, update: plan });
  }
  console.log(`✓ Plans SaaS créés (BASIC, PRO, ENTERPRISE)`);

  // Tenant par défaut
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'default' },
    update: {},
    create: {
      name: 'LNAYCRM Demo',
      slug: 'default',
      plan: 'PROFESSIONAL',
      trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });
  console.log(`✓ Tenant: ${tenant.name} (${tenant.id})`);

  // Subscription trial pour le tenant demo
  const proPlan = await prisma.plan.findUnique({ where: { code: 'PRO' as any } });
  if (proPlan) {
    await prisma.subscription.upsert({
      where: { tenantId: tenant.id },
      create: {
        tenantId: tenant.id,
        planId: proPlan.id,
        status: 'TRIAL',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
      update: {},
    });
    console.log(`✓ Subscription TRIAL PRO pour le tenant demo`);
  }

  // Admin
  const adminEmail = 'admin@lnaycrm.com';
  const existing = await prisma.user.findFirst({ where: { tenantId: tenant.id, email: adminEmail } });

  if (!existing) {
    const admin = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: adminEmail,
        password: await bcrypt.hash('Admin1234!', 12),
        firstName: 'Super',
        lastName: 'Admin',
        role: Role.ADMIN,
      },
    });
    console.log(`✓ Admin créé: ${admin.email}`);
  } else {
    console.log(`✓ Admin déjà existant: ${adminEmail}`);
  }

  // Manager de démo
  const managerEmail = 'manager@lnaycrm.com';
  const existingManager = await prisma.user.findFirst({ where: { tenantId: tenant.id, email: managerEmail } });
  if (!existingManager) {
    await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: managerEmail,
        password: await bcrypt.hash('Manager1234!', 12),
        firstName: 'Marie',
        lastName: 'Martin',
        role: Role.MANAGER,
      },
    });
    console.log(`✓ Manager créé: ${managerEmail}`);
  }

  // Agent de démo
  const agentEmail = 'agent@lnaycrm.com';
  const existingAgent = await prisma.user.findFirst({ where: { tenantId: tenant.id, email: agentEmail } });
  if (!existingAgent) {
    await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: agentEmail,
        password: await bcrypt.hash('Agent1234!', 12),
        firstName: 'Jean',
        lastName: 'Dupont',
        role: Role.AGENT,
      },
    });
    console.log(`✓ Agent créé: ${agentEmail}`);
  }

  // Quality
  const qualityEmail = 'quality@lnaycrm.com';
  if (!await prisma.user.findFirst({ where: { tenantId: tenant.id, email: qualityEmail } })) {
    await prisma.user.create({
      data: { tenantId: tenant.id, email: qualityEmail, password: await bcrypt.hash('Quality1234!', 12), firstName: 'Alice', lastName: 'Dubois', role: Role.QUALITY },
    });
    console.log(`✓ Quality créé: ${qualityEmail}`);
  } else { console.log(`✓ Quality déjà existant: ${qualityEmail}`); }

  // Quality Supervisor
  const qsEmail = 'qa-sup@lnaycrm.com';
  if (!await prisma.user.findFirst({ where: { tenantId: tenant.id, email: qsEmail } })) {
    await prisma.user.create({
      data: { tenantId: tenant.id, email: qsEmail, password: await bcrypt.hash('QaSup1234!', 12), firstName: 'Paul', lastName: 'Leclerc', role: Role.QUALITY_SUPERVISOR },
    });
    console.log(`✓ Quality Supervisor créé: ${qsEmail}`);
  } else { console.log(`✓ Quality Supervisor déjà existant: ${qsEmail}`); }

  // HR
  const hrEmail = 'hr@lnaycrm.com';
  if (!await prisma.user.findFirst({ where: { tenantId: tenant.id, email: hrEmail } })) {
    await prisma.user.create({
      data: { tenantId: tenant.id, email: hrEmail, password: await bcrypt.hash('Hr1234!', 12), firstName: 'Lucie', lastName: 'Renard', role: Role.HR },
    });
    console.log(`✓ HR créé: ${hrEmail}`);
  } else { console.log(`✓ HR déjà existant: ${hrEmail}`); }

  // Quelques clients de démo
  const clientsCount = await prisma.client.count({ where: { tenantId: tenant.id } });
  if (clientsCount === 0) {
    await prisma.client.createMany({
      data: [
        { tenantId: tenant.id, firstName: 'Pierre', lastName: 'Bernard', phone: '+33612345678', email: 'pierre@acme.fr', company: 'Acme Corp', status: 'PROSPECT' },
        { tenantId: tenant.id, firstName: 'Sophie', lastName: 'Laurent', phone: '+33698765432', email: 'sophie@globex.fr', company: 'Globex', status: 'ACTIVE' },
        { tenantId: tenant.id, firstName: 'Marc', lastName: 'Petit', phone: '+33611223344', company: 'Initech', status: 'ACTIVE' },
        { tenantId: tenant.id, firstName: 'Claire', lastName: 'Moreau', phone: '+33677889900', status: 'INACTIVE' },
        { tenantId: tenant.id, firstName: 'Luc', lastName: 'Simon', phone: '+33655443322', email: 'luc@umbrella.fr', company: 'Umbrella', status: 'DNC' },
      ],
    });
    console.log('✓ 5 clients de démo créés');
  }

  console.log('\n✅ Seed terminé !');
  console.log('─────────────────────────────────────');
  console.log('  admin@lnaycrm.com   / Admin1234!');
  console.log('  manager@lnaycrm.com / Manager1234!');
  console.log('  agent@lnaycrm.com   / Agent1234!');
  console.log('─────────────────────────────────────');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
