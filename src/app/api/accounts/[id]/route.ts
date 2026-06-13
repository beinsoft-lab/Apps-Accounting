import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/accounts/[id] — Get single account
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const account = await prisma.account.findUnique({
      where: { id: parseInt(id) },
      include: {
        parent: { select: { id: true, code: true, name: true } },
        children: { select: { id: true, code: true, name: true, isActive: true } },
      },
    })

    if (!account) {
      return NextResponse.json({ error: 'Account not found', success: false }, { status: 404 })
    }

    return NextResponse.json({ data: account, success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch account', success: false }, { status: 500 })
  }
}

// PATCH /api/accounts/[id] — Update account
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await req.json()
    const { name, isActive, parentId } = body
    const { id: paramId } = await params
    const id = parseInt(paramId)

    // Cannot deactivate account if it has un-voided journal entries
    if (isActive === false) {
      const activeEntries = await prisma.journalEntry.count({
        where: {
          accountId: id,
          journal: { status: 'POSTED' },
        },
      })
      if (activeEntries > 0) {
        return NextResponse.json({
          error: 'Cannot deactivate account with existing posted journal entries',
          success: false,
        }, { status: 422 })
      }
    }

    const account = await prisma.account.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
        ...(parentId !== undefined ? { parentId: parentId ? parseInt(parentId) : null } : {}),
      },
    })

    return NextResponse.json({ data: account, success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update account', success: false }, { status: 500 })
  }
}
