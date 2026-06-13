import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AccountCategory, NormalBalance } from '@prisma/client'

// GET /api/accounts — List all accounts
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category') as AccountCategory | null
    const activeOnly = searchParams.get('active') !== 'false'

    const accounts = await prisma.account.findMany({
      where: {
        ...(category ? { category } : {}),
        ...(activeOnly ? { isActive: true } : {}),
      },
      include: {
        parent: { select: { id: true, code: true, name: true } },
        children: { select: { id: true, code: true, name: true, isActive: true } },
      },
      orderBy: { code: 'asc' },
    })

    return NextResponse.json({ data: accounts, success: true })
  } catch (error) {
    console.error('[GET /api/accounts]', error)
    return NextResponse.json({ error: 'Failed to fetch accounts', success: false }, { status: 500 })
  }
}

// POST /api/accounts — Create a new account
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { code, name, category, normalBalance, parentId } = body

    // Validation
    if (!code || !name || !category || !normalBalance) {
      return NextResponse.json({ error: 'Missing required fields: code, name, category, normalBalance', success: false }, { status: 400 })
    }

    // Check unique code
    const existing = await prisma.account.findUnique({ where: { code } })
    if (existing) {
      return NextResponse.json({ error: `Account code '${code}' already exists`, success: false }, { status: 409 })
    }

    const account = await prisma.account.create({
      data: {
        code,
        name,
        category: category as AccountCategory,
        normalBalance: normalBalance as NormalBalance,
        parentId: parentId ? parseInt(parentId) : null,
      },
    })

    return NextResponse.json({ data: account, success: true }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/accounts]', error)
    return NextResponse.json({ error: 'Failed to create account', success: false }, { status: 500 })
  }
}
