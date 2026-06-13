import type { User } from '@/types'

export const mockUsers: User[] = [
  {
    id: 'user-001',
    name: 'Ahmad Fauzi',
    email: 'admin@beinsoft.com',
    role: 'super_admin',
    avatar: 'AF',
    department: 'IT & Operations',
  },
  {
    id: 'user-002',
    name: 'Budi Santoso',
    email: 'owner@beinsoft.com',
    role: 'owner',
    avatar: 'BS',
    department: 'Executive',
  },
  {
    id: 'user-003',
    name: 'Citra Dewi',
    email: 'accountant@beinsoft.com',
    role: 'accountant',
    avatar: 'CD',
    department: 'Finance & Accounting',
  },
  {
    id: 'user-004',
    name: 'Dian Pratama',
    email: 'viewer@beinsoft.com',
    role: 'viewer',
    avatar: 'DP',
    department: 'Management',
  },
]
