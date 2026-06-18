import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

// ============================================================
// Number Generation
// ============================================================

export async function generateJournalNumber(): Promise<string> {
  const now   = new Date()
  const y     = now.getFullYear()
  const mo    = String(now.getMonth() + 1).padStart(2, '0')
  const d     = String(now.getDate()).padStart(2, '0')
  const datePart    = `${y}${mo}${d}`
  const startOfDay  = new Date(y, now.getMonth(), now.getDate(), 0, 0, 0, 0)
  const endOfDay    = new Date(y, now.getMonth(), now.getDate(), 23, 59, 59, 999)

  const count = await prisma.journal.count({
    where: { createdAt: { gte: startOfDay, lte: endOfDay } },
  })
  return `JNL-${datePart}-${String(count + 1).padStart(4, '0')}`
}

export async function generateCashNumber(type: 'IN' | 'OUT'): Promise<string> {
  const now  = new Date()
  const y    = now.getFullYear()
  const mo   = String(now.getMonth() + 1).padStart(2, '0')
  const d    = String(now.getDate()).padStart(2, '0')
  const datePart   = `${y}${mo}${d}`
  const startOfDay = new Date(y, now.getMonth(), now.getDate(), 0, 0, 0, 0)
  const endOfDay   = new Date(y, now.getMonth(), now.getDate(), 23, 59, 59, 999)

  const count = await prisma.cashTransaction.count({
    where: { type, createdAt: { gte: startOfDay, lte: endOfDay } },
  })
  const prefix = type === 'IN' ? 'KM' : 'KK'
  return `${prefix}-${datePart}-${String(count + 1).padStart(4, '0')}`
}

export async function generateReceivableNumber(): Promise<string> {
  const now  = new Date()
  const y    = now.getFullYear()
  const mo   = String(now.getMonth() + 1).padStart(2, '0')
  const d    = String(now.getDate()).padStart(2, '0')
  const datePart   = `${y}${mo}${d}`
  const startOfDay = new Date(y, now.getMonth(), now.getDate(), 0, 0, 0, 0)
  const endOfDay   = new Date(y, now.getMonth(), now.getDate(), 23, 59, 59, 999)

  const count = await prisma.receivable.count({
    where: { createdAt: { gte: startOfDay, lte: endOfDay } },
  })
  return `PR-${datePart}-${String(count + 1).padStart(4, '0')}`
}

export async function generatePayableNumber(): Promise<string> {
  const now  = new Date()
  const y    = now.getFullYear()
  const mo   = String(now.getMonth() + 1).padStart(2, '0')
  const d    = String(now.getDate()).padStart(2, '0')
  const datePart   = `${y}${mo}${d}`
  const startOfDay = new Date(y, now.getMonth(), now.getDate(), 0, 0, 0, 0)
  const endOfDay   = new Date(y, now.getMonth(), now.getDate(), 23, 59, 59, 999)

  const count = await prisma.payable.count({
    where: { createdAt: { gte: startOfDay, lte: endOfDay } },
  })
  return `HP-${datePart}-${String(count + 1).padStart(4, '0')}`
}

export async function generateInvoiceNumber(): Promise<string> {
  const now  = new Date()
  const y    = now.getFullYear()
  const mo   = String(now.getMonth() + 1).padStart(2, '0')
  const d    = String(now.getDate()).padStart(2, '0')
  const datePart   = `${y}${mo}${d}`
  const startOfDay = new Date(y, now.getMonth(), now.getDate(), 0, 0, 0, 0)
  const endOfDay   = new Date(y, now.getMonth(), now.getDate(), 23, 59, 59, 999)

  const count = await prisma.invoice.count({
    where: { createdAt: { gte: startOfDay, lte: endOfDay } },
  })
  return `INV-${datePart}-${String(count + 1).padStart(4, '0')}`
}

// ============================================================
// Posting Engine  (single source of truth)
// ============================================================

export async function executePost(
  tx: Prisma.TransactionClient,
  journalId: number,
) {
  const journal = await tx.journal.findUnique({
    where: { id: journalId },
    include: { entries: true },
  })

  if (!journal)                     throw new Error(`Journal ${journalId} not found`)
  if (journal.status !== 'DRAFT')   throw new Error('Only DRAFT journals can be posted')
  if (journal.entries.length < 2)   throw new Error('Journal must have at least 2 entries')

  const totalDebit  = journal.entries.reduce((s, e) => s + parseFloat(e.debit.toString()),  0)
  const totalCredit = journal.entries.reduce((s, e) => s + parseFloat(e.credit.toString()), 0)
  if (parseFloat(totalDebit.toFixed(2)) !== parseFloat(totalCredit.toFixed(2))) {
    throw new Error(`Unbalanced journal. Debit: ${totalDebit}, Credit: ${totalCredit}`)
  }

  const posted = await tx.journal.update({
    where: { id: journalId },
    data:  { status: 'POSTED' },
    include: { entries: true },
  })

  const affectedAccountIds = [...new Set(posted.entries.map(e => e.accountId))]

  const accounts = await tx.account.findMany({
    where:  { id: { in: affectedAccountIds } },
    select: { id: true, normalBalance: true },
  })
  const normalBalanceMap = new Map(accounts.map(a => [a.id, a.normalBalance]))

  // Insert GL rows (runningBalance placeholder = 0)
  for (const entry of posted.entries) {
    await tx.generalLedger.create({
      data: {
        accountId:      entry.accountId,
        journalId,
        journalEntryId: entry.id,
        transactionDate: journal.transactionDate,
        description:    entry.description || journal.description,
        debit:          entry.debit,
        credit:         entry.credit,
        runningBalance: 0,
      },
    })
  }

  // Walk-forward recalculation per affected account
  for (const accountId of affectedAccountIds) {
    const normalBalance = normalBalanceMap.get(accountId)
    if (!normalBalance) continue

    const allRows = await tx.generalLedger.findMany({
      where:   { accountId },
      orderBy: [{ transactionDate: 'asc' }, { createdAt: 'asc' }],
      select:  { id: true, debit: true, credit: true },
    })

    let running = 0
    for (const row of allRows) {
      const dr = parseFloat(row.debit.toString())
      const cr = parseFloat(row.credit.toString())
      running += normalBalance === 'DEBIT' ? dr - cr : cr - dr
      await tx.generalLedger.update({ where: { id: row.id }, data: { runningBalance: running } })
    }
  }

  return posted
}

// ============================================================
// Void Engine  (single source of truth)
// ============================================================

export async function executeVoid(
  tx: Prisma.TransactionClient,
  journalId: number,
): Promise<void> {
  const journal = await tx.journal.findUnique({
    where: { id: journalId },
    include: { entries: true },
  })

  if (!journal)                   throw new Error(`Journal ${journalId} not found`)
  if (journal.status === 'VOID')  throw new Error('Journal is already voided')

  const affectedAccountIds = [...new Set(journal.entries.map(e => e.accountId))]
  const wasPosted          = journal.status === 'POSTED'

  if (wasPosted) {
    await tx.generalLedger.deleteMany({ where: { journalId } })
  }

  await tx.journal.update({ where: { id: journalId }, data: { status: 'VOID' } })

  if (wasPosted) {
    for (const accountId of affectedAccountIds) {
      const account = await tx.account.findUnique({
        where:  { id: accountId },
        select: { normalBalance: true },
      })
      if (!account) continue

      const remainingRows = await tx.generalLedger.findMany({
        where:   { accountId },
        orderBy: [{ transactionDate: 'asc' }, { createdAt: 'asc' }],
        select:  { id: true, debit: true, credit: true },
      })

      let running = 0
      for (const row of remainingRows) {
        const dr = parseFloat(row.debit.toString())
        const cr = parseFloat(row.credit.toString())
        running += account.normalBalance === 'DEBIT' ? dr - cr : cr - dr
        await tx.generalLedger.update({ where: { id: row.id }, data: { runningBalance: running } })
      }
    }
  }
}
