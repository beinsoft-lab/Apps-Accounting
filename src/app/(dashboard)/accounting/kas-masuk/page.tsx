'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Send, Ban, Eye, ArrowDownToLine } from 'lucide-react'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { ErrorState } from '@/components/ui/ErrorState'
import { DataTable } from '@/components/ui/DataTable'

type JournalStatus = 'DRAFT' | 'POSTED' | 'VOID'

interface CashAccount { id: number; code: string; name: string; category?: string }
interface JournalEntry { id: number; account: CashAccount; debit: string; credit: string }
interface CashJournal  { id: number; journalNumber: string; status: JournalStatus; entries?: JournalEntry[] }

interface CashTransaction {
  id: number
  transactionNumber: string
  type: 'IN' | 'OUT'
  transactionDate:   string
  amount:            string
  description:       string
  referenceNumber?:  string
  partyName?:        string
  cashAccount:       CashAccount
  counterpartAccount: CashAccount
  journal:           CashJournal
  createdAt:         string
}

interface CashMeta {
  total:          number
  page:           number
  totalPages:     number
  totalAmountIn:  number
  totalAmountOut: number
}

const STATUS_CFG: Record<JournalStatus, { label: string; color: string }> = {
  DRAFT:  { label: 'Draft',  color: 'bg-surface-variant text-body-grey' },
  POSTED: { label: 'Posted', color: 'bg-success-green/10 text-success-green border border-success-green/20' },
  VOID:   { label: 'Void',   color: 'bg-error-container text-on-error-container' },
}

function fmtIDR(val: string | number) {
  return new Intl.NumberFormat('id-ID').format(Math.abs(parseFloat(String(val))))
}

async function fetchCash(filterStatus: string) {
  const p = new URLSearchParams({ type: 'IN', limit: '100' })
  if (filterStatus) p.set('status', filterStatus)
  const res  = await fetch(`/api/cash?${p}`)
  const json = await res.json()
  if (!json.success) throw new Error(json.error)
  return json as { data: CashTransaction[]; meta: CashMeta }
}

async function fetchAccounts() {
  const res  = await fetch('/api/accounts')
  const json = await res.json()
  if (!json.success) throw new Error(json.error)
  return json.data as (CashAccount & { children?: { id: number }[] })[]
}

// ──────────────────────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────────────────────
export default function KasMasukPage() {
  const qc            = useQueryClient()
  const [filterStatus, setFilterStatus] = useState('')
  const [showForm,     setShowForm]     = useState(false)
  const [viewTx,       setViewTx]       = useState<CashTransaction | null>(null)

  const { data: resp, isLoading, isError, refetch } = useQuery({
    queryKey: ['cash', 'IN', filterStatus],
    queryFn:  () => fetchCash(filterStatus),
  })

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn:  fetchAccounts,
    enabled:  showForm,
  })

  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      const res  = await fetch(`/api/cash/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body:   JSON.stringify({ action: 'approve' }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      return json
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cash'] }); setViewTx(null) },
    onError:   (e: Error) => alert(`Gagal: ${e.message}`),
  })

  const voidMutation = useMutation({
    mutationFn: async (id: number) => {
      const res  = await fetch(`/api/cash/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body:   JSON.stringify({ action: 'void' }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cash'] }); setViewTx(null) },
    onError:   (e: Error) => alert(`Gagal: ${e.message}`),
  })

  const transactions = resp?.data ?? []
  const meta         = resp?.meta

  if (isError) return <ErrorState onRetry={refetch} />

  return (
    <>
      {showForm && (
        <KasMasukForm
          accounts={accounts}
          onClose={() => setShowForm(false)}
        />
      )}

      {viewTx && (
        <DetailModal
          tx={viewTx}
          onClose={() => setViewTx(null)}
          onApprove={() => approveMutation.mutate(viewTx.id)}
          onVoid={() => { if (confirm('Void transaksi ini? Aksi ini tidak dapat dibatalkan.')) voidMutation.mutate(viewTx.id) }}
          isApproving={approveMutation.isPending}
          isVoiding={voidMutation.isPending}
        />
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-headline-lg font-bold text-on-surface">Kas Masuk</h2>
          <p className="text-body-md text-body-grey mt-1">Pencatatan penerimaan kas dan bank</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded text-label-sm font-bold shadow-ambient hover:bg-primary-container transition-colors"
        >
          <Plus className="w-4 h-4" /> Tambah Kas Masuk
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-success-green/10 flex items-center justify-center shrink-0">
            <ArrowDownToLine className="w-5 h-5 text-success-green" />
          </div>
          <div>
            <p className="text-label-sm text-body-grey">Total Diterima (Posted)</p>
            <p className="text-xl font-bold text-success-green">Rp {fmtIDR(meta?.totalAmountIn ?? 0)}</p>
          </div>
        </div>
        <div className="card p-5">
          <p className="text-label-sm text-body-grey mb-1">Menunggu Posting (Draft)</p>
          <p className="text-2xl font-bold text-on-surface">
            {transactions.filter(t => t.journal.status === 'DRAFT').length}
            <span className="text-body-md font-normal text-body-grey ml-1">transaksi</span>
          </p>
        </div>
        <div className="card p-5">
          <p className="text-label-sm text-body-grey mb-1">Total Transaksi</p>
          <p className="text-2xl font-bold text-on-surface">
            {meta?.total ?? 0}
            <span className="text-body-md font-normal text-body-grey ml-1">entri</span>
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-6 flex gap-2 flex-wrap items-center">
        <span className="text-label-sm text-body-grey font-medium mr-2">Filter Status:</span>
        {['', 'DRAFT', 'POSTED', 'VOID'].map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`seg-btn ${filterStatus === s ? 'seg-btn-active' : ''}`}
          >
            {s || 'Semua'}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-6"><LoadingSkeleton rows={8} /></div>
        ) : (
          <DataTable<CashTransaction>
            data={transactions}
            keyExtractor={t => String(t.id)}
            columns={[
              {
                header: 'No. Transaksi',
                accessor: 'transactionNumber',
                className: 'font-data-mono font-semibold text-primary',
              },
              {
                header: 'Tanggal',
                accessor: t => new Date(t.transactionDate).toLocaleDateString('id-ID', {
                  day: '2-digit', month: 'short', year: 'numeric',
                }),
              },
              {
                header: 'Diterima Dari',
                accessor: t => t.partyName || '-',
                className: 'text-body-grey',
              },
              {
                header: 'Akun Kas',
                accessor: t => `${t.cashAccount.code} - ${t.cashAccount.name}`,
                className: 'text-label-sm',
              },
              {
                header: 'Akun Sumber',
                accessor: t => `${t.counterpartAccount.code} - ${t.counterpartAccount.name}`,
                className: 'text-label-sm text-body-grey',
              },
              {
                header: 'Nominal',
                align:  'right',
                accessor: t => (
                  <span className="font-semibold text-success-green">Rp {fmtIDR(t.amount)}</span>
                ),
              },
              {
                header: 'Status',
                accessor: t => (
                  <span className={`badge ${STATUS_CFG[t.journal.status].color}`}>
                    {STATUS_CFG[t.journal.status].label}
                  </span>
                ),
              },
              {
                header: 'Aksi',
                align:  'right',
                accessor: t => (
                  <div className="flex justify-end gap-2 text-body-grey">
                    <button onClick={() => setViewTx(t)} className="p-1 hover:text-primary transition-colors" title="Lihat Detail">
                      <Eye className="w-4 h-4" />
                    </button>
                    {t.journal.status === 'DRAFT' && (
                      <button
                        onClick={() => approveMutation.mutate(t.id)}
                        disabled={approveMutation.isPending}
                        className="p-1 hover:text-success-green transition-colors disabled:opacity-40"
                        title="Post ke Buku Besar"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    )}
                    {t.journal.status !== 'VOID' && (
                      <button
                        onClick={() => { if (confirm('Void transaksi ini?')) voidMutation.mutate(t.id) }}
                        disabled={voidMutation.isPending}
                        className="p-1 hover:text-error transition-colors disabled:opacity-40"
                        title="Void"
                      >
                        <Ban className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ),
              },
            ]}
          />
        )}
      </div>
    </>
  )
}

// ──────────────────────────────────────────────────────────────
// Create Form Modal
// ──────────────────────────────────────────────────────────────
function KasMasukForm({
  accounts,
  onClose,
}: {
  accounts: (CashAccount & { children?: { id: number }[] })[]
  onClose:  () => void
}) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    transactionDate:      new Date().toISOString().slice(0, 10),
    amount:               '',
    cashAccountId:        '',
    counterpartAccountId: '',
    description:          '',
    referenceNumber:      '',
    partyName:            '',
  })
  const [error, setError] = useState('')

  // Filter helpers
  const cashOptions        = accounts.filter(a => a.category === 'ASSET' && !a.children?.length)
  const counterpartOptions = accounts.filter(a => !a.children?.length)

  // Selected account names for preview
  const selectedCash        = accounts.find(a => String(a.id) === form.cashAccountId)
  const selectedCounterpart = accounts.find(a => String(a.id) === form.counterpartAccountId)

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/cash', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          type:                 'IN',
          transactionDate:      form.transactionDate,
          amount:               parseFloat(form.amount),
          cashAccountId:        parseInt(form.cashAccountId),
          counterpartAccountId: parseInt(form.counterpartAccountId),
          description:          form.description,
          referenceNumber:      form.referenceNumber || undefined,
          partyName:            form.partyName       || undefined,
        }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      return json.data
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cash'] }); onClose() },
    onError:   (e: Error) => setError(e.message),
  })

  const amountNum    = parseFloat(form.amount) || 0
  const canSubmit    = form.transactionDate && form.amount && parseFloat(form.amount) > 0 &&
                       form.cashAccountId && form.counterpartAccountId && form.description.trim()

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-surface-bright rounded-xl shadow-overlay w-full max-w-2xl my-8 p-8 space-y-6 animate-fade-in">
        <h2 className="text-headline-md font-bold text-on-surface">Tambah Kas Masuk</h2>

        {error && (
          <div className="p-3 bg-error-container text-on-error-container text-sm rounded border border-error/20">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-label-sm text-on-surface-variant">Tanggal Transaksi *</label>
            <input
              type="date"
              value={form.transactionDate}
              onChange={e => setForm(p => ({ ...p, transactionDate: e.target.value }))}
              className="input-field"
            />
          </div>
          <div className="space-y-1">
            <label className="text-label-sm text-on-surface-variant">Nominal (Rp) *</label>
            <input
              type="number"
              min="0"
              step="1"
              value={form.amount}
              onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
              placeholder="5000000"
              className="input-field"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-label-sm text-on-surface-variant">Akun Kas (Tujuan) *</label>
            <select
              value={form.cashAccountId}
              onChange={e => setForm(p => ({ ...p, cashAccountId: e.target.value }))}
              className="input-field"
            >
              <option value="">— Pilih akun kas/bank —</option>
              {cashOptions.map(a => (
                <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-label-sm text-on-surface-variant">Akun Sumber *</label>
            <select
              value={form.counterpartAccountId}
              onChange={e => setForm(p => ({ ...p, counterpartAccountId: e.target.value }))}
              className="input-field"
            >
              <option value="">— Dari akun mana? —</option>
              {counterpartOptions.map(a => (
                <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-label-sm text-on-surface-variant">Keterangan *</label>
          <input
            value={form.description}
            onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            placeholder="Pembayaran dari PT ABC"
            className="input-field"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-label-sm text-on-surface-variant">Diterima Dari</label>
            <input
              value={form.partyName}
              onChange={e => setForm(p => ({ ...p, partyName: e.target.value }))}
              placeholder="Nama pelanggan / pembayar"
              className="input-field"
            />
          </div>
          <div className="space-y-1">
            <label className="text-label-sm text-on-surface-variant">No. Referensi</label>
            <input
              value={form.referenceNumber}
              onChange={e => setForm(p => ({ ...p, referenceNumber: e.target.value }))}
              placeholder="INV-001, dsb. (opsional)"
              className="input-field"
            />
          </div>
        </div>

        {/* Double-Entry Preview */}
        {(selectedCash || selectedCounterpart) && amountNum > 0 && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
            <p className="text-label-sm text-primary font-semibold mb-3">Jurnal yang akan dibuat:</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-on-surface-variant text-xs uppercase">
                  <th className="text-left pb-1">Posisi</th>
                  <th className="text-left pb-1">Akun</th>
                  <th className="text-right pb-1">Debit</th>
                  <th className="text-right pb-1">Kredit</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="py-1 text-primary font-semibold text-xs">Dr</td>
                  <td className="py-1">{selectedCash ? `${selectedCash.code} - ${selectedCash.name}` : '—'}</td>
                  <td className="py-1 text-right font-semibold text-success-green">Rp {fmtIDR(amountNum)}</td>
                  <td className="py-1 text-right text-body-grey">—</td>
                </tr>
                <tr>
                  <td className="py-1 text-on-surface-variant font-semibold text-xs">Cr</td>
                  <td className="py-1 pl-4">{selectedCounterpart ? `${selectedCounterpart.code} - ${selectedCounterpart.name}` : '—'}</td>
                  <td className="py-1 text-right text-body-grey">—</td>
                  <td className="py-1 text-right font-semibold text-success-green">Rp {fmtIDR(amountNum)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t border-outline-variant/30">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-outline-variant rounded text-label-sm text-on-surface hover:bg-surface-container-low transition-colors"
          >
            Batal
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !canSubmit}
            className="flex items-center gap-2 px-6 py-2 bg-primary text-on-primary rounded text-label-sm font-bold hover:bg-primary-container transition-colors disabled:opacity-50"
          >
            {mutation.isPending ? 'Menyimpan...' : <><Plus className="w-4 h-4" /> Simpan sebagai Draft</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// Detail Modal
// ──────────────────────────────────────────────────────────────
function DetailModal({
  tx,
  onClose,
  onApprove,
  onVoid,
  isApproving,
  isVoiding,
}: {
  tx:          CashTransaction
  onClose:     () => void
  onApprove:   () => void
  onVoid:      () => void
  isApproving: boolean
  isVoiding:   boolean
}) {
  const status = tx.journal.status

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-surface-bright rounded-xl shadow-overlay w-full max-w-2xl p-8 space-y-6 animate-fade-in max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-headline-md font-bold text-on-surface font-data-mono">{tx.transactionNumber}</h2>
            <p className="text-body-md text-body-grey mt-1">{tx.description}</p>
          </div>
          <span className={`badge ${STATUS_CFG[status].color}`}>{STATUS_CFG[status].label}</span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-label-sm">
          <div><span className="text-body-grey">Tanggal:</span>{' '}
            <span className="font-medium">{new Date(tx.transactionDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
          </div>
          <div><span className="text-body-grey">Nominal:</span>{' '}
            <span className="font-bold text-success-green">Rp {fmtIDR(tx.amount)}</span>
          </div>
          <div><span className="text-body-grey">Akun Kas:</span>{' '}
            <span className="font-data-mono">{tx.cashAccount.code} - {tx.cashAccount.name}</span>
          </div>
          <div><span className="text-body-grey">Akun Sumber:</span>{' '}
            <span className="font-data-mono">{tx.counterpartAccount.code} - {tx.counterpartAccount.name}</span>
          </div>
          {tx.partyName && (
            <div><span className="text-body-grey">Diterima dari:</span>{' '}
              <span className="font-medium">{tx.partyName}</span>
            </div>
          )}
          {tx.referenceNumber && (
            <div><span className="text-body-grey">Referensi:</span>{' '}
              <span className="font-medium">{tx.referenceNumber}</span>
            </div>
          )}
          <div><span className="text-body-grey">No. Jurnal:</span>{' '}
            <span className="font-data-mono text-primary">{tx.journal.journalNumber}</span>
          </div>
        </div>

        {/* Journal entries preview */}
        {tx.journal.entries && (
          <div>
            <p className="text-label-sm text-on-surface-variant font-semibold mb-2">Detail Jurnal Akuntansi</p>
            <div className="overflow-x-auto rounded-lg border border-outline-variant">
              <table className="w-full text-sm">
                <thead className="table-header">
                  <tr>
                    <th>Akun</th>
                    <th className="text-right">Debit</th>
                    <th className="text-right">Kredit</th>
                  </tr>
                </thead>
                <tbody>
                  {tx.journal.entries.map(e => (
                    <tr key={e.id} className="border-b border-outline-variant/20">
                      <td className="py-2 px-4 font-data-mono text-primary text-xs">{e.account.code} - {e.account.name}</td>
                      <td className="py-2 px-4 text-right">{parseFloat(e.debit)  > 0 ? `Rp ${fmtIDR(e.debit)}`  : '-'}</td>
                      <td className="py-2 px-4 text-right">{parseFloat(e.credit) > 0 ? `Rp ${fmtIDR(e.credit)}` : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          {status === 'DRAFT' && (
            <button
              onClick={onApprove}
              disabled={isApproving}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded text-label-sm font-bold hover:bg-primary-container transition-colors disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {isApproving ? 'Memposting...' : 'Post ke Buku Besar'}
            </button>
          )}
          {status !== 'VOID' && (
            <button
              onClick={onVoid}
              disabled={isVoiding}
              className="flex items-center gap-2 px-4 py-2 border border-error/30 text-error rounded text-label-sm hover:bg-error/10 transition-colors disabled:opacity-50"
            >
              <Ban className="w-4 h-4" />
              {isVoiding ? 'Membatalkan...' : 'Void'}
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 border border-outline-variant rounded text-label-sm text-on-surface hover:bg-surface-container-low transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}
