'use strict'

const { PrismaClient } = require('@prisma/client')
const { Decimal } = require('@prisma/client/runtime/library')

const prisma = new PrismaClient()
const D = (n) => new Decimal(n)
const ZERO = new Decimal(0)

async function getAccId(code) {
  const a = await prisma.account.findUniqueOrThrow({ where: { code } })
  return a.id
}

async function createPostedJournal(num, date, desc, entries, userId, ref) {
  const j = await prisma.journal.create({
    data: {
      journalNumber: num, transactionDate: date, description: desc,
      referenceNumber: ref ?? null, status: 'POSTED', createdById: userId,
      entries: { create: entries.map(e => ({ accountId: e.accountId, debit: D(e.debit), credit: D(e.credit) })) },
    },
    include: { entries: true },
  })
  for (const e of j.entries) {
    await prisma.generalLedger.create({
      data: {
        accountId: e.accountId, journalId: j.id, journalEntryId: e.id,
        transactionDate: date, description: desc,
        debit: e.debit, credit: e.credit, runningBalance: ZERO,
      },
    })
  }
  return j
}

const COA = [
  { code: '1000', name: 'Aset',                  cat: 'ASSET',    nb: 'DEBIT',  parent: null },
  { code: '1100', name: 'Kas',                    cat: 'ASSET',    nb: 'DEBIT',  parent: '1000' },
  { code: '1200', name: 'Bank',                   cat: 'ASSET',    nb: 'DEBIT',  parent: '1000' },
  { code: '1300', name: 'Piutang Usaha',          cat: 'ASSET',    nb: 'DEBIT',  parent: '1000' },
  { code: '1400', name: 'Persediaan Barang',      cat: 'ASSET',    nb: 'DEBIT',  parent: '1000' },
  { code: '1500', name: 'Aset Tetap',             cat: 'ASSET',    nb: 'DEBIT',  parent: '1000' },
  { code: '2000', name: 'Kewajiban',              cat: 'LIABILITY', nb: 'CREDIT', parent: null },
  { code: '2100', name: 'Hutang Usaha',           cat: 'LIABILITY', nb: 'CREDIT', parent: '2000' },
  { code: '2200', name: 'Hutang Lain-Lain',       cat: 'LIABILITY', nb: 'CREDIT', parent: '2000' },
  { code: '2300', name: 'Hutang Pajak',           cat: 'LIABILITY', nb: 'CREDIT', parent: '2000' },
  { code: '3000', name: 'Modal',                  cat: 'EQUITY',   nb: 'CREDIT', parent: null },
  { code: '3100', name: 'Modal Pemilik',          cat: 'EQUITY',   nb: 'CREDIT', parent: '3000' },
  { code: '3200', name: 'Laba Ditahan',           cat: 'EQUITY',   nb: 'CREDIT', parent: '3000' },
  { code: '4000', name: 'Pendapatan',             cat: 'REVENUE',  nb: 'CREDIT', parent: null },
  { code: '4100', name: 'Pendapatan Penjualan',   cat: 'REVENUE',  nb: 'CREDIT', parent: '4000' },
  { code: '4200', name: 'Pendapatan Jasa',        cat: 'REVENUE',  nb: 'CREDIT', parent: '4000' },
  { code: '4900', name: 'Pendapatan Lain-Lain',   cat: 'REVENUE',  nb: 'CREDIT', parent: '4000' },
  { code: '5000', name: 'Beban',                  cat: 'EXPENSE',  nb: 'DEBIT',  parent: null },
  { code: '5100', name: 'Beban Gaji & Tunjangan', cat: 'EXPENSE',  nb: 'DEBIT',  parent: '5000' },
  { code: '5200', name: 'Beban Operasional',      cat: 'EXPENSE',  nb: 'DEBIT',  parent: '5000' },
  { code: '5300', name: 'Beban Sewa',             cat: 'EXPENSE',  nb: 'DEBIT',  parent: '5000' },
  { code: '5400', name: 'Beban Utilitas',         cat: 'EXPENSE',  nb: 'DEBIT',  parent: '5000' },
  { code: '5500', name: 'Beban Penyusutan',       cat: 'EXPENSE',  nb: 'DEBIT',  parent: '5000' },
  { code: '5900', name: 'Beban Lain-Lain',        cat: 'EXPENSE',  nb: 'DEBIT',  parent: '5000' },
]

async function main() {
  console.log('🌱 Starting seed...')

  for (const name of ['super_admin', 'owner', 'accountant', 'operator', 'viewer']) {
    await prisma.role.upsert({ where: { name }, update: {}, create: { name } })
  }

  const role = await prisma.role.findUniqueOrThrow({ where: { name: 'super_admin' } })
  const admin = await prisma.user.upsert({
    where: { email: 'admin@beinsoft.com' },
    update: {},
    create: { name: 'Super Admin', email: 'admin@beinsoft.com', password: 'mock-no-auth', roleId: role.id },
  })
  const uid = admin.id

  console.log('📌 Seeding COA...')
  for (const a of COA.filter(x => !x.parent)) {
    await prisma.account.upsert({
      where: { code: a.code }, update: { name: a.name },
      create: { code: a.code, name: a.name, category: a.cat, normalBalance: a.nb, parentId: null },
    })
  }
  for (const a of COA.filter(x => x.parent)) {
    const p = await prisma.account.findUniqueOrThrow({ where: { code: a.parent } })
    await prisma.account.upsert({
      where: { code: a.code }, update: { name: a.name },
      create: { code: a.code, name: a.name, category: a.cat, normalBalance: a.nb, parentId: p.id },
    })
  }

  const existing = await prisma.journal.findFirst({ where: { journalNumber: 'JU-2026-0001' } })
  if (existing) { console.log('⚠️  Transactions already seeded. Skipping.'); return }

  const A = {
    kas:     await getAccId('1100'),
    bank:    await getAccId('1200'),
    piutang: await getAccId('1300'),
    hutang:  await getAccId('2100'),
    modal:   await getAccId('3100'),
    jasa:    await getAccId('4200'),
    gaji:    await getAccId('5100'),
    ops:     await getAccId('5200'),
    sewa:    await getAccId('5300'),
  }

  console.log('📌 Seeding transactions Jan–Jun 2026...')

  // ── JANUARY ──────────────────────────────────────────────────────────────

  const j01 = await createPostedJournal('JU-2026-0001', new Date('2026-01-02'), 'Setoran modal awal pemilik', [
    { accountId: A.bank,  debit: 200000000, credit: 0 },
    { accountId: A.modal, debit: 0, credit: 200000000 },
  ], uid)
  await prisma.cashTransaction.create({ data: {
    transactionNumber: 'KM-20260102-0001', type: 'IN', transactionDate: new Date('2026-01-02'),
    amount: D(200000000), cashAccountId: A.bank, counterpartAccountId: A.modal,
    description: 'Setoran modal awal pemilik', partyName: 'Pemilik',
    journalId: j01.id, createdById: uid,
  }})

  const j02 = await createPostedJournal('JU-2026-0002', new Date('2026-01-15'), 'Pendapatan jasa IT konsultasi - Proyek Alpha', [
    { accountId: A.bank, debit: 45000000, credit: 0 },
    { accountId: A.jasa, debit: 0, credit: 45000000 },
  ], uid, 'INV-ALPHA-001')
  await prisma.cashTransaction.create({ data: {
    transactionNumber: 'KM-20260115-0001', type: 'IN', transactionDate: new Date('2026-01-15'),
    amount: D(45000000), cashAccountId: A.bank, counterpartAccountId: A.jasa,
    description: 'Pendapatan jasa IT konsultasi - Proyek Alpha', referenceNumber: 'INV-ALPHA-001',
    partyName: 'PT Sinergi Digital', journalId: j02.id, createdById: uid,
  }})

  const j03 = await createPostedJournal('JU-2026-0003', new Date('2026-01-05'), 'Sewa kantor Januari 2026', [
    { accountId: A.sewa, debit: 6500000, credit: 0 },
    { accountId: A.bank, debit: 0, credit: 6500000 },
  ], uid)
  await prisma.cashTransaction.create({ data: {
    transactionNumber: 'KK-20260105-0001', type: 'OUT', transactionDate: new Date('2026-01-05'),
    amount: D(6500000), cashAccountId: A.bank, counterpartAccountId: A.sewa,
    description: 'Sewa kantor Januari 2026', partyName: 'PT Properti Sentosa',
    journalId: j03.id, createdById: uid,
  }})

  const j04 = await createPostedJournal('JU-2026-0004', new Date('2026-01-20'), 'Biaya operasional kantor Januari 2026', [
    { accountId: A.ops, debit: 3200000, credit: 0 },
    { accountId: A.kas, debit: 0, credit: 3200000 },
  ], uid)
  await prisma.cashTransaction.create({ data: {
    transactionNumber: 'KK-20260120-0001', type: 'OUT', transactionDate: new Date('2026-01-20'),
    amount: D(3200000), cashAccountId: A.kas, counterpartAccountId: A.ops,
    description: 'Biaya operasional kantor Januari 2026', journalId: j04.id, createdById: uid,
  }})

  const j05 = await createPostedJournal('JU-2026-0005', new Date('2026-01-25'), 'Gaji karyawan Januari 2026', [
    { accountId: A.gaji, debit: 18000000, credit: 0 },
    { accountId: A.bank, debit: 0, credit: 18000000 },
  ], uid)
  await prisma.cashTransaction.create({ data: {
    transactionNumber: 'KK-20260125-0001', type: 'OUT', transactionDate: new Date('2026-01-25'),
    amount: D(18000000), cashAccountId: A.bank, counterpartAccountId: A.gaji,
    description: 'Gaji karyawan Januari 2026', partyName: 'Karyawan',
    journalId: j05.id, createdById: uid,
  }})

  const j06 = await createPostedJournal('JU-2026-0006', new Date('2026-01-28'), 'Piutang jasa pengembangan sistem - PT Maju Digital', [
    { accountId: A.piutang, debit: 35000000, credit: 0 },
    { accountId: A.jasa,    debit: 0, credit: 35000000 },
  ], uid, 'INV-MAJU-001')
  const recMaju = await prisma.receivable.create({ data: {
    receivableNumber: 'PR-20260128-0001', customerName: 'PT Maju Digital',
    description: 'Jasa pengembangan sistem manajemen inventori', referenceNumber: 'INV-MAJU-001',
    amount: D(35000000), paidAmount: D(0), remainingAmount: D(35000000),
    dueDate: new Date('2026-02-28'), status: 'OPEN',
    receivableAccountId: A.piutang, journalId: j06.id, createdById: uid,
  }})

  // ── FEBRUARY ─────────────────────────────────────────────────────────────

  const j07 = await createPostedJournal('JU-2026-0007', new Date('2026-02-10'), 'Pendapatan jasa IT - Proyek Beta', [
    { accountId: A.bank, debit: 52000000, credit: 0 },
    { accountId: A.jasa, debit: 0, credit: 52000000 },
  ], uid, 'INV-BETA-001')
  await prisma.cashTransaction.create({ data: {
    transactionNumber: 'KM-20260210-0001', type: 'IN', transactionDate: new Date('2026-02-10'),
    amount: D(52000000), cashAccountId: A.bank, counterpartAccountId: A.jasa,
    description: 'Pendapatan jasa IT - Proyek Beta', referenceNumber: 'INV-BETA-001',
    partyName: 'CV Kreatif Teknologi', journalId: j07.id, createdById: uid,
  }})

  const j08 = await createPostedJournal('JU-2026-0008', new Date('2026-02-05'), 'Sewa kantor Februari 2026', [
    { accountId: A.sewa, debit: 6500000, credit: 0 },
    { accountId: A.bank, debit: 0, credit: 6500000 },
  ], uid)
  await prisma.cashTransaction.create({ data: {
    transactionNumber: 'KK-20260205-0001', type: 'OUT', transactionDate: new Date('2026-02-05'),
    amount: D(6500000), cashAccountId: A.bank, counterpartAccountId: A.sewa,
    description: 'Sewa kantor Februari 2026', partyName: 'PT Properti Sentosa',
    journalId: j08.id, createdById: uid,
  }})

  const j09 = await createPostedJournal('JU-2026-0009', new Date('2026-02-15'), 'Pembayaran sebagian piutang PT Maju Digital', [
    { accountId: A.bank,    debit: 20000000, credit: 0 },
    { accountId: A.piutang, debit: 0, credit: 20000000 },
  ], uid)
  await prisma.receivablePayment.create({ data: {
    receivableId: recMaju.id, paymentDate: new Date('2026-02-15'),
    amount: D(20000000), cashAccountId: A.bank,
    description: 'Pembayaran sebagian piutang', journalId: j09.id,
  }})
  await prisma.receivable.update({ where: { id: recMaju.id },
    data: { paidAmount: D(20000000), remainingAmount: D(15000000), status: 'PARTIAL' } })

  const j10 = await createPostedJournal('JU-2026-0010', new Date('2026-02-25'), 'Gaji karyawan Februari 2026', [
    { accountId: A.gaji, debit: 18000000, credit: 0 },
    { accountId: A.bank, debit: 0, credit: 18000000 },
  ], uid)
  await prisma.cashTransaction.create({ data: {
    transactionNumber: 'KK-20260225-0001', type: 'OUT', transactionDate: new Date('2026-02-25'),
    amount: D(18000000), cashAccountId: A.bank, counterpartAccountId: A.gaji,
    description: 'Gaji karyawan Februari 2026', partyName: 'Karyawan',
    journalId: j10.id, createdById: uid,
  }})

  const j11 = await createPostedJournal('JU-2026-0011', new Date('2026-02-20'), 'Piutang jasa desain sistem - CV Inovasi Nusantara', [
    { accountId: A.piutang, debit: 28000000, credit: 0 },
    { accountId: A.jasa,    debit: 0, credit: 28000000 },
  ], uid, 'INV-INOV-001')
  await prisma.receivable.create({ data: {
    receivableNumber: 'PR-20260220-0001', customerName: 'CV Inovasi Nusantara',
    description: 'Jasa desain dan implementasi sistem', referenceNumber: 'INV-INOV-001',
    amount: D(28000000), paidAmount: D(0), remainingAmount: D(28000000),
    dueDate: new Date('2026-03-20'), status: 'OPEN',
    receivableAccountId: A.piutang, journalId: j11.id, createdById: uid,
  }})

  // ── MARCH ────────────────────────────────────────────────────────────────

  const j12 = await createPostedJournal('JU-2026-0012', new Date('2026-03-12'), 'Pendapatan jasa IT - Proyek Gamma', [
    { accountId: A.bank, debit: 38000000, credit: 0 },
    { accountId: A.jasa, debit: 0, credit: 38000000 },
  ], uid)
  await prisma.cashTransaction.create({ data: {
    transactionNumber: 'KM-20260312-0001', type: 'IN', transactionDate: new Date('2026-03-12'),
    amount: D(38000000), cashAccountId: A.bank, counterpartAccountId: A.jasa,
    description: 'Pendapatan jasa IT - Proyek Gamma', partyName: 'PT Andalan Solusi',
    journalId: j12.id, createdById: uid,
  }})

  const j13 = await createPostedJournal('JU-2026-0013', new Date('2026-03-05'), 'Sewa kantor Maret 2026', [
    { accountId: A.sewa, debit: 6500000, credit: 0 },
    { accountId: A.bank, debit: 0, credit: 6500000 },
  ], uid)
  await prisma.cashTransaction.create({ data: {
    transactionNumber: 'KK-20260305-0001', type: 'OUT', transactionDate: new Date('2026-03-05'),
    amount: D(6500000), cashAccountId: A.bank, counterpartAccountId: A.sewa,
    description: 'Sewa kantor Maret 2026', partyName: 'PT Properti Sentosa',
    journalId: j13.id, createdById: uid,
  }})

  const j14 = await createPostedJournal('JU-2026-0014', new Date('2026-03-25'), 'Gaji karyawan Maret 2026', [
    { accountId: A.gaji, debit: 18000000, credit: 0 },
    { accountId: A.bank, debit: 0, credit: 18000000 },
  ], uid)
  await prisma.cashTransaction.create({ data: {
    transactionNumber: 'KK-20260325-0001', type: 'OUT', transactionDate: new Date('2026-03-25'),
    amount: D(18000000), cashAccountId: A.bank, counterpartAccountId: A.gaji,
    description: 'Gaji karyawan Maret 2026', partyName: 'Karyawan',
    journalId: j14.id, createdById: uid,
  }})

  const j15 = await createPostedJournal('JU-2026-0015', new Date('2026-03-15'), 'Pembelian peralatan IT kredit - Komputer Jaya', [
    { accountId: A.ops,    debit: 15000000, credit: 0 },
    { accountId: A.hutang, debit: 0, credit: 15000000 },
  ], uid, 'PO-KJ-001')
  const payKJ = await prisma.payable.create({ data: {
    payableNumber: 'HP-20260315-0001', vendorName: 'Supplier Komputer Jaya',
    description: 'Pembelian laptop dan peralatan IT operasional', referenceNumber: 'PO-KJ-001',
    amount: D(15000000), paidAmount: D(0), remainingAmount: D(15000000),
    dueDate: new Date('2026-04-15'), status: 'OPEN',
    payableAccountId: A.hutang, journalId: j15.id, createdById: uid,
  }})

  // ── APRIL ────────────────────────────────────────────────────────────────

  const j16 = await createPostedJournal('JU-2026-0016', new Date('2026-04-08'), 'Pendapatan jasa IT - Proyek Delta', [
    { accountId: A.bank, debit: 60000000, credit: 0 },
    { accountId: A.jasa, debit: 0, credit: 60000000 },
  ], uid)
  await prisma.cashTransaction.create({ data: {
    transactionNumber: 'KM-20260408-0001', type: 'IN', transactionDate: new Date('2026-04-08'),
    amount: D(60000000), cashAccountId: A.bank, counterpartAccountId: A.jasa,
    description: 'Pendapatan jasa IT - Proyek Delta', partyName: 'PT Global Inovasi',
    journalId: j16.id, createdById: uid,
  }})

  const j17 = await createPostedJournal('JU-2026-0017', new Date('2026-04-05'), 'Sewa kantor April 2026', [
    { accountId: A.sewa, debit: 6500000, credit: 0 },
    { accountId: A.bank, debit: 0, credit: 6500000 },
  ], uid)
  await prisma.cashTransaction.create({ data: {
    transactionNumber: 'KK-20260405-0001', type: 'OUT', transactionDate: new Date('2026-04-05'),
    amount: D(6500000), cashAccountId: A.bank, counterpartAccountId: A.sewa,
    description: 'Sewa kantor April 2026', partyName: 'PT Properti Sentosa',
    journalId: j17.id, createdById: uid,
  }})

  const j18 = await createPostedJournal('JU-2026-0018', new Date('2026-04-10'), 'Pelunasan piutang PT Maju Digital', [
    { accountId: A.bank,    debit: 15000000, credit: 0 },
    { accountId: A.piutang, debit: 0, credit: 15000000 },
  ], uid)
  await prisma.receivablePayment.create({ data: {
    receivableId: recMaju.id, paymentDate: new Date('2026-04-10'),
    amount: D(15000000), cashAccountId: A.bank,
    description: 'Pelunasan piutang', journalId: j18.id,
  }})
  await prisma.receivable.update({ where: { id: recMaju.id },
    data: { paidAmount: D(35000000), remainingAmount: D(0), status: 'PAID' } })

  const j19 = await createPostedJournal('JU-2026-0019', new Date('2026-04-12'), 'Pembayaran hutang peralatan IT - Komputer Jaya', [
    { accountId: A.hutang, debit: 15000000, credit: 0 },
    { accountId: A.bank,   debit: 0, credit: 15000000 },
  ], uid)
  await prisma.payablePayment.create({ data: {
    payableId: payKJ.id, paymentDate: new Date('2026-04-12'),
    amount: D(15000000), cashAccountId: A.bank,
    description: 'Pelunasan hutang peralatan', journalId: j19.id,
  }})
  await prisma.payable.update({ where: { id: payKJ.id },
    data: { paidAmount: D(15000000), remainingAmount: D(0), status: 'PAID' } })

  const j20 = await createPostedJournal('JU-2026-0020', new Date('2026-04-25'), 'Gaji karyawan April 2026', [
    { accountId: A.gaji, debit: 18000000, credit: 0 },
    { accountId: A.bank, debit: 0, credit: 18000000 },
  ], uid)
  await prisma.cashTransaction.create({ data: {
    transactionNumber: 'KK-20260425-0001', type: 'OUT', transactionDate: new Date('2026-04-25'),
    amount: D(18000000), cashAccountId: A.bank, counterpartAccountId: A.gaji,
    description: 'Gaji karyawan April 2026', partyName: 'Karyawan',
    journalId: j20.id, createdById: uid,
  }})

  // ── MAY ──────────────────────────────────────────────────────────────────

  const j21 = await createPostedJournal('JU-2026-0021', new Date('2026-05-14'), 'Pendapatan jasa IT - Proyek Epsilon', [
    { accountId: A.bank, debit: 55000000, credit: 0 },
    { accountId: A.jasa, debit: 0, credit: 55000000 },
  ], uid)
  await prisma.cashTransaction.create({ data: {
    transactionNumber: 'KM-20260514-0001', type: 'IN', transactionDate: new Date('2026-05-14'),
    amount: D(55000000), cashAccountId: A.bank, counterpartAccountId: A.jasa,
    description: 'Pendapatan jasa IT - Proyek Epsilon', partyName: 'PT Nusantara Digital',
    journalId: j21.id, createdById: uid,
  }})

  const j22 = await createPostedJournal('JU-2026-0022', new Date('2026-05-05'), 'Sewa kantor Mei 2026', [
    { accountId: A.sewa, debit: 6500000, credit: 0 },
    { accountId: A.bank, debit: 0, credit: 6500000 },
  ], uid)
  await prisma.cashTransaction.create({ data: {
    transactionNumber: 'KK-20260505-0001', type: 'OUT', transactionDate: new Date('2026-05-05'),
    amount: D(6500000), cashAccountId: A.bank, counterpartAccountId: A.sewa,
    description: 'Sewa kantor Mei 2026', partyName: 'PT Properti Sentosa',
    journalId: j22.id, createdById: uid,
  }})

  const j23 = await createPostedJournal('JU-2026-0023', new Date('2026-05-25'), 'Gaji karyawan Mei 2026', [
    { accountId: A.gaji, debit: 20000000, credit: 0 },
    { accountId: A.bank, debit: 0, credit: 20000000 },
  ], uid)
  await prisma.cashTransaction.create({ data: {
    transactionNumber: 'KK-20260525-0001', type: 'OUT', transactionDate: new Date('2026-05-25'),
    amount: D(20000000), cashAccountId: A.bank, counterpartAccountId: A.gaji,
    description: 'Gaji karyawan Mei 2026', partyName: 'Karyawan',
    journalId: j23.id, createdById: uid,
  }})

  const j24 = await createPostedJournal('JU-2026-0024', new Date('2026-05-20'), 'Piutang jasa cloud migration - PT Teknologi Maju', [
    { accountId: A.piutang, debit: 40000000, credit: 0 },
    { accountId: A.jasa,    debit: 0, credit: 40000000 },
  ], uid, 'INV-TM-001')
  await prisma.receivable.create({ data: {
    receivableNumber: 'PR-20260520-0001', customerName: 'PT Teknologi Maju',
    description: 'Jasa migrasi sistem ke cloud infrastructure', referenceNumber: 'INV-TM-001',
    amount: D(40000000), paidAmount: D(0), remainingAmount: D(40000000),
    dueDate: new Date('2026-06-20'), status: 'OPEN',
    receivableAccountId: A.piutang, journalId: j24.id, createdById: uid,
  }})

  // ── JUNE ─────────────────────────────────────────────────────────────────

  const j25 = await createPostedJournal('JU-2026-0025', new Date('2026-06-10'), 'Pendapatan jasa IT - Proyek Zeta', [
    { accountId: A.bank, debit: 42000000, credit: 0 },
    { accountId: A.jasa, debit: 0, credit: 42000000 },
  ], uid)
  await prisma.cashTransaction.create({ data: {
    transactionNumber: 'KM-20260610-0001', type: 'IN', transactionDate: new Date('2026-06-10'),
    amount: D(42000000), cashAccountId: A.bank, counterpartAccountId: A.jasa,
    description: 'Pendapatan jasa IT - Proyek Zeta', partyName: 'CV Mitra Solusi',
    journalId: j25.id, createdById: uid,
  }})

  const j26 = await createPostedJournal('JU-2026-0026', new Date('2026-06-05'), 'Sewa kantor Juni 2026', [
    { accountId: A.sewa, debit: 6500000, credit: 0 },
    { accountId: A.bank, debit: 0, credit: 6500000 },
  ], uid)
  await prisma.cashTransaction.create({ data: {
    transactionNumber: 'KK-20260605-0001', type: 'OUT', transactionDate: new Date('2026-06-05'),
    amount: D(6500000), cashAccountId: A.bank, counterpartAccountId: A.sewa,
    description: 'Sewa kantor Juni 2026', partyName: 'PT Properti Sentosa',
    journalId: j26.id, createdById: uid,
  }})

  const j27 = await createPostedJournal('JU-2026-0027', new Date('2026-06-15'), 'Biaya operasional Juni 2026', [
    { accountId: A.ops, debit: 4500000, credit: 0 },
    { accountId: A.kas, debit: 0, credit: 4500000 },
  ], uid)
  await prisma.cashTransaction.create({ data: {
    transactionNumber: 'KK-20260615-0001', type: 'OUT', transactionDate: new Date('2026-06-15'),
    amount: D(4500000), cashAccountId: A.kas, counterpartAccountId: A.ops,
    description: 'Biaya operasional Juni 2026', journalId: j27.id, createdById: uid,
  }})

  const j28 = await createPostedJournal('JU-2026-0028', new Date('2026-06-20'), 'Gaji karyawan Juni 2026', [
    { accountId: A.gaji, debit: 20000000, credit: 0 },
    { accountId: A.bank, debit: 0, credit: 20000000 },
  ], uid)
  await prisma.cashTransaction.create({ data: {
    transactionNumber: 'KK-20260620-0001', type: 'OUT', transactionDate: new Date('2026-06-20'),
    amount: D(20000000), cashAccountId: A.bank, counterpartAccountId: A.gaji,
    description: 'Gaji karyawan Juni 2026', partyName: 'Karyawan',
    journalId: j28.id, createdById: uid,
  }})

  // ── INVOICES ─────────────────────────────────────────────────────────────
  console.log('📌 Seeding invoices...')

  await prisma.invoice.create({ data: {
    invoiceNumber: 'INV-20260510-0001', customerName: 'PT Sinergi Indonesia',
    customerEmail: 'finance@sinergi.co.id', customerPhone: '021-55667788',
    invoiceDate: new Date('2026-05-10'), dueDate: new Date('2026-06-10'),
    notes: 'Jasa pengembangan aplikasi mobile',
    taxRate: D(11), subtotal: D(33000000), taxAmount: D(3630000),
    totalAmount: D(36630000), paidAmount: D(0), remainingAmount: D(36630000),
    status: 'SENT', receivableAccountId: A.piutang, revenueAccountId: A.jasa,
    createdById: uid,
    items: { create: [
      { description: 'Pengembangan aplikasi mobile Android', quantity: D(1), unitPrice: D(20000000), amount: D(20000000) },
      { description: 'Pengembangan aplikasi mobile iOS',     quantity: D(1), unitPrice: D(13000000), amount: D(13000000) },
    ]},
  }})

  await prisma.invoice.create({ data: {
    invoiceNumber: 'INV-20260615-0001', customerName: 'CV Digital Kreatif',
    customerEmail: 'admin@digitalkreatif.com',
    invoiceDate: new Date('2026-06-15'), dueDate: new Date('2026-07-15'),
    notes: 'Jasa konsultasi dan desain UI/UX',
    taxRate: D(11), subtotal: D(18000000), taxAmount: D(1980000),
    totalAmount: D(19980000), paidAmount: D(0), remainingAmount: D(19980000),
    status: 'DRAFT', receivableAccountId: A.piutang, revenueAccountId: A.jasa,
    createdById: uid,
    items: { create: [
      { description: 'Konsultasi strategi digital (10 sesi)', quantity: D(10), unitPrice: D(1000000), amount: D(10000000) },
      { description: 'Desain UI/UX aplikasi web',             quantity: D(1),  unitPrice: D(8000000), amount: D(8000000) },
    ]},
  }})

  console.log('')
  console.log('✅ Seed complete!')
  console.log('   Journals : 28 (all POSTED)')
  console.log('   Cash IN  : 7 transaksi')
  console.log('   Cash OUT : 14 transaksi')
  console.log('   Piutang  : 3 (1 PAID, 1 OPEN overdue, 1 OPEN)')
  console.log('   Hutang   : 1 (PAID)')
  console.log('   Invoice  : 2 (1 SENT, 1 DRAFT)')
}

main()
  .catch(e => { console.error('❌ Seed failed:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
