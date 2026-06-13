'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit2, Power, Search, ChevronRight } from 'lucide-react'
import { DataTable } from '@/components/ui/DataTable'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { ErrorState } from '@/components/ui/ErrorState'

type AccountCategory = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE'
type NormalBalance = 'DEBIT' | 'CREDIT'

interface Account {
  id: number
  code: string
  name: string
  category: AccountCategory
  normalBalance: NormalBalance
  isActive: boolean
  parentId?: number | null
  parent?: { code: string; name: string } | null
  children?: Account[]
}

const CATEGORY_CONFIG: Record<AccountCategory, { label: string; color: string }> = {
  ASSET:     { label: 'Aset',        color: 'bg-primary/10 text-primary' },
  LIABILITY: { label: 'Kewajiban',   color: 'bg-tertiary-container/10 text-tertiary-container' },
  EQUITY:    { label: 'Modal',       color: 'bg-success-green/10 text-success-green' },
  REVENUE:   { label: 'Pendapatan',  color: 'bg-vibrant-cyan/10 text-vibrant-cyan' },
  EXPENSE:   { label: 'Beban',       color: 'bg-surface-variant text-body-grey' },
}

async function fetchAccounts(category?: string) {
  const q = category ? `?category=${category}` : ''
  const res = await fetch(`/api/accounts${q}`)
  const json = await res.json()
  if (!json.success) throw new Error(json.error)
  return json.data as Account[]
}

interface AccountFormProps {
  onClose: () => void
  accounts: Account[]
  editAccount?: Account | null
}

function AccountForm({ onClose, accounts, editAccount }: AccountFormProps) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    code: editAccount?.code ?? '',
    name: editAccount?.name ?? '',
    category: editAccount?.category ?? 'ASSET',
    normalBalance: editAccount?.normalBalance ?? 'DEBIT',
    parentId: editAccount?.parentId ? String(editAccount.parentId) : '',
  })
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const url = editAccount ? `/api/accounts/${editAccount.id}` : '/api/accounts'
      const method = editAccount ? 'PATCH' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      return json.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      onClose()
    },
    onError: (e: Error) => setError(e.message),
  })

  const handleCategoryChange = (cat: AccountCategory) => {
    const normalBalance = ['ASSET', 'EXPENSE'].includes(cat) ? 'DEBIT' : 'CREDIT'
    setForm(prev => ({ ...prev, category: cat, normalBalance }))
  }

  const parentOptions = accounts.filter(a => !a.parent && a.category === form.category && a.id !== editAccount?.id)

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-surface-bright rounded-xl shadow-overlay w-full max-w-lg p-8 space-y-6 animate-fade-in">
        <h2 className="text-headline-md font-bold text-on-surface">
          {editAccount ? 'Edit Akun' : 'Tambah Akun Baru'}
        </h2>

        {error && (
          <div className="p-3 bg-error-container text-on-error-container text-sm rounded border border-error/20">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-label-sm text-on-surface-variant">Kode Akun *</label>
            <input value={form.code} onChange={e => setForm(p => ({...p, code: e.target.value}))}
              placeholder="1100" className="input-field" disabled={!!editAccount} />
          </div>
          <div className="space-y-2">
            <label className="block text-label-sm text-on-surface-variant">Nama Akun *</label>
            <input value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))}
              placeholder="Kas" className="input-field" />
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-label-sm text-on-surface-variant">Kategori *</label>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(CATEGORY_CONFIG) as AccountCategory[]).map(cat => (
              <button key={cat} type="button" onClick={() => handleCategoryChange(cat)}
                className={`px-3 py-1.5 rounded text-label-sm font-medium border transition-colors
                  ${form.category === cat ? 'border-primary bg-primary text-on-primary' : 'border-outline-variant text-on-surface-variant hover:border-primary/50'}`}>
                {CATEGORY_CONFIG[cat].label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-label-sm text-on-surface-variant">Normal Balance</label>
            <input value={form.normalBalance} className="input-field bg-surface-container-low" readOnly />
            <p className="text-xs text-body-grey">Ditentukan otomatis dari kategori</p>
          </div>
          <div className="space-y-2">
            <label className="block text-label-sm text-on-surface-variant">Akun Induk (Opsional)</label>
            <select value={form.parentId} onChange={e => setForm(p => ({...p, parentId: e.target.value}))} className="input-field">
              <option value="">— Tidak ada —</option>
              {parentOptions.map(a => (
                <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-outline-variant/30">
          <button onClick={onClose} className="px-4 py-2 border border-outline-variant rounded text-label-sm text-on-surface hover:bg-surface-container-low transition-colors">
            Batal
          </button>
          <button onClick={() => mutation.mutate(form)} disabled={mutation.isPending}
            className="px-6 py-2 bg-primary text-on-primary rounded text-label-sm font-bold hover:bg-primary-container transition-colors disabled:opacity-50">
            {mutation.isPending ? 'Menyimpan...' : (editAccount ? 'Simpan Perubahan' : 'Tambah Akun')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function COAPage() {
  const [filterCategory, setFilterCategory] = useState<string>('')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editAccount, setEditAccount] = useState<Account | null>(null)
  const queryClient = useQueryClient()

  const { data: accounts = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['accounts', filterCategory],
    queryFn: () => fetchAccounts(filterCategory || undefined),
  })

  const deactivateMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const res = await fetch(`/api/accounts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['accounts'] }),
  })

  const filtered = accounts.filter(a =>
    a.code.includes(search) || a.name.toLowerCase().includes(search.toLowerCase())
  )

  if (isError) return <ErrorState onRetry={refetch} />

  return (
    <>
      {(showForm || editAccount) && (
        <AccountForm
          accounts={accounts}
          editAccount={editAccount}
          onClose={() => { setShowForm(false); setEditAccount(null) }}
        />
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-headline-lg font-bold text-on-surface">Chart of Accounts (COA)</h2>
          <p className="text-body-md text-body-grey mt-1">Master data akun akuntansi perusahaan</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded text-label-sm font-bold shadow-ambient hover:bg-primary-container transition-colors">
          <Plus className="w-4 h-4" />
          Tambah Akun
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-6 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-body-grey" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Cari kode atau nama akun..." className="w-full pl-9 pr-4 py-2 input-field" />
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setFilterCategory('')}
            className={`seg-btn ${!filterCategory ? 'seg-btn-active' : ''}`}>Semua</button>
          {(Object.entries(CATEGORY_CONFIG)).map(([key, val]) => (
            <button key={key} onClick={() => setFilterCategory(key === filterCategory ? '' : key)}
              className={`seg-btn ${filterCategory === key ? 'seg-btn-active' : ''}`}>{val.label}</button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {(Object.entries(CATEGORY_CONFIG)).map(([key, val]) => {
          const count = accounts.filter(a => a.category === key).length
          return (
            <div key={key} className="card p-4 text-center cursor-pointer hover:border-primary/30 transition-colors" onClick={() => setFilterCategory(key)}>
              <div className={`badge ${val.color} mx-auto mb-2 text-xs`}>{val.label}</div>
              <div className="text-2xl font-bold text-on-surface">{count}</div>
              <div className="text-xs text-body-grey mt-1">Akun</div>
            </div>
          )
        })}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-6"><LoadingSkeleton rows={8} /></div>
        ) : (
          <DataTable<Account>
            data={filtered}
            keyExtractor={a => String(a.id)}
            columns={[
              { header: 'Kode', accessor: 'code', className: 'font-data-mono font-semibold text-primary' },
              {
                header: 'Nama Akun',
                accessor: a => (
                  <div>
                    <div className="font-medium text-on-surface">{a.name}</div>
                    {a.parent && <div className="text-xs text-body-grey flex items-center gap-1 mt-0.5"><ChevronRight className="w-3 h-3" />{a.parent.name}</div>}
                  </div>
                )
              },
              {
                header: 'Kategori',
                accessor: a => (
                  <span className={`badge ${CATEGORY_CONFIG[a.category].color}`}>
                    {CATEGORY_CONFIG[a.category].label}
                  </span>
                )
              },
              { header: 'Normal Balance', accessor: 'normalBalance', className: 'text-body-grey text-label-sm' },
              {
                header: 'Status',
                accessor: a => (
                  <span className={`badge ${a.isActive ? 'bg-success-green/10 text-success-green border border-success-green/20' : 'bg-surface-variant text-body-grey'}`}>
                    {a.isActive ? 'Aktif' : 'Nonaktif'}
                  </span>
                )
              },
              {
                header: 'Aksi',
                align: 'right',
                accessor: a => (
                  <div className="flex items-center justify-end gap-2 text-body-grey">
                    <button onClick={() => setEditAccount(a)} className="p-1 hover:text-primary transition-colors" title="Edit">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deactivateMutation.mutate({ id: a.id, isActive: !a.isActive })}
                      className={`p-1 transition-colors ${a.isActive ? 'hover:text-error' : 'hover:text-success-green'}`}
                      title={a.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                    >
                      <Power className="w-4 h-4" />
                    </button>
                  </div>
                )
              },
            ]}
          />
        )}
      </div>
    </>
  )
}
