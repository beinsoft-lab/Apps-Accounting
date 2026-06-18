import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { executePost, executeVoid, generateJournalNumber } from '@/lib/accounting'
import { Decimal } from '@prisma/client/runtime/library'

const INCLUDE = {
  receivableAccount: { select: { id: true, code: true, name: true, category: true } },
  revenueAccount:    { select: { id: true, code: true, name: true, category: true } },
  journal: {
    include: {
      entries: { include: { account: { select: { id: true, code: true, name: true } } } },
    },
  },
  createdBy:  { select: { id: true, name: true } },
  items:      { orderBy: { id: 'asc' as const } },
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

function deriveStatus(paidAmount: Decimal, totalAmount: Decimal): 'DRAFT' | 'SENT' | 'PARTIAL' | 'PAID' | 'VOID' {
  const paid  = parseFloat(paidAmount.toString())
  const total = parseFloat(totalAmount.toString())
  if (paid <= 0)     return 'SENT'
  if (paid >= total) return 'PAID'
  return 'PARTIAL'
}

// GET /api/invoices/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const invoice = await prisma.invoice.findUnique({
      where:   { id: parseInt(id) },
      include: INCLUDE,
    })
    if (!invoice) return NextResponse.json({ error: 'Invoice tidak ditemukan', success: false }, { status: 404 })
    return NextResponse.json({ success: true, data: invoice })
  } catch {
    return NextResponse.json({ error: 'Gagal mengambil invoice', success: false }, { status: 500 })
  }
}

// PATCH /api/invoices/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body            = await req.json()
    const { action }      = body
    const { id: paramId } = await params
    const id              = parseInt(paramId)

    const invoice = await prisma.invoice.findUnique({
      where:   { id },
      include: { journal: { select: { id: true, status: true } }, payments: { select: { id: true } } },
    })
    if (!invoice) return NextResponse.json({ error: 'Invoice tidak ditemukan', success: false }, { status: 404 })

    // ════════════════════════════════════════
    // ACTION: approve — create + post journal
    // ════════════════════════════════════════
    if (action === 'approve') {
      if (invoice.status !== 'DRAFT') {
        return NextResponse.json({ error: 'Hanya invoice DRAFT yang dapat disetujui', success: false }, { status: 422 })
      }

      const journalNumber = await generateJournalNumber()
      const totalDec      = invoice.totalAmount
      const zero          = new Decimal('0.00')

      await prisma.$transaction(async (tx) => {
        // 1. Create journal
        const journal = await tx.journal.create({
          data: {
            journalNumber,
            transactionDate: invoice.invoiceDate,
            description:     `Invoice: ${invoice.customerName} — ${invoice.invoiceNumber}`,
            status:          'DRAFT',
            createdById:     1,
            entries: {
              create: [
                // Dr: Piutang Usaha (ASSET)
                { accountId: invoice.receivableAccountId, debit: totalDec, credit: zero },
                // Cr: Pendapatan
                { accountId: invoice.revenueAccountId,    debit: zero,     credit: totalDec },
              ],
            },
          },
        })

        // 2. Post immediately
        await executePost(tx, journal.id)

        // 3. Link journal to invoice + set SENT
        await tx.invoice.update({
          where: { id },
          data:  { journalId: journal.id, status: 'SENT' },
        })
      })

      const updated = await prisma.invoice.findUnique({ where: { id }, include: INCLUDE })
      return NextResponse.json({ success: true, data: updated, message: 'Invoice berhasil disetujui dan diposting ke Buku Besar.' })
    }

    // ════════════════════════════════════════
    // ACTION: void — cancel invoice
    // ════════════════════════════════════════
    if (action === 'void') {
      if (invoice.status === 'VOID') {
        return NextResponse.json({ error: 'Invoice sudah dalam status Void', success: false }, { status: 422 })
      }
      if (invoice.payments.length > 0) {
        return NextResponse.json({ error: 'Invoice yang sudah memiliki pembayaran tidak dapat dibatalkan', success: false }, { status: 422 })
      }

      await prisma.$transaction(async (tx) => {
        if (invoice.journal) {
          await executeVoid(tx, invoice.journal.id)
        }
        await tx.invoice.update({ where: { id }, data: { status: 'VOID' } })
      })

      const updated = await prisma.invoice.findUnique({ where: { id }, include: INCLUDE })
      return NextResponse.json({ success: true, data: updated, message: 'Invoice berhasil dibatalkan.' })
    }

    // ════════════════════════════════════════
    // ACTION: payment — record a payment
    // ════════════════════════════════════════
    if (action === 'payment') {
      const { paymentDate, amount: paymentAmount, cashAccountId, description } = body

      if (invoice.status === 'DRAFT') {
        return NextResponse.json({ error: 'Invoice belum disetujui, tidak dapat menerima pembayaran', success: false }, { status: 422 })
      }
      if (invoice.status === 'PAID') {
        return NextResponse.json({ error: 'Invoice sudah lunas', success: false }, { status: 422 })
      }
      if (invoice.status === 'VOID') {
        return NextResponse.json({ error: 'Invoice sudah dibatalkan', success: false }, { status: 422 })
      }
      if (!paymentDate)   return NextResponse.json({ error: 'Tanggal pembayaran wajib diisi', success: false }, { status: 422 })
      if (!cashAccountId) return NextResponse.json({ error: 'Akun kas/bank wajib dipilih', success: false }, { status: 422 })

      const payAmount = parseFloat(paymentAmount)
      if (isNaN(payAmount) || payAmount <= 0) {
        return NextResponse.json({ error: 'Jumlah pembayaran harus lebih dari 0', success: false }, { status: 422 })
      }

      const remaining = parseFloat(invoice.remainingAmount.toString())
      if (payAmount > remaining + 0.001) {
        return NextResponse.json({
          error: `Jumlah pembayaran (${payAmount.toLocaleString('id-ID')}) melebihi sisa invoice (${remaining.toLocaleString('id-ID')})`,
          success: false,
        }, { status: 422 })
      }

      // Validate cash account (ASSET leaf)
      const cashAcc = await prisma.account.findUnique({
        where:   { id: parseInt(cashAccountId) },
        include: { children: { select: { id: true } } },
      })
      if (!cashAcc)                      return NextResponse.json({ error: 'Akun kas tidak ditemukan', success: false }, { status: 422 })
      if (cashAcc.category !== 'ASSET')  return NextResponse.json({ error: 'Akun kas harus kategori ASSET', success: false }, { status: 422 })
      if (!cashAcc.isActive)             return NextResponse.json({ error: 'Akun kas tidak aktif', success: false }, { status: 422 })
      if (cashAcc.children.length > 0)   return NextResponse.json({ error: 'Akun kas harus akun leaf', success: false }, { status: 422 })

      const payDec             = new Decimal(payAmount.toFixed(2))
      const zero               = new Decimal('0.00')
      const newPaidAmount      = new Decimal(invoice.paidAmount.toString()).add(payDec)
      const newRemainingAmount = new Decimal(invoice.totalAmount.toString()).sub(newPaidAmount)
      const newStatus          = deriveStatus(newPaidAmount, invoice.totalAmount)
      const journalNumber      = await generateJournalNumber()

      await prisma.$transaction(async (tx) => {
        // 1. Create payment journal
        const payJournal = await tx.journal.create({
          data: {
            journalNumber,
            transactionDate: new Date(paymentDate),
            description:     description?.trim() || `Pembayaran invoice: ${invoice.customerName}`,
            status:          'DRAFT',
            createdById:     1,
            entries: {
              create: [
                // Dr: Kas/Bank (ASSET)
                { accountId: parseInt(cashAccountId),         debit: payDec, credit: zero },
                // Cr: Piutang Usaha (ASSET) — reduce receivable
                { accountId: invoice.receivableAccountId,     debit: zero,   credit: payDec },
              ],
            },
          },
        })

        // 2. Auto-post
        await executePost(tx, payJournal.id)

        // 3. Record payment
        await tx.invoicePayment.create({
          data: {
            invoiceId:    id,
            paymentDate:  new Date(paymentDate),
            amount:       payDec,
            cashAccountId: parseInt(cashAccountId),
            description:  description?.trim() || null,
            journalId:    payJournal.id,
          },
        })

        // 4. Update invoice amounts + status
        await tx.invoice.update({
          where: { id },
          data: {
            paidAmount:      newPaidAmount,
            remainingAmount: newRemainingAmount,
            status:          newStatus,
          },
        })
      })

      const updated = await prisma.invoice.findUnique({ where: { id }, include: INCLUDE })
      return NextResponse.json({
        success: true,
        data:    updated,
        message: `Pembayaran sebesar Rp ${payAmount.toLocaleString('id-ID')} berhasil dicatat.`,
      })
    }

    return NextResponse.json({ error: 'Action tidak valid', success: false }, { status: 422 })
  } catch (error) {
    console.error('[PATCH /api/invoices/:id]', error)
    return NextResponse.json({ error: 'Gagal memperbarui invoice', success: false }, { status: 500 })
  }
}
