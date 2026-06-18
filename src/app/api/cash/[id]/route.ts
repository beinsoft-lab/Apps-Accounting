import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { executePost, executeVoid } from '@/lib/accounting'

const INCLUDE = {
  cashAccount:        { select: { id: true, code: true, name: true, category: true } },
  counterpartAccount: { select: { id: true, code: true, name: true, category: true } },
  journal: {
    include: {
      entries: {
        include: { account: { select: { id: true, code: true, name: true } } },
      },
    },
  },
  createdBy: { select: { id: true, name: true } },
} as const

// GET /api/cash/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const cashTx = await prisma.cashTransaction.findUnique({
      where:   { id: parseInt(id) },
      include: INCLUDE,
    })
    if (!cashTx) {
      return NextResponse.json({ error: 'Transaksi tidak ditemukan', success: false }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: cashTx })
  } catch {
    return NextResponse.json({ error: 'Gagal mengambil transaksi', success: false }, { status: 500 })
  }
}

// PATCH /api/cash/[id] — approve | void | update DRAFT fields
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await req.json()
    const { action, description, referenceNumber, partyName } = body
    const { id: paramId } = await params
    const id = parseInt(paramId)

    const cashTx = await prisma.cashTransaction.findUnique({
      where:   { id },
      include: { journal: { select: { id: true, status: true } } },
    })
    if (!cashTx) {
      return NextResponse.json({ error: 'Transaksi tidak ditemukan', success: false }, { status: 404 })
    }

    const journalStatus = cashTx.journal.status
    const journalId     = cashTx.journal.id

    // ========================
    // ACTION: approve (post)
    // ========================
    if (action === 'approve') {
      if (journalStatus !== 'DRAFT') {
        return NextResponse.json({
          error: 'Hanya transaksi Draft yang dapat diposting',
          success: false,
        }, { status: 422 })
      }

      try {
        await prisma.$transaction(async (tx) => {
          await executePost(tx, journalId)
        })
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Gagal memposting transaksi'
        return NextResponse.json({ error: msg, success: false }, { status: 500 })
      }

      const updated = await prisma.cashTransaction.findUnique({ where: { id }, include: INCLUDE })
      return NextResponse.json({
        success: true,
        data:    updated,
        message: 'Transaksi berhasil diposting ke Buku Besar.',
      })
    }

    // ========================
    // ACTION: void
    // ========================
    if (action === 'void') {
      if (journalStatus === 'VOID') {
        return NextResponse.json({
          error: 'Transaksi sudah dalam status Void',
          success: false,
        }, { status: 422 })
      }

      try {
        await prisma.$transaction(async (tx) => {
          await executeVoid(tx, journalId)
        })
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Gagal membatalkan transaksi'
        return NextResponse.json({ error: msg, success: false }, { status: 500 })
      }

      const updated = await prisma.cashTransaction.findUnique({ where: { id }, include: INCLUDE })
      return NextResponse.json({
        success: true,
        data:    updated,
        message: 'Transaksi berhasil dibatalkan.',
      })
    }

    // ========================
    // Update DRAFT fields only
    // ========================
    if (journalStatus !== 'DRAFT') {
      return NextResponse.json({
        error: 'Hanya transaksi Draft yang dapat diedit',
        success: false,
      }, { status: 422 })
    }

    await prisma.$transaction(async (tx) => {
      await tx.cashTransaction.update({
        where: { id },
        data: {
          ...(description     !== undefined ? { description }     : {}),
          ...(referenceNumber !== undefined ? { referenceNumber } : {}),
          ...(partyName       !== undefined ? { partyName }       : {}),
        },
      })
      // Keep journal description in sync
      if (description !== undefined) {
        await tx.journal.update({ where: { id: journalId }, data: { description } })
      }
    })

    const updated = await prisma.cashTransaction.findUnique({ where: { id }, include: INCLUDE })
    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('[PATCH /api/cash/:id]', error)
    return NextResponse.json({ error: 'Gagal memperbarui transaksi', success: false }, { status: 500 })
  }
}
