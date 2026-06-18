import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { executePost, executeVoid, generateJournalNumber } from '@/lib/accounting'
import { Decimal } from '@prisma/client/runtime/library'

const INCLUDE = {
  receivableAccount: { select: { id: true, code: true, name: true, category: true } },
  journal: {
    include: {
      entries: { include: { account: { select: { id: true, code: true, name: true } } } },
    },
  },
  createdBy: { select: { id: true, name: true } },
  payments: {
    include: {
      cashAccount: { select: { id: true, code: true, name: true } },
      journal: {
        include: {
          entries: { include: { account: { select: { id: true, code: true, name: true } } } },
        },
      },
    },
    orderBy: { paymentDate: 'asc' as const },
  },
} as const

// ─── Helper: derive status from amounts ──────────────────────────────────────
function deriveStatus(paidAmount: Decimal, totalAmount: Decimal): 'OPEN' | 'PARTIAL' | 'PAID' {
  const paid  = parseFloat(paidAmount.toString())
  const total = parseFloat(totalAmount.toString())
  if (paid <= 0)         return 'OPEN'
  if (paid >= total)     return 'PAID'
  return 'PARTIAL'
}

// GET /api/receivables/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const receivable = await prisma.receivable.findUnique({
      where:   { id: parseInt(id) },
      include: INCLUDE,
    })
    if (!receivable) {
      return NextResponse.json({ error: 'Piutang tidak ditemukan', success: false }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: receivable })
  } catch {
    return NextResponse.json({ error: 'Gagal mengambil piutang', success: false }, { status: 500 })
  }
}

// PATCH /api/receivables/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body               = await req.json()
    const { action }         = body
    const { id: paramId }    = await params
    const id                 = parseInt(paramId)

    const receivable = await prisma.receivable.findUnique({
      where:   { id },
      include: { journal: { select: { id: true, status: true } }, payments: { select: { id: true } } },
    })
    if (!receivable) {
      return NextResponse.json({ error: 'Piutang tidak ditemukan', success: false }, { status: 404 })
    }

    // ════════════════════════════════════════════
    // ACTION: approve — post the creation journal
    // ════════════════════════════════════════════
    if (action === 'approve') {
      if (receivable.journal.status !== 'DRAFT') {
        return NextResponse.json({ error: 'Jurnal piutang sudah diposting atau dibatalkan', success: false }, { status: 422 })
      }
      if (receivable.status === 'VOID') {
        return NextResponse.json({ error: 'Piutang sudah dibatalkan', success: false }, { status: 422 })
      }

      try {
        await prisma.$transaction(async (tx) => {
          await executePost(tx, receivable.journal.id)
        })
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Gagal memposting jurnal piutang'
        return NextResponse.json({ error: msg, success: false }, { status: 500 })
      }

      const updated = await prisma.receivable.findUnique({ where: { id }, include: INCLUDE })
      return NextResponse.json({ success: true, data: updated, message: 'Piutang berhasil diposting ke Buku Besar.' })
    }

    // ════════════════════════════════════════════
    // ACTION: void — cancel the receivable
    // ════════════════════════════════════════════
    if (action === 'void') {
      if (receivable.status === 'VOID') {
        return NextResponse.json({ error: 'Piutang sudah dalam status Void', success: false }, { status: 422 })
      }
      if (receivable.payments.length > 0) {
        return NextResponse.json({
          error: 'Piutang yang sudah memiliki pembayaran tidak dapat dibatalkan',
          success: false,
        }, { status: 422 })
      }

      try {
        await prisma.$transaction(async (tx) => {
          await executeVoid(tx, receivable.journal.id)
          await tx.receivable.update({ where: { id }, data: { status: 'VOID' } })
        })
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Gagal membatalkan piutang'
        return NextResponse.json({ error: msg, success: false }, { status: 500 })
      }

      const updated = await prisma.receivable.findUnique({ where: { id }, include: INCLUDE })
      return NextResponse.json({ success: true, data: updated, message: 'Piutang berhasil dibatalkan.' })
    }

    // ════════════════════════════════════════════
    // ACTION: payment — record a payment
    // ════════════════════════════════════════════
    if (action === 'payment') {
      const { paymentDate, amount: paymentAmount, cashAccountId, description } = body

      if (receivable.status === 'PAID') {
        return NextResponse.json({ error: 'Piutang sudah lunas', success: false }, { status: 422 })
      }
      if (receivable.status === 'VOID') {
        return NextResponse.json({ error: 'Piutang sudah dibatalkan', success: false }, { status: 422 })
      }
      if (!paymentDate)    return NextResponse.json({ error: 'Tanggal pembayaran wajib diisi', success: false }, { status: 422 })
      if (!cashAccountId)  return NextResponse.json({ error: 'Akun kas/bank wajib dipilih', success: false }, { status: 422 })

      const payAmount = parseFloat(paymentAmount)
      if (isNaN(payAmount) || payAmount <= 0) {
        return NextResponse.json({ error: 'Jumlah pembayaran harus lebih dari 0', success: false }, { status: 422 })
      }

      const remaining = parseFloat(receivable.remainingAmount.toString())
      if (payAmount > remaining + 0.001) {
        return NextResponse.json({
          error: `Jumlah pembayaran (${payAmount.toLocaleString('id-ID')}) melebihi sisa piutang (${remaining.toLocaleString('id-ID')})`,
          success: false,
        }, { status: 422 })
      }

      // Validate cash account
      const cashAcc = await prisma.account.findUnique({
        where: { id: parseInt(cashAccountId) },
        include: { children: { select: { id: true } } },
      })
      if (!cashAcc)                    return NextResponse.json({ error: 'Akun kas tidak ditemukan', success: false }, { status: 422 })
      if (cashAcc.category !== 'ASSET') return NextResponse.json({ error: 'Akun kas harus kategori ASSET', success: false }, { status: 422 })
      if (!cashAcc.isActive)           return NextResponse.json({ error: 'Akun kas tidak aktif', success: false }, { status: 422 })
      if (cashAcc.children.length > 0) return NextResponse.json({ error: 'Akun kas harus akun leaf', success: false }, { status: 422 })

      const payDecimal  = new Decimal(payAmount.toFixed(2))
      const zero        = new Decimal('0.00')
      const payDateObj  = new Date(paymentDate)
      const journalNumber = await generateJournalNumber()

      const newPaidAmount      = new Decimal(receivable.paidAmount.toString()).add(payDecimal)
      const newRemainingAmount = new Decimal(receivable.amount.toString()).sub(newPaidAmount)
      const newStatus          = deriveStatus(newPaidAmount, receivable.amount)

      await prisma.$transaction(async (tx) => {
        // 1. Create payment journal (auto-post)
        const payJournal = await tx.journal.create({
          data: {
            journalNumber,
            transactionDate: payDateObj,
            description: description?.trim() || `Pembayaran piutang: ${receivable.customerName}`,
            status: 'DRAFT',
            createdById: 1,
            entries: {
              create: [
                // Debit: Kas/Bank
                { accountId: parseInt(cashAccountId), debit: payDecimal, credit: zero },
                // Credit: Piutang Usaha
                { accountId: receivable.receivableAccountId, debit: zero, credit: payDecimal },
              ],
            },
          },
        })

        // 2. Post payment journal immediately
        await executePost(tx, payJournal.id)

        // 3. Create ReceivablePayment record
        await tx.receivablePayment.create({
          data: {
            receivableId: id,
            paymentDate:  payDateObj,
            amount:       payDecimal,
            cashAccountId: parseInt(cashAccountId),
            description:   description?.trim() || null,
            journalId:     payJournal.id,
          },
        })

        // 4. Update Receivable amounts + status
        await tx.receivable.update({
          where: { id },
          data: {
            paidAmount:      newPaidAmount,
            remainingAmount: newRemainingAmount,
            status:          newStatus,
          },
        })
      })

      const updated = await prisma.receivable.findUnique({ where: { id }, include: INCLUDE })
      return NextResponse.json({
        success: true,
        data:    updated,
        message: `Pembayaran sebesar Rp ${payAmount.toLocaleString('id-ID')} berhasil dicatat.`,
      })
    }

    return NextResponse.json({ error: 'Action tidak valid', success: false }, { status: 422 })
  } catch (error) {
    console.error('[PATCH /api/receivables/:id]', error)
    return NextResponse.json({ error: 'Gagal memperbarui piutang', success: false }, { status: 500 })
  }
}
