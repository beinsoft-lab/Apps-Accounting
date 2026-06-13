import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/journals/[id] — Get single journal with entries
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const journal = await prisma.journal.findUnique({
      where: { id: parseInt(id) },
      include: {
        entries: {
          include: { account: { select: { id: true, code: true, name: true, category: true } } },
        },
        createdBy: { select: { id: true, name: true } },
      },
    })

    if (!journal) {
      return NextResponse.json({ error: 'Journal not found', success: false }, { status: 404 })
    }

    return NextResponse.json({ data: journal, success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch journal', success: false }, { status: 500 })
  }
}

// PATCH /api/journals/[id] — Update DRAFT journal or change status
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await req.json()
    const { action, description, referenceNumber } = body
    const { id: paramId } = await params
    const id = parseInt(paramId)

    const journal = await prisma.journal.findUnique({
      where: { id },
      include: { entries: true },
    })

    if (!journal) {
      return NextResponse.json({ error: 'Journal not found', success: false }, { status: 404 })
    }

    // ========================
    // ACTION: POST (Posting Engine)
    // ========================
    if (action === 'post') {
      if (journal.status !== 'DRAFT') {
        return NextResponse.json({ error: 'Only DRAFT journals can be posted', success: false }, { status: 422 })
      }

      if (journal.entries.length < 2) {
        return NextResponse.json({ error: 'Journal must have at least 2 entries', success: false }, { status: 422 })
      }

      // Validate balance
      const totalDebit = journal.entries.reduce((s: number, e: any) => s + parseFloat(e.debit.toString()), 0)
      const totalCredit = journal.entries.reduce((s: number, e: any) => s + parseFloat(e.credit.toString()), 0)
      if (parseFloat(totalDebit.toFixed(2)) !== parseFloat(totalCredit.toFixed(2))) {
        return NextResponse.json({
          error: `Unbalanced journal. Debit: ${totalDebit}, Credit: ${totalCredit}`,
          success: false,
          meta: { totalDebit, totalCredit },
        }, { status: 422 })
      }

      // ======================================================
      // PRISMA TRANSACTION — Atomic Posting
      // Step 1: Update Journal to POSTED
      // Step 2: Insert GeneralLedger rows (runningBalance = 0)
      // Step 3: Full running-balance recalculation per affected
      //         account — correct for backdated and in-order posting
      // ======================================================
      const result = await prisma.$transaction(async (tx) => {
        const posted = await tx.journal.update({
          where: { id },
          data: { status: 'POSTED' },
          include: { entries: true },
        })

        const affectedAccountIds = [...new Set(posted.entries.map(e => e.accountId))]

        // Fetch normal-balance direction for all affected accounts once
        const accounts = await tx.account.findMany({
          where: { id: { in: affectedAccountIds } },
          select: { id: true, normalBalance: true },
        })
        const accountNormalBalance = new Map(accounts.map(a => [a.id, a.normalBalance]))

        // Step 2: Insert GL rows with placeholder runningBalance
        for (const entry of posted.entries) {
          await tx.generalLedger.create({
            data: {
              accountId: entry.accountId,
              journalId: id,
              journalEntryId: entry.id,
              transactionDate: journal.transactionDate,
              description: entry.description || journal.description,
              debit: entry.debit,
              credit: entry.credit,
              runningBalance: 0,
            },
          })
        }

        // Step 3: Recalculate all running balances for each affected account.
        // Ordering by [transactionDate asc, createdAt asc] places the newly
        // inserted rows in their correct chronological position, so this
        // handles backdated journals without any special-casing.
        for (const accountId of affectedAccountIds) {
          const normalBalance = accountNormalBalance.get(accountId)
          if (!normalBalance) continue

          const allRows = await tx.generalLedger.findMany({
            where: { accountId },
            orderBy: [{ transactionDate: 'asc' }, { createdAt: 'asc' }],
            select: { id: true, debit: true, credit: true },
          })

          let runningBalance = 0
          for (const row of allRows) {
            const debit = parseFloat(row.debit.toString())
            const credit = parseFloat(row.credit.toString())
            runningBalance += normalBalance === 'DEBIT' ? debit - credit : credit - debit
            await tx.generalLedger.update({
              where: { id: row.id },
              data: { runningBalance },
            })
          }
        }

        return posted
      })

      return NextResponse.json({ data: result, success: true, message: 'Journal posted successfully and ledger updated.' })
    }

    // ========================
    // ACTION: VOID
    // ========================
    if (action === 'void') {
      if (journal.status === 'VOID') {
        return NextResponse.json({ error: 'Journal is already voided', success: false }, { status: 422 })
      }

      if (journal.status === 'POSTED') {
        // Collect the unique accounts touched by this journal before deleting anything
        const affectedAccountIds = [...new Set(journal.entries.map(e => e.accountId))]

        await prisma.$transaction(async (tx) => {
          // Step 1: Remove this journal's ledger rows
          await tx.generalLedger.deleteMany({ where: { journalId: id } })

          // Step 2: Mark journal as VOID
          await tx.journal.update({ where: { id }, data: { status: 'VOID' } })

          // Step 3: Recalculate running balances for every affected account.
          // Only accounts referenced by the voided journal are touched.
          for (const accountId of affectedAccountIds) {
            const account = await tx.account.findUnique({
              where: { id: accountId },
              select: { normalBalance: true },
            })
            if (!account) continue

            // Fetch all remaining ledger rows for this account in chronological order
            const remainingRows = await tx.generalLedger.findMany({
              where: { accountId },
              orderBy: [{ transactionDate: 'asc' }, { createdAt: 'asc' }],
              select: { id: true, debit: true, credit: true },
            })

            // Walk forward from zero and rewrite each stored running balance
            let runningBalance = 0
            for (const row of remainingRows) {
              const debit = parseFloat(row.debit.toString())
              const credit = parseFloat(row.credit.toString())

              if (account.normalBalance === 'DEBIT') {
                runningBalance = runningBalance + debit - credit
              } else {
                runningBalance = runningBalance + credit - debit
              }

              await tx.generalLedger.update({
                where: { id: row.id },
                data: { runningBalance },
              })
            }
          }
        })
      } else {
        // DRAFT journal has no ledger rows — just mark as VOID
        await prisma.journal.update({ where: { id }, data: { status: 'VOID' } })
      }

      return NextResponse.json({ data: { id, status: 'VOID' }, success: true, message: 'Journal voided successfully.' })
    }

    // ========================
    // Update DRAFT fields
    // ========================
    if (journal.status !== 'DRAFT') {
      return NextResponse.json({ error: 'Only DRAFT journals can be edited', success: false }, { status: 422 })
    }

    const updated = await prisma.journal.update({
      where: { id },
      data: {
        ...(description ? { description } : {}),
        ...(referenceNumber !== undefined ? { referenceNumber } : {}),
      },
    })

    return NextResponse.json({ data: updated, success: true })
  } catch (error) {
    console.error('[PATCH /api/journals/:id]', error)
    return NextResponse.json({ error: 'Failed to update journal', success: false }, { status: 500 })
  }
}
