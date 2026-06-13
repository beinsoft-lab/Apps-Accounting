'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Book, Download } from 'lucide-react'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { ErrorState } from '@/components/ui/ErrorState'
import { EmptyState } from '@/components/ui/EmptyState'

interface LedgerEntry {
  id: number
  transactionDate: string
  description: string
  debit: string
  credit: string
  runningBalance: string
  account: { id: number; code: string; name: string; category: string; normalBalance: string }
  journal: { journalNumber: string; description: string }
}

interface LedgerMeta {
  total: number; totalDebit: number; totalCredit: number
}

function formatIDR(v: string | number) {
  const n = parseFloat(String(v))
  if (n === 0) return '-'
  return new Intl.NumberFormat('id-ID').format(Math.abs(n))
}

async function fetchAccounts() {
  const res = await fetch('/api/accounts')
  const json = await res.json()
  return json.data
}

async function fetchLedger(accountId: string, from: string, to: string) {
  const params = new URLSearchParams()
  if (accountId) params.set('accountId', accountId)
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  params.set('limit', '100')

  const res = await fetch(`/api/ledger?${params.toString()}`)
  const json = await res.json()
  if (!json.success) throw new Error(json.error)
  return { data: json.data as LedgerEntry[], meta: json.meta as LedgerMeta }
}

export default function LedgerPage() {
  const now = new Date()
  const [accountId, setAccountId] = useState('')
  const [dateFrom, setDateFrom] = useState(`${now.getFullYear()}-01-01`)
  const [dateTo, setDateTo] = useState(now.toISOString().slice(0, 10))

  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: fetchAccounts })
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['ledger', accountId, dateFrom, dateTo],
    queryFn: () => fetchLedger(accountId, dateFrom, dateTo),
  })

  const entries = data?.data ?? []
  const meta = data?.meta

  const selectedAccount = accounts.find((a: any) => String(a.id) === accountId)

  if (isError) return <ErrorState onRetry={refetch} />

  return (
    <>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-headline-lg font-bold text-on-surface">Buku Besar</h2>
          <p className="text-body-md text-body-grey mt-1">Mutasi dan saldo per akun — data dari General Ledger</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 border border-outline-variant rounded text-label-sm font-medium hover:bg-surface-container-low transition-colors text-on-surface">
          <Download className="w-4 h-4" /> Export PDF
        </button>
      </div>

      {/* Filters */}
      <div className="card p-gutter-lg mb-6">
        <h3 className="text-label-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-4">Filter</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-label-sm text-on-surface-variant">Akun</label>
            <select value={accountId} onChange={e => setAccountId(e.target.value)} className="input-field">
              <option value="">— Semua Akun —</option>
              {accounts.filter((a: any) => a.isActive).map((a: any) => (
                <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-label-sm text-on-surface-variant">Dari Tanggal</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input-field" />
          </div>
          <div className="space-y-1">
            <label className="text-label-sm text-on-surface-variant">Sampai Tanggal</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input-field" />
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {meta && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="card p-4 text-center">
            <p className="text-label-sm text-body-grey uppercase tracking-wider mb-1">Total Debit</p>
            <p className="text-xl font-bold text-on-surface">Rp {new Intl.NumberFormat('id-ID').format(meta.totalDebit)}</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-label-sm text-body-grey uppercase tracking-wider mb-1">Total Kredit</p>
            <p className="text-xl font-bold text-on-surface">Rp {new Intl.NumberFormat('id-ID').format(meta.totalCredit)}</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-label-sm text-body-grey uppercase tracking-wider mb-1">Saldo Akhir</p>
            <p className={`text-xl font-bold ${entries.length > 0 ? 'text-primary' : 'text-body-grey'}`}>
              {entries.length > 0 ? `Rp ${new Intl.NumberFormat('id-ID').format(parseFloat(entries[entries.length-1].runningBalance))}` : '-'}
            </p>
          </div>
        </div>
      )}

      {/* Ledger Table */}
      <div className="card overflow-hidden">
        {selectedAccount && (
          <div className="p-gutter-lg border-b border-outline-variant flex items-center gap-3 bg-primary/3">
            <Book className="w-5 h-5 text-primary" />
            <div>
              <span className="font-bold text-primary">{selectedAccount.code}</span>
              <span className="text-on-surface font-semibold ml-2">{selectedAccount.name}</span>
              <span className="text-label-sm text-body-grey ml-2">({selectedAccount.category} | Normal: {selectedAccount.normalBalance})</span>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="p-6"><LoadingSkeleton rows={8} /></div>
        ) : entries.length === 0 ? (
          <EmptyState title="Tidak Ada Entri Buku Besar" message="Belum ada jurnal yang diposting untuk filter yang dipilih." icon={<Book className="w-6 h-6" />} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header">
                  <th>Tanggal</th>
                  <th>No. Jurnal</th>
                  <th>Keterangan</th>
                  {!accountId && <th>Akun</th>}
                  <th className="text-right">Debit</th>
                  <th className="text-right">Kredit</th>
                  <th className="text-right">Saldo Berjalan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20 bg-surface-container-lowest">
                {entries.map(e => (
                  <tr key={e.id} className="hover:bg-primary/3 transition-colors">
                    <td className="py-3 px-6 font-data-mono text-body-grey text-xs">{new Date(e.transactionDate).toLocaleDateString('id-ID')}</td>
                    <td className="py-3 px-6 font-data-mono text-primary text-xs">{e.journal.journalNumber}</td>
                    <td className="py-3 px-6 text-on-surface">{e.description}</td>
                    {!accountId && <td className="py-3 px-6 text-body-grey text-xs">{e.account.code} - {e.account.name}</td>}
                    <td className="py-3 px-6 text-right font-semibold text-on-surface">{formatIDR(e.debit)}</td>
                    <td className="py-3 px-6 text-right font-semibold text-on-surface">{formatIDR(e.credit)}</td>
                    <td className={`py-3 px-6 text-right font-bold ${parseFloat(e.runningBalance) >= 0 ? 'text-success-green' : 'text-error'}`}>
                      Rp {new Intl.NumberFormat('id-ID').format(Math.abs(parseFloat(e.runningBalance)))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
