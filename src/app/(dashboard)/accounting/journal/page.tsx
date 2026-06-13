'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Send, Ban, Eye, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { ErrorState } from '@/components/ui/ErrorState'
import { DataTable } from '@/components/ui/DataTable'

type JournalStatus = 'DRAFT' | 'POSTED' | 'VOID'

interface JournalEntry {
  id: number
  accountId: number
  account: { code: string; name: string }
  debit: string
  credit: string
  description?: string
}

interface Journal {
  id: number
  journalNumber: string
  transactionDate: string
  referenceNumber?: string
  description: string
  status: JournalStatus
  entries: JournalEntry[]
  createdBy: { name: string }
}

const STATUS_CONFIG: Record<JournalStatus, { label: string; color: string }> = {
  DRAFT:  { label: 'Draft',    color: 'bg-surface-variant text-body-grey' },
  POSTED: { label: 'Posted',   color: 'bg-success-green/10 text-success-green border border-success-green/20' },
  VOID:   { label: 'Void',     color: 'bg-error-container text-on-error-container' },
}

async function fetchJournals() {
  const res = await fetch('/api/journals')
  const json = await res.json()
  if (!json.success) throw new Error(json.error)
  return json.data as Journal[]
}

async function fetchAccounts() {
  const res = await fetch('/api/accounts')
  const json = await res.json()
  if (!json.success) throw new Error(json.error)
  return json.data
}

function formatIDR(val: string | number) {
  return new Intl.NumberFormat('id-ID').format(Math.abs(parseFloat(String(val))))
}

export default function JournalPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [filterStatus, setFilterStatus] = useState('')
  const [viewJournal, setViewJournal] = useState<Journal | null>(null)

  const { data: journals = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['journals'],
    queryFn: fetchJournals,
  })

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: fetchAccounts,
    enabled: showForm,
  })

  const postMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/journals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'post' }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      return json
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['journals'] }),
    onError: (e: Error) => alert(`Gagal: ${e.message}`),
  })

  const voidMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/journals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'void' }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['journals'] }),
  })

  const filtered = journals.filter(j => !filterStatus || j.status === filterStatus)

  if (isError) return <ErrorState onRetry={refetch} />

  return (
    <>
      {/* View Detail Modal */}
      {viewJournal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-surface-bright rounded-xl shadow-overlay w-full max-w-2xl p-8 space-y-6 animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-headline-md font-bold text-on-surface">{viewJournal.journalNumber}</h2>
                <p className="text-body-md text-body-grey mt-1">{viewJournal.description}</p>
              </div>
              <span className={`badge ${STATUS_CONFIG[viewJournal.status].color}`}>{STATUS_CONFIG[viewJournal.status].label}</span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-label-sm text-body-grey">
              <div><span className="font-semibold">Tanggal:</span> {new Date(viewJournal.transactionDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
              <div><span className="font-semibold">Referensi:</span> {viewJournal.referenceNumber || '-'}</div>
              <div><span className="font-semibold">Dibuat oleh:</span> {viewJournal.createdBy.name}</div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-outline-variant">
              <table className="w-full text-sm">
                <thead className="table-header">
                  <tr><th>Akun</th><th>Keterangan</th><th className="text-right">Debit</th><th className="text-right">Kredit</th></tr>
                </thead>
                <tbody>
                  {viewJournal.entries.map(e => (
                    <tr key={e.id} className="border-b border-outline-variant/20">
                      <td className="py-2 px-4 font-data-mono text-primary">{e.account.code} - {e.account.name}</td>
                      <td className="py-2 px-4 text-body-grey">{e.description || '-'}</td>
                      <td className="py-2 px-4 text-right font-semibold">{parseFloat(e.debit) > 0 ? formatIDR(e.debit) : '-'}</td>
                      <td className="py-2 px-4 text-right font-semibold">{parseFloat(e.credit) > 0 ? formatIDR(e.credit) : '-'}</td>
                    </tr>
                  ))}
                  <tr className="bg-surface-container-low font-bold">
                    <td colSpan={2} className="py-2 px-4 text-on-surface">TOTAL</td>
                    <td className="py-2 px-4 text-right text-on-surface">{formatIDR(viewJournal.entries.reduce((s,e) => s+parseFloat(e.debit),0))}</td>
                    <td className="py-2 px-4 text-right text-on-surface">{formatIDR(viewJournal.entries.reduce((s,e) => s+parseFloat(e.credit),0))}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-3">
              {viewJournal.status === 'DRAFT' && (
                <button onClick={() => { postMutation.mutate(viewJournal.id); setViewJournal(null) }}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded text-label-sm font-bold hover:bg-primary-container transition-colors">
                  <Send className="w-4 h-4" /> Post Jurnal
                </button>
              )}
              <button onClick={() => setViewJournal(null)} className="px-4 py-2 border border-outline-variant rounded text-label-sm text-on-surface hover:bg-surface-container-low transition-colors">
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {showForm && <JournalForm accounts={accounts} onClose={() => setShowForm(false)} />}

      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-headline-lg font-bold text-on-surface">Jurnal Umum</h2>
          <p className="text-body-md text-body-grey mt-1">Pusat pencatatan transaksi <em>double-entry</em></p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded text-label-sm font-bold shadow-ambient hover:bg-primary-container transition-colors">
          <Plus className="w-4 h-4" /> Buat Jurnal
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-6 flex gap-2 flex-wrap items-center">
        <span className="text-label-sm text-body-grey font-medium mr-2">Filter Status:</span>
        {['', 'DRAFT', 'POSTED', 'VOID'].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`seg-btn ${filterStatus === s ? 'seg-btn-active' : ''}`}>
            {s || 'Semua'}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-6"><LoadingSkeleton rows={8} /></div>
        ) : (
          <DataTable<Journal>
            data={filtered}
            keyExtractor={j => String(j.id)}
            columns={[
              { header: 'No. Jurnal', accessor: 'journalNumber', className: 'font-data-mono font-semibold text-primary' },
              { header: 'Tanggal', accessor: j => new Date(j.transactionDate).toLocaleDateString('id-ID') },
              { header: 'Keterangan', accessor: 'description' },
              { header: 'Ref', accessor: j => j.referenceNumber || '-', className: 'text-body-grey text-label-sm' },
              { header: 'Status', accessor: j => <span className={`badge ${STATUS_CONFIG[j.status].color}`}>{STATUS_CONFIG[j.status].label}</span> },
              {
                header: 'Aksi',
                align: 'right',
                accessor: j => (
                  <div className="flex justify-end gap-2 text-body-grey">
                    <button onClick={() => setViewJournal(j)} className="p-1 hover:text-primary transition-colors" title="Lihat Detail">
                      <Eye className="w-4 h-4" />
                    </button>
                    {j.status === 'DRAFT' && (
                      <button onClick={() => postMutation.mutate(j.id)} className="p-1 hover:text-success-green transition-colors" title="Post Jurnal">
                        <Send className="w-4 h-4" />
                      </button>
                    )}
                    {j.status !== 'VOID' && (
                      <button onClick={() => { if(confirm('Void jurnal ini?')) voidMutation.mutate(j.id) }}
                        className="p-1 hover:text-error transition-colors" title="Void">
                        <Ban className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )
              }
            ]}
          />
        )}
      </div>
    </>
  )
}

// =====================
// Journal Create Form
// =====================
function JournalForm({ accounts, onClose }: { accounts: any[]; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({ transactionDate: new Date().toISOString().slice(0,10), referenceNumber: '', description: '' })
  const [entries, setEntries] = useState([
    { accountId: '', debit: '', credit: '', description: '' },
    { accountId: '', debit: '', credit: '', description: '' },
  ])
  const [error, setError] = useState('')

  const totalDebit = entries.reduce((s, e) => s + (parseFloat(e.debit) || 0), 0)
  const totalCredit = entries.reduce((s, e) => s + (parseFloat(e.credit) || 0), 0)
  const isBalanced = parseFloat(totalDebit.toFixed(2)) === parseFloat(totalCredit.toFixed(2))

  const addRow = () => setEntries(prev => [...prev, { accountId: '', debit: '', credit: '', description: '' }])
  const removeRow = (idx: number) => setEntries(prev => prev.filter((_, i) => i !== idx))
  const updateRow = (idx: number, key: string, val: string) =>
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, [key]: val } : e))

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/journals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          entries: entries.map(e => ({
            accountId: parseInt(e.accountId),
            debit: parseFloat(e.debit) || 0,
            credit: parseFloat(e.credit) || 0,
            description: e.description || undefined,
          })),
        }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      return json.data
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['journals'] }); onClose() },
    onError: (e: Error) => setError(e.message),
  })

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-surface-bright rounded-xl shadow-overlay w-full max-w-3xl my-8 p-8 space-y-6 animate-fade-in">
        <h2 className="text-headline-md font-bold text-on-surface">Buat Jurnal Umum</h2>

        {error && <div className="p-3 bg-error-container text-on-error-container text-sm rounded border border-error/20">{error}</div>}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1"><label className="text-label-sm text-on-surface-variant">Tanggal *</label>
            <input type="date" value={form.transactionDate} onChange={e => setForm(p => ({...p, transactionDate: e.target.value}))} className="input-field" /></div>
          <div className="space-y-1"><label className="text-label-sm text-on-surface-variant">No. Referensi</label>
            <input value={form.referenceNumber} onChange={e => setForm(p => ({...p, referenceNumber: e.target.value}))} placeholder="Opsional" className="input-field" /></div>
          <div className="md:col-span-1 space-y-1"><label className="text-label-sm text-on-surface-variant">Keterangan *</label>
            <input value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))} placeholder="Modal awal perusahaan" className="input-field" /></div>
        </div>

        {/* Entries Table */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-body-md font-semibold text-on-surface">Entri Debit/Kredit</h3>
            <button onClick={addRow} className="text-label-sm text-primary hover:underline flex items-center gap-1">
              <Plus className="w-3 h-3" /> Tambah Baris
            </button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-outline-variant">
            <table className="w-full text-sm">
              <thead className="table-header">
                <tr><th>Akun</th><th className="text-right">Debit (Rp)</th><th className="text-right">Kredit (Rp)</th><th>Keterangan</th><th></th></tr>
              </thead>
              <tbody>
                {entries.map((e, idx) => (
                  <tr key={idx} className="border-b border-outline-variant/20">
                    <td className="py-2 px-3">
                      <select value={e.accountId} onChange={ev => updateRow(idx, 'accountId', ev.target.value)}
                        className="w-full text-sm border border-outline-variant rounded px-2 py-1 focus:border-primary outline-none bg-surface-bright">
                        <option value="">— Pilih Akun —</option>
                        {accounts.filter(a => a.isActive && !a.children?.length).map((a: any) => (
                          <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 px-3">
                      <input type="number" value={e.debit} onChange={ev => updateRow(idx, 'debit', ev.target.value)}
                        placeholder="0" className="w-full text-sm text-right border border-outline-variant rounded px-2 py-1 focus:border-primary outline-none bg-surface-bright" />
                    </td>
                    <td className="py-2 px-3">
                      <input type="number" value={e.credit} onChange={ev => updateRow(idx, 'credit', ev.target.value)}
                        placeholder="0" className="w-full text-sm text-right border border-outline-variant rounded px-2 py-1 focus:border-primary outline-none bg-surface-bright" />
                    </td>
                    <td className="py-2 px-3">
                      <input value={e.description} onChange={ev => updateRow(idx, 'description', ev.target.value)}
                        placeholder="Opsional" className="w-full text-sm border border-outline-variant rounded px-2 py-1 focus:border-primary outline-none bg-surface-bright" />
                    </td>
                    <td className="py-2 px-2">
                      {entries.length > 2 && (
                        <button onClick={() => removeRow(idx)} className="text-body-grey hover:text-error transition-colors p-1">✕</button>
                      )}
                    </td>
                  </tr>
                ))}
                {/* Totals row */}
                <tr className={`font-bold ${isBalanced ? 'bg-success-green/5' : 'bg-error-container/30'}`}>
                  <td className="py-2 px-3 text-on-surface">TOTAL</td>
                  <td className="py-2 px-3 text-right">{new Intl.NumberFormat('id-ID').format(totalDebit)}</td>
                  <td className="py-2 px-3 text-right">{new Intl.NumberFormat('id-ID').format(totalCredit)}</td>
                  <td colSpan={2} className="py-2 px-3">
                    {isBalanced
                      ? <span className="flex items-center gap-1 text-success-green text-xs"><CheckCircle2 className="w-3 h-3" /> Balance</span>
                      : <span className="flex items-center gap-1 text-error text-xs"><AlertTriangle className="w-3 h-3" /> Tidak Balance</span>}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-outline-variant/30">
          <button onClick={onClose} className="px-4 py-2 border border-outline-variant rounded text-label-sm text-on-surface hover:bg-surface-container-low transition-colors">
            Batal
          </button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending || !isBalanced}
            className="flex items-center gap-2 px-6 py-2 bg-primary text-on-primary rounded text-label-sm font-bold hover:bg-primary-container transition-colors disabled:opacity-50">
            {mutation.isPending ? 'Menyimpan...' : <><Plus className="w-4 h-4" /> Simpan sebagai Draft</>}
          </button>
        </div>
      </div>
    </div>
  )
}
