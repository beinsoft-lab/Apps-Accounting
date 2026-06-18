import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { executePost, executeVoid } from '@/lib/accounting'

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
  } catch {
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
      include: {
        entries: true,
        cashTransaction: { select: { transactionNumber: true } },
      },
    })

    if (!journal) {
      return NextResponse.json({ error: 'Journal not found', success: false }, { status: 404 })
    }

    // ========================
    // ACTION: POST (Posting Engine)
    // ========================
    if (action === 'post') {
      try {
        const result = await prisma.$transaction(async (tx) => {
          return await executePost(tx, id)
        })
        return NextResponse.json({
          data: result,
          success: true,
          message: 'Journal posted successfully and ledger updated.',
        })
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to post journal'
        const isClientError =
          msg.includes('Only DRAFT') ||
          msg.includes('Unbalanced') ||
          msg.includes('must have at least')
        return NextResponse.json({ error: msg, success: false }, { status: isClientError ? 422 : 500 })
      }
    }

    // ========================
    // ACTION: VOID
    // ========================
    if (action === 'void') {
      // Guard: prevent voiding a journal owned by a CashTransaction
      if (journal.cashTransaction) {
        return NextResponse.json({
          error: `Journal ini dimiliki oleh transaksi kas ${journal.cashTransaction.transactionNumber}. Gunakan halaman Kas Masuk/Kas Keluar untuk membatalkan.`,
          code: 'JOURNAL_OWNED_BY_CASH_TRANSACTION',
          success: false,
        }, { status: 422 })
      }

      try {
        await prisma.$transaction(async (tx) => {
          await executeVoid(tx, id)
        })
        return NextResponse.json({
          data: { id, status: 'VOID' },
          success: true,
          message: 'Journal voided successfully.',
        })
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to void journal'
        return NextResponse.json({
          error: msg,
          success: false,
        }, { status: msg.includes('already voided') ? 422 : 500 })
      }
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
        ...(description     !== undefined ? { description }     : {}),
        ...(referenceNumber !== undefined ? { referenceNumber } : {}),
      },
    })

    return NextResponse.json({ data: updated, success: true })
  } catch (error) {
    console.error('[PATCH /api/journals/:id]', error)
    return NextResponse.json({ error: 'Failed to update journal', success: false }, { status: 500 })
  }
}
