import { NextResponse } from 'next/server'
import { mockRoles } from '@/mock/roles'

export async function GET() {
  return NextResponse.json({ data: mockRoles, success: true })
}
