import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Decimal } from '@prisma/client/runtime/library'

// ============================================================
// POSTING ENGINE — The Core of the Accounting System
// ============================================================
// Converts a DRAFT Journal into POSTED status and simultaneously
// creates GeneralLedger rows within a single Prisma Transaction.
// If any step fails, the ENTIRE operation rolls back.
// ============================================================

interface JournalEntryInput {
  accountId: number
  debit: number
  credit: number
  description?: string
}

// Auto-generate journal number: JNL-YYYYMMDD-NNNN
async function generateJournalNumber(): Promise<string> {
  const today = new Date()
  const datePart = today.toISOString().slice(0, 10).replace(/-/g, '')
  const startOfDay = new Date(today.setHours(0, 0, 0, 0))
  const endOfDay = new Date(today.setHours(23, 59, 59, 999))

  const count = await prisma.journal.count({
    where: { createdAt: { gte: startOfDay, lte: endOfDay } },
  })

  const seq = String(count + 1).padStart(4, '0')
  return `JNL-${datePart}-${seq}`
}

// Validate entries balance: sum(debit) must equal sum(credit)
function validateBalance(entries: JournalEntryInput[]): { valid: boolean; totalDebit: number; totalCredit: number } {
  const totalDebit = entries.reduce((sum, e) => sum + (e.debit || 0), 0)
  const totalCredit = entries.reduce((sum, e) => sum + (e.credit || 0), 0)
  // Use toFixed to avoid floating point precision issues
  const valid = parseFloat(totalDebit.toFixed(2)) === parseFloat(totalCredit.toFixed(2))
  return { valid, totalDebit, totalCredit }
}

// GET /api/journals — List journals with filters
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const dateFrom = searchParams.get('from')
    const dateTo = searchParams.get('to')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    const where: any = {}
    if (status) where.status = status
    if (dateFrom || dateTo) {
      where.transactionDate = {}
      if (dateFrom) where.transactionDate.gte = new Date(dateFrom)
      if (dateTo) where.transactionDate.lte = new Date(dateTo)
    }

    const [journals, total] = await Promise.all([
      prisma.journal.findMany({
        where,
        include: {
          createdBy: { select: { id: true, name: true } },
          entries: {
            include: { account: { select: { id: true, code: true, name: true } } },
          },
        },
        orderBy: { transactionDate: 'desc' },
        skip,
        take: limit,
      }),
      prisma.journal.count({ where }),
    ])

    return NextResponse.json({
      data: journals,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      success: true,
    })
  } catch (error) {
    console.error('[GET /api/journals]', error)
    return NextResponse.json({ error: 'Failed to fetch journals', success: false }, { status: 500 })
  }
}

// POST /api/journals — Create a new DRAFT journal
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { transactionDate, referenceNumber, description, entries, createdById = 1 } = body

    // Validate presence
    if (!transactionDate || !description || !entries || entries.length < 2) {
      return NextResponse.json({
        error: 'Required: transactionDate, description, and at least 2 journal entries',
        success: false,
      }, { status: 400 })
    }

    // Validate balance (even for DRAFT, we warn if unbalanced)
    const { valid, totalDebit, totalCredit } = validateBalance(entries as JournalEntryInput[])
    if (!valid) {
      return NextResponse.json({
        error: `Journal not balanced. Total Debit: ${totalDebit}, Total Credit: ${totalCredit}`,
        success: false,
        meta: { totalDebit, totalCredit },
      }, { status: 422 })
    }

    // Validate all accountIds exist
    const accountIds = entries.map((e: JournalEntryInput) => e.accountId)
    const accountCount = await prisma.account.count({
      where: { id: { in: accountIds }, isActive: true },
    })
    if (accountCount !== accountIds.length) {
      return NextResponse.json({ error: 'One or more accounts are invalid or inactive', success: false }, { status: 422 })
    }

    const journalNumber = await generateJournalNumber()

    const journal = await prisma.journal.create({
      data: {
        journalNumber,
        transactionDate: new Date(transactionDate),
        referenceNumber: referenceNumber || null,
        description,
        status: 'DRAFT',
        createdById,
        entries: {
          create: (entries as JournalEntryInput[]).map((e) => ({
            accountId: e.accountId,
            debit: new Decimal(e.debit || 0),
            credit: new Decimal(e.credit || 0),
            description: e.description || null,
          })),
        },
      },
      include: {
        entries: { include: { account: { select: { id: true, code: true, name: true } } } },
        createdBy: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json({ data: journal, success: true }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/journals]', error)
    return NextResponse.json({ error: 'Failed to create journal', success: false }, { status: 500 })
  }
}
