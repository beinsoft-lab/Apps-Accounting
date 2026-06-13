import { PrismaClient, AccountCategory, NormalBalance } from '@prisma/client'

const prisma = new PrismaClient()

const defaultAccounts = [
  // ASSET
  { code: '1000', name: 'Aset', category: AccountCategory.ASSET, normalBalance: NormalBalance.DEBIT, parentId: null },
  { code: '1100', name: 'Kas', category: AccountCategory.ASSET, normalBalance: NormalBalance.DEBIT, parentCode: '1000' },
  { code: '1200', name: 'Bank', category: AccountCategory.ASSET, normalBalance: NormalBalance.DEBIT, parentCode: '1000' },
  { code: '1300', name: 'Piutang Usaha', category: AccountCategory.ASSET, normalBalance: NormalBalance.DEBIT, parentCode: '1000' },
  { code: '1400', name: 'Persediaan Barang', category: AccountCategory.ASSET, normalBalance: NormalBalance.DEBIT, parentCode: '1000' },
  { code: '1500', name: 'Aset Tetap', category: AccountCategory.ASSET, normalBalance: NormalBalance.DEBIT, parentCode: '1000' },
  // LIABILITY
  { code: '2000', name: 'Kewajiban', category: AccountCategory.LIABILITY, normalBalance: NormalBalance.CREDIT, parentId: null },
  { code: '2100', name: 'Hutang Usaha', category: AccountCategory.LIABILITY, normalBalance: NormalBalance.CREDIT, parentCode: '2000' },
  { code: '2200', name: 'Hutang Lain-Lain', category: AccountCategory.LIABILITY, normalBalance: NormalBalance.CREDIT, parentCode: '2000' },
  { code: '2300', name: 'Hutang Pajak', category: AccountCategory.LIABILITY, normalBalance: NormalBalance.CREDIT, parentCode: '2000' },
  // EQUITY
  { code: '3000', name: 'Modal', category: AccountCategory.EQUITY, normalBalance: NormalBalance.CREDIT, parentId: null },
  { code: '3100', name: 'Modal Pemilik', category: AccountCategory.EQUITY, normalBalance: NormalBalance.CREDIT, parentCode: '3000' },
  { code: '3200', name: 'Laba Ditahan', category: AccountCategory.EQUITY, normalBalance: NormalBalance.CREDIT, parentCode: '3000' },
  // REVENUE
  { code: '4000', name: 'Pendapatan', category: AccountCategory.REVENUE, normalBalance: NormalBalance.CREDIT, parentId: null },
  { code: '4100', name: 'Pendapatan Penjualan', category: AccountCategory.REVENUE, normalBalance: NormalBalance.CREDIT, parentCode: '4000' },
  { code: '4200', name: 'Pendapatan Jasa', category: AccountCategory.REVENUE, normalBalance: NormalBalance.CREDIT, parentCode: '4000' },
  { code: '4900', name: 'Pendapatan Lain-Lain', category: AccountCategory.REVENUE, normalBalance: NormalBalance.CREDIT, parentCode: '4000' },
  // EXPENSE
  { code: '5000', name: 'Beban', category: AccountCategory.EXPENSE, normalBalance: NormalBalance.DEBIT, parentId: null },
  { code: '5100', name: 'Beban Gaji & Tunjangan', category: AccountCategory.EXPENSE, normalBalance: NormalBalance.DEBIT, parentCode: '5000' },
  { code: '5200', name: 'Beban Operasional', category: AccountCategory.EXPENSE, normalBalance: NormalBalance.DEBIT, parentCode: '5000' },
  { code: '5300', name: 'Beban Sewa', category: AccountCategory.EXPENSE, normalBalance: NormalBalance.DEBIT, parentCode: '5000' },
  { code: '5400', name: 'Beban Utilitas', category: AccountCategory.EXPENSE, normalBalance: NormalBalance.DEBIT, parentCode: '5000' },
  { code: '5500', name: 'Beban Penyusutan', category: AccountCategory.EXPENSE, normalBalance: NormalBalance.DEBIT, parentCode: '5000' },
  { code: '5900', name: 'Beban Lain-Lain', category: AccountCategory.EXPENSE, normalBalance: NormalBalance.DEBIT, parentCode: '5000' },
]

const defaultRoles = [
  { name: 'super_admin' },
  { name: 'owner' },
  { name: 'accountant' },
  { name: 'operator' },
  { name: 'viewer' },
]

async function main() {
  console.log('🌱 Starting seed...')

  // Seed Roles
  console.log('📌 Seeding roles...')
  for (const role of defaultRoles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {},
      create: role,
    })
  }

  // Seed Super Admin user
  const superAdminRole = await prisma.role.findUnique({ where: { name: 'super_admin' } })
  if (superAdminRole) {
    await prisma.user.upsert({
      where: { email: 'admin@beinsoft.com' },
      update: {},
      create: {
        name: 'Super Admin',
        email: 'admin@beinsoft.com',
        password: '$2b$10$PLACEHOLDER_BCRYPT_HASH', // In production, hash properly
        roleId: superAdminRole.id,
      },
    })
  }

  // Seed COA (parent accounts first, then children)
  console.log('📌 Seeding Chart of Accounts...')
  const parentAccounts = defaultAccounts.filter(a => !('parentCode' in a) || a.parentCode === undefined)
  const childAccounts = defaultAccounts.filter(a => 'parentCode' in a && a.parentCode !== undefined)

  // Create parents first
  for (const acc of parentAccounts) {
    await prisma.account.upsert({
      where: { code: acc.code },
      update: { name: acc.name },
      create: {
        code: acc.code,
        name: acc.name,
        category: acc.category,
        normalBalance: acc.normalBalance,
        parentId: null,
      },
    })
  }

  // Create children
  for (const acc of childAccounts) {
    const parent = await prisma.account.findUnique({ where: { code: (acc as any).parentCode } })
    await prisma.account.upsert({
      where: { code: acc.code },
      update: { name: acc.name },
      create: {
        code: acc.code,
        name: acc.name,
        category: acc.category,
        normalBalance: acc.normalBalance,
        parentId: parent?.id ?? null,
      },
    })
  }

  console.log('✅ Seed completed successfully!')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
