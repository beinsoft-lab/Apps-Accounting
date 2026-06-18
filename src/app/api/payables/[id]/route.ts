import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { executePost, executeVoid, generateJournalNumber } from '@/lib/accounting'
import { Decimal } from '@prisma/client/runtime/library'

const INCLUDE = {
  payableAccount: { select: { id: true, code: true, name: true, category: true } },
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

function deriveStatus(paidAmount: Decimal, totalAmount: Decimal): 'OPEN' | 'PARTIAL' | 'PAID' {
  const paid  = parseFloat(paidAmount.toString())
  const total = parseFloat(totalAmount.toString())
  if (paid <= 0)      return 'OPEN'
  if (paid >= total)  return 'PAID'
  return 'PARTIAL'
}

// GET /api/payables/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const payable = await prisma.payable.findUnique({
      where:   { id: parseInt(id) },
      include: INCLUDE,
    })
    if (!payable) {
      return NextResponse.json({ error: 'Hutang tidak ditemukan', success: false }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: payable })
  } catch {
    return NextResponse.json({ error: 'Gagal mengambil hutang', success: false }, { status: 500 })
  }
}

// PATCH /api/payables/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body            = await req.json()
    const { action }      = body
    const { id: paramId } = await params
    const id              = parseInt(paramId)

    const payable = await prisma.payable.findUnique({
      where:   { id },
      include: { journal: { select: { id: true, status: true } }, payments: { select: { id: true } } },
    })
    if (!payable) {
      return NextResponse.json({ error: 'Hutang tidak ditemukan', success: false }, { status: 404 })
    }

    // ════════════════════════════════════════
    // ACTION: approve — post creation journal
    // ════════════════════════════════════════
    if (action === 'approve') {
      if (payable.journal.status !== 'DRAFT') {
        return NextResponse.json({ error: 'Jurnal hutang sudah diposting atau dibatalkan', success: false }, { status: 422 })
      }
      if (payable.status === 'VOID') {
        return NextResponse.json({ error: 'Hutang sudah dibatalkan', success: false }, { status: 422 })
      }

      try {
        await prisma.$transaction(async (tx) => {
          await executePost(tx, payable.journal.id)
        })
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Gagal memposting jurnal hutang'
        return NextResponse.json({ error: msg, success: false }, { status: 500 })
      }

      const updated = await prisma.payable.findUnique({ where: { id }, include: INCLUDE })
      return NextResponse.json({ success: true, data: updated, message: 'Hutang berhasil diposting ke Buku Besar.' })
    }

    // ════════════════════════════════════════
    // ACTION: void — cancel the payable
    // ════════════════════════════════════════
    if (action === 'void') {
      if (payable.status === 'VOID') {
        return NextResponse.json({ error: 'Hutang sudah dalam status Void', success: false }, { status: 422 })
      }
      if (payable.payments.length > 0) {
        return NextResponse.json({
          error: 'Hutang yang sudah memiliki pembayaran tidak dapat dibatalkan',
          success: false,
        }, { status: 422 })
      }

      try {
        await prisma.$transaction(async (tx) => {
          await executeVoid(tx, payable.journal.id)
          await tx.payable.update({ where: { id }, data: { status: 'VOID' } })
        })
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Gagal membatalkan hutang'
        return NextResponse.json({ error: msg, success: false }, { status: 500 })
      }

      const updated = await prisma.payable.findUnique({ where: { id }, include: INCLUDE })
      return NextResponse.json({ success: true, data: updated, message: 'Hutang berhasil dibatalkan.' })
    }

    // ════════════════════════════════════════
    // ACTION: payment — record a payment
    // ════════════════════════════════════════
    if (action === 'payment') {
      const { paymentDate, amount: paymentAmount, cashAccountId, description } = body

      if (payable.status === 'PAID') {
        return NextResponse.json({ error: 'Hutang sudah lunas', success: false }, { status: 422 })
      }
      if (payable.status === 'VOID') {
        return NextResponse.json({ error: 'Hutang sudah dibatalkan', success: false }, { status: 422 })
      }
      if (!paymentDate)   return NextResponse.json({ error: 'Tanggal pembayaran wajib diisi', success: false }, { status: 422 })
      if (!cashAccountId) return NextResponse.json({ error: 'Akun kas/bank wajib dipilih', success: false }, { status: 422 })

      const payAmount = parseFloat(paymentAmount)
      if (isNaN(payAmount) || payAmount <= 0) {
        return NextResponse.json({ error: 'Jumlah pembayaran harus lebih dari 0', success: false }, { status: 422 })
      }

      const remaining = parseFloat(payable.remainingAmount.toString())
      if (payAmount > remaining + 0.001) {
        return NextResponse.json({
          error: `Jumlah pembayaran (${payAmount.toLocaleString('id-ID')}) melebihi sisa hutang (${remaining.toLocaleString('id-ID')})`,
          success: false,
        }, { status: 422 })
      }

      // Validate cash account (ASSET, leaf)
      const cashAcc = await prisma.account.findUnique({
        where: { id: parseInt(cashAccountId) },
        include: { children: { select: { id: true } } },
      })
      if (!cashAcc)                     return NextResponse.json({ error: 'Akun kas tidak ditemukan', success: false }, { status: 422 })
      if (cashAcc.category !== 'ASSET') return NextResponse.json({ error: 'Akun kas harus kategori ASSET', success: false }, { status: 422 })
      if (!cashAcc.isActive)            return NextResponse.json({ error: 'Akun kas tidak aktif', success: false }, { status: 422 })
      if (cashAcc.children.length > 0)  return NextResponse.json({ error: 'Akun kas harus akun leaf', success: false }, { status: 422 })

      const payDecimal         = new Decimal(payAmount.toFixed(2))
      const zero               = new Decimal('0.00')
      const payDateObj         = new Date(paymentDate)
      const journalNumber      = await generateJournalNumber()
      const newPaidAmount      = new Decimal(payable.paidAmount.toString()).add(payDecimal)
      const newRemainingAmount = new Decimal(payable.amount.toString()).sub(newPaidAmount)
      const newStatus          = deriveStatus(newPaidAmount, payable.amount)

      await prisma.$transaction(async (tx) => {
        // 1. Create payment journal
        const payJournal = await tx.journal.create({
          data: {
            journalNumber,
            transactionDate: payDateObj,
            description: description?.trim() || `Pembayaran hutang: ${payable.vendorName}`,
            status: 'DRAFT',
            createdById: 1,
            entries: {
              create: [
                // Debit: Hutang Usaha (LIABILITY) — reduce the liability
                { accountId: payable.payableAccountId, debit: payDecimal, credit: zero },
                // Credit: Kas/Bank (ASSET) — cash goes out
                { accountId: parseInt(cashAccountId),  debit: zero,       credit: payDecimal },
              ],
            },
          },
        })

        // 2. Auto-post payment journal
        await executePost(tx, payJournal.id)

        // 3. Record payment
        await tx.payablePayment.create({
          data: {
            payableId:    id,
            paymentDate:  payDateObj,
            amount:       payDecimal,
            cashAccountId: parseInt(cashAccountId),
            description:  description?.trim() || null,
            journalId:    payJournal.id,
          },
        })

        // 4. Update Payable amounts + status
        await tx.payable.update({
          where: { id },
          data: {
            paidAmount:      newPaidAmount,
            remainingAmount: newRemainingAmount,
            status:          newStatus,
          },
        })
      })

      const updated = await prisma.payable.findUnique({ where: { id }, include: INCLUDE })
      return NextResponse.json({
        success: true,
        data:    updated,
        message: `Pembayaran sebesar Rp ${payAmount.toLocaleString('id-ID')} berhasil dicatat.`,
      })
    }

    return NextResponse.json({ error: 'Action tidak valid', success: false }, { status: 422 })
  } catch (error) {
    console.error('[PATCH /api/payables/:id]', error)
    return NextResponse.json({ error: 'Gagal memperbarui hutang', success: false }, { status: 500 })
  }
}
