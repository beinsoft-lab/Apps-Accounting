import { NextResponse } from 'next/server'
import { mockUsers } from '@/mock/users'

export async function GET() {
  return NextResponse.json({ data: mockUsers, success: true })
}
