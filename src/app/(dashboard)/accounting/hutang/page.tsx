'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Send, Ban, Eye, CreditCard, Receipt } from 'lucide-react'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { ErrorState } from '@/components/ui/ErrorState'
import { DataTable } from '@/components/ui/DataTable'

// ─── Local types ──────────────────────────────────────────────────────────────
type JournalStatus = 'DRAFT' | 'POSTED' | 'VOID'
type PayableStatus = 'OPEN' | 'PARTIAL' | 'PAID' | 'VOID'

interface AccountRef { id: number; code: string; name: string; category?: string }
interface JournalEntry { id: number; account: AccountRef; debit: string; credit: string }
interface JournalDetail { id: number; journalNumber: string; status: JournalStatus; entries?: JournalEntry[] }

interface Payment {
  id:          number
  paymentDate: string
  amount:      string
  description: string | null
  cashAccount: AccountRef
  journal:     JournalDetail
  createdAt:   string
}

interface Payable {
  id:              number
  payableNumber:   string
  vendorName:      string
  description:     string
  referenceNumber: string | null
  amount:          string
  paidAmount:      string
  remainingAmount: string
  dueDate:         string
  status:          PayableStatus
  payableAccount:  AccountRef
  journal:         JournalDetail
  payments:        Payment[]
  createdAt:       string
}

interface Meta {
  total:          number
  totalAmount:    number
  totalPaid:      number
  totalRemaining: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_CFG: Record<PayableStatus, { label: string; color: string }> = {
  OPEN:    { label: 'Belum Bayar',    color: 'bg-surface-variant text-body-grey' },
  PARTIAL: { label: 'Bayar Sebagian', color: 'bg-warning-container text-on-warning-container border border-warning/30' },
  PAID:    { label: 'Lunas',          color: 'bg-success-green/10 text-success-green border border-success-green/20' },
  VOID:    { label: 'Batal',          color: 'bg-error-container text-on-error-container' },
}

const JOURNAL_STATUS_CFG: Record<JournalStatus, { label: string; color: string }> = {
  DRAFT:  { label: 'Draft',  color: 'bg-surface-variant text-body-grey' },
  POSTED: { label: 'Posted', color: 'bg-success-green/10 text-success-green border border-success-green/20' },
  VOID:   { label: 'Void',   color: 'bg-error-container text-on-error-container' },
}

function fmtIDR(val: string | number) {
  return 'Rp ' + new Intl.NumberFormat('id-ID').format(Math.abs(parseFloat(String(val))))
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

function isOverdue(p: Payable) {
  if (p.status === 'PAID' || p.status === 'VOID') return false
  return new Date(p.dueDate) < new Date()
}

// ─── API calls ────────────────────────────────────────────────────────────────
async function fetchPayables(filterStatus: string, search: string) {
  const p = new URLSearchParams({ limit: '100' })
  if (filterStatus) p.set('status', filterStatus)
  if (search)       p.set('search', search)
  const res  = await fetch(`/api/payables?${p}`)
  const json = await res.json()
  if (!json.success) throw new Error(json.error)
  return json as { data: Payable[]; meta: Meta }
}

async function fetchAccounts() {
  const res  = await fetch('/api/accounts')
  const json = await res.json()
  if (!json.success) throw new Error(json.error)
  return json.data as (AccountRef & { children?: { id: number }[] })[]
}

// ─── Create Form ──────────────────────────────────────────────────────────────
interface CreateFormProps {
  accounts:  (AccountRef & { children?: { id: number }[] })[]
  onClose:   () => void
  onSuccess: () => void
}

function CreatePayableForm({ accounts, onClose, onSuccess }: CreateFormProps) {
  const [form, setForm] = useState({
    vendorName:       '',
    description:      '',
    referenceNumber:  '',
    amount:           '',
    dueDate:          '',
    payableAccountId: '',
    expenseAccountId: '',
  })
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res  = await fetch('/api/payables', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      return json
    },
    onSuccess: () => { onSuccess(); onClose() },
    onError:   (e: Error) => setError(e.message),
  })

  const leafAccounts    = accounts.filter(a => !a.children?.length)
  const liabilityLeaf   = leafAccounts.filter(a => a.category === 'LIABILITY')
  const allLeaf         = leafAccounts

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const amount      = parseFloat(form.amount) || 0
  const payAcct     = accounts.find(a => a.id === parseInt(form.payableAccountId))
  const expAcct     = accounts.find(a => a.id === parseInt(form.expenseAccountId))
  const canSubmit   = form.vendorName.trim() && form.description.trim() && form.dueDate &&
                      form.payableAccountId && form.expenseAccountId && amount > 0

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface-container-lowest rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-outline-variant flex items-center justify-between">
          <h2 className="text-title-lg font-semibold text-on-surface">Buat Hutang Baru</h2>
          <button onClick={onClose} className="text-body-grey hover:text-on-surface text-xl leading-none">&times;</button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-error-container text-on-error-container text-body-sm">{error}</div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-label-sm font-medium text-on-surface mb-1">Nama Vendor *</label>
              <input value={form.vendorName} onChange={set('vendorName')} placeholder="PT Supplier / CV Maju Jaya"
                className="input-field w-full" />
            </div>

            <div className="md:col-span-2">
              <label className="block text-label-sm font-medium text-on-surface mb-1">Deskripsi *</label>
              <textarea value={form.description} onChange={set('description')} rows={2}
                placeholder="Pembelian bahan baku / Tagihan listrik bulan Juni"
                className="input-field w-full resize-none" />
            </div>

            <div>
              <label className="block text-label-sm font-medium text-on-surface mb-1">Nomor Referensi</label>
              <input value={form.referenceNumber} onChange={set('referenceNumber')} placeholder="PO-001 / INV-VENDOR-001"
                className="input-field w-full" />
            </div>

            <div>
              <label className="block text-label-sm font-medium text-on-surface mb-1">Tanggal Jatuh Tempo *</label>
              <input type="date" value={form.dueDate} onChange={set('dueDate')} className="input-field w-full" />
            </div>

            <div className="md:col-span-2">
              <label className="block text-label-sm font-medium text-on-surface mb-1">Jumlah *</label>
              <input type="number" value={form.amount} onChange={set('amount')} min="0" step="1000"
                placeholder="0" className="input-field w-full" />
            </div>

            <div>
              <label className="block text-label-sm font-medium text-on-surface mb-1">
                Akun Hutang * <span className="text-body-grey">(LIABILITY)</span>
              </label>
              <select value={form.payableAccountId} onChange={set('payableAccountId')} className="input-field w-full">
                <option value="">— Pilih akun —</option>
                {liabilityLeaf.map(a => (
                  <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-label-sm font-medium text-on-surface mb-1">Akun Biaya/Pengeluaran *</label>
              <select value={form.expenseAccountId} onChange={set('expenseAccountId')} className="input-field w-full">
                <option value="">— Pilih akun —</option>
                {allLeaf.map(a => (
                  <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Double-entry preview */}
          {expAcct && payAcct && amount > 0 && (
            <div className="mt-4 p-4 bg-surface-container rounded-lg border border-outline-variant">
              <p className="text-label-sm font-semibold text-body-grey mb-2 uppercase tracking-wide">Preview Jurnal</p>
              <table className="w-full text-body-sm">
                <thead>
                  <tr className="text-body-grey">
                    <th className="text-left pb-1">Akun</th>
                    <th className="text-right pb-1 w-32">Debit</th>
                    <th className="text-right pb-1 w-32">Kredit</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="py-1 text-on-surface">{expAcct.code} — {expAcct.name}</td>
                    <td className="text-right text-success-green font-mono">{fmtIDR(amount)}</td>
                    <td className="text-right text-body-grey">—</td>
                  </tr>
                  <tr>
                    <td className="py-1 text-on-surface pl-4">{payAcct.code} — {payAcct.name}</td>
                    <td className="text-right text-body-grey">—</td>
                    <td className="text-right text-primary font-mono">{fmtIDR(amount)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-outline-variant flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">Batal</button>
          <button
            onClick={() => mutation.mutate(form)}
            disabled={!canSubmit || mutation.isPending}
            className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            {mutation.isPending ? 'Menyimpan...' : 'Buat Hutang'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Payment Form ──────────────────────────────────────────────────────────────
interface PaymentFormProps {
  payable:   Payable
  accounts:  (AccountRef & { children?: { id: number }[] })[]
  onClose:   () => void
  onSuccess: () => void
}

function PaymentForm({ payable, accounts, onClose, onSuccess }: PaymentFormProps) {
  const remaining = parseFloat(payable.remainingAmount)
  const [form, setForm] = useState({
    paymentDate:   new Date().toISOString().slice(0, 10),
    amount:        remaining.toFixed(0),
    cashAccountId: '',
    description:   '',
  })
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res  = await fetch(`/api/payables/${payable.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'payment', ...data }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      return json
    },
    onSuccess: () => { onSuccess(); onClose() },
    onError:   (e: Error) => setError(e.message),
  })

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const assetLeaf   = accounts.filter(a => a.category === 'ASSET' && !a.children?.length)
  const payAmount   = parseFloat(form.amount) || 0
  const cashAcct    = accounts.find(a => a.id === parseInt(form.cashAccountId))
  const payAcct     = payable.payableAccount
  const canSubmit   = form.paymentDate && form.cashAccountId && payAmount > 0 && payAmount <= remaining + 0.001

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface-container-lowest rounded-xl shadow-xl w-full max-w-lg">
        <div className="p-6 border-b border-outline-variant flex items-center justify-between">
          <div>
            <h2 className="text-title-lg font-semibold text-on-surface">Catat Pembayaran Hutang</h2>
            <p className="text-body-sm text-body-grey mt-0.5">{payable.vendorName} — {payable.payableNumber}</p>
          </div>
          <button onClick={onClose} className="text-body-grey hover:text-on-surface text-xl leading-none">&times;</button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-error-container text-on-error-container text-body-sm">{error}</div>
          )}

          <div className="p-3 rounded-lg bg-surface-container border border-outline-variant">
            <div className="flex justify-between text-body-sm">
              <span className="text-body-grey">Total Hutang</span>
              <span className="font-mono font-medium">{fmtIDR(payable.amount)}</span>
            </div>
            <div className="flex justify-between text-body-sm mt-1">
              <span className="text-body-grey">Sudah Dibayar</span>
              <span className="font-mono text-success-green">{fmtIDR(payable.paidAmount)}</span>
            </div>
            <div className="flex justify-between text-body-sm mt-1 font-semibold">
              <span className="text-on-surface">Sisa Hutang</span>
              <span className="font-mono text-error">{fmtIDR(payable.remainingAmount)}</span>
            </div>
          </div>

          <div>
            <label className="block text-label-sm font-medium text-on-surface mb-1">Tanggal Pembayaran *</label>
            <input type="date" value={form.paymentDate} onChange={set('paymentDate')} className="input-field w-full" />
          </div>

          <div>
            <label className="block text-label-sm font-medium text-on-surface mb-1">
              Jumlah Dibayar * <span className="text-body-grey">(maks. {fmtIDR(remaining)})</span>
            </label>
            <input type="number" value={form.amount} onChange={set('amount')} min="1" max={remaining} step="1000"
              className="input-field w-full" />
            {payAmount > remaining + 0.001 && (
              <p className="text-error text-body-sm mt-1">Melebihi sisa hutang</p>
            )}
          </div>

          <div>
            <label className="block text-label-sm font-medium text-on-surface mb-1">
              Akun Kas/Bank * <span className="text-body-grey">(ASSET)</span>
            </label>
            <select value={form.cashAccountId} onChange={set('cashAccountId')} className="input-field w-full">
              <option value="">— Pilih akun —</option>
              {assetLeaf.map(a => (
                <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-label-sm font-medium text-on-surface mb-1">Keterangan</label>
            <input value={form.description} onChange={set('description')} placeholder="Keterangan pembayaran (opsional)"
              className="input-field w-full" />
          </div>

          {/* Double-entry preview */}
          {cashAcct && payAmount > 0 && payAmount <= remaining + 0.001 && (
            <div className="p-4 bg-surface-container rounded-lg border border-outline-variant">
              <p className="text-label-sm font-semibold text-body-grey mb-2 uppercase tracking-wide">Preview Jurnal</p>
              <table className="w-full text-body-sm">
                <thead>
                  <tr className="text-body-grey">
                    <th className="text-left pb-1">Akun</th>
                    <th className="text-right pb-1 w-32">Debit</th>
                    <th className="text-right pb-1 w-32">Kredit</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="py-1 text-on-surface">{payAcct.code} — {payAcct.name}</td>
                    <td className="text-right text-success-green font-mono">{fmtIDR(payAmount)}</td>
                    <td className="text-right text-body-grey">—</td>
                  </tr>
                  <tr>
                    <td className="py-1 text-on-surface pl-4">{cashAcct.code} — {cashAcct.name}</td>
                    <td className="text-right text-body-grey">—</td>
                    <td className="text-right text-error font-mono">{fmtIDR(payAmount)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-outline-variant flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">Batal</button>
          <button
            onClick={() => mutation.mutate(form)}
            disabled={!canSubmit || mutation.isPending}
            className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CreditCard className="w-4 h-4" />
            {mutation.isPending ? 'Menyimpan...' : 'Bayar Hutang'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Detail Modal ──────────────────────────────────────────────────────────────
interface DetailModalProps {
  payable:   Payable
  onClose:   () => void
  onApprove: () => void
  onVoid:    () => void
  onPayment: () => void
  loading:   boolean
}

function DetailModal({ payable: p, onClose, onApprove, onVoid, onPayment, loading }: DetailModalProps) {
  const sCfg      = STATUS_CFG[p.status]
  const jsCfg     = JOURNAL_STATUS_CFG[p.journal.status]
  const overdue   = isOverdue(p)
  const canApprove = p.journal.status === 'DRAFT' && p.status !== 'VOID'
  const canVoid    = p.status !== 'VOID' && p.payments.length === 0
  const canPay     = p.status !== 'PAID' && p.status !== 'VOID'

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface-container-lowest rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-outline-variant flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-2 py-0.5 rounded-full text-label-sm font-medium ${sCfg.color}`}>{sCfg.label}</span>
              {overdue && <span className="px-2 py-0.5 rounded-full text-label-sm font-medium bg-error-container text-on-error-container">Jatuh Tempo</span>}
            </div>
            <h2 className="text-title-lg font-semibold text-on-surface">{p.payableNumber}</h2>
            <p className="text-body-sm text-body-grey">{p.vendorName}</p>
          </div>
          <button onClick={onClose} className="text-body-grey hover:text-on-surface text-xl leading-none mt-1">&times;</button>
        </div>

        <div className="p-6 space-y-6">
          {/* Summary amounts */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-3 bg-surface-container rounded-lg text-center">
              <p className="text-body-sm text-body-grey">Total Hutang</p>
              <p className="text-title-md font-bold text-on-surface mt-1">{fmtIDR(p.amount)}</p>
            </div>
            <div className="p-3 bg-success-green/5 rounded-lg text-center">
              <p className="text-body-sm text-body-grey">Sudah Dibayar</p>
              <p className="text-title-md font-bold text-success-green mt-1">{fmtIDR(p.paidAmount)}</p>
            </div>
            <div className="p-3 bg-error/5 rounded-lg text-center">
              <p className="text-body-sm text-body-grey">Sisa</p>
              <p className="text-title-md font-bold text-error mt-1">{fmtIDR(p.remainingAmount)}</p>
            </div>
          </div>

          {/* Info */}
          <div className="grid grid-cols-2 gap-3 text-body-sm">
            <div>
              <span className="text-body-grey">Deskripsi</span>
              <p className="text-on-surface mt-0.5">{p.description}</p>
            </div>
            <div>
              <span className="text-body-grey">Referensi</span>
              <p className="text-on-surface mt-0.5">{p.referenceNumber || '—'}</p>
            </div>
            <div>
              <span className="text-body-grey">Jatuh Tempo</span>
              <p className={`mt-0.5 font-medium ${overdue ? 'text-error' : 'text-on-surface'}`}>{fmtDate(p.dueDate)}</p>
            </div>
            <div>
              <span className="text-body-grey">Tanggal Dibuat</span>
              <p className="text-on-surface mt-0.5">{fmtDate(p.createdAt)}</p>
            </div>
            <div>
              <span className="text-body-grey">Akun Hutang</span>
              <p className="text-on-surface mt-0.5">{p.payableAccount.code} — {p.payableAccount.name}</p>
            </div>
            <div>
              <span className="text-body-grey">Status Jurnal</span>
              <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-label-sm font-medium ${jsCfg.color}`}>{jsCfg.label}</span>
            </div>
          </div>

          {/* Creation journal entries */}
          {p.journal.entries && p.journal.entries.length > 0 && (
            <div>
              <p className="text-label-sm font-semibold text-body-grey uppercase tracking-wide mb-2">
                Jurnal Pembuatan ({p.journal.journalNumber})
              </p>
              <table className="w-full text-body-sm border border-outline-variant rounded-lg overflow-hidden">
                <thead className="bg-surface-container">
                  <tr>
                    <th className="text-left px-3 py-2 text-body-grey">Akun</th>
                    <th className="text-right px-3 py-2 text-body-grey">Debit</th>
                    <th className="text-right px-3 py-2 text-body-grey">Kredit</th>
                  </tr>
                </thead>
                <tbody>
                  {p.journal.entries.map(e => (
                    <tr key={e.id} className="border-t border-outline-variant/50">
                      <td className="px-3 py-2">{e.account.code} — {e.account.name}</td>
                      <td className="px-3 py-2 text-right font-mono text-success-green">
                        {parseFloat(e.debit) > 0 ? fmtIDR(e.debit) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-primary">
                        {parseFloat(e.credit) > 0 ? fmtIDR(e.credit) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Payment history */}
          {p.payments.length > 0 && (
            <div>
              <p className="text-label-sm font-semibold text-body-grey uppercase tracking-wide mb-2">Riwayat Pembayaran</p>
              <div className="space-y-2">
                {p.payments.map(pay => (
                  <div key={pay.id} className="p-3 bg-surface-container rounded-lg border border-outline-variant/50">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-body-sm font-medium text-on-surface">{fmtDate(pay.paymentDate)}</p>
                        <p className="text-label-sm text-body-grey">{pay.cashAccount.code} — {pay.cashAccount.name}</p>
                        {pay.description && <p className="text-label-sm text-body-grey mt-0.5">{pay.description}</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-body-sm font-bold text-success-green font-mono">{fmtIDR(pay.amount)}</p>
                        <p className="text-label-sm text-body-grey">{pay.journal.journalNumber}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-outline-variant flex flex-wrap gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">Tutup</button>
          {canVoid && (
            <button onClick={onVoid} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-error-container text-on-error-container font-medium hover:opacity-90 disabled:opacity-50 text-body-sm">
              <Ban className="w-4 h-4" />
              {loading ? 'Proses...' : 'Batalkan Hutang'}
            </button>
          )}
          {canApprove && (
            <button onClick={onApprove} disabled={loading}
              className="flex items-center gap-2 btn-primary disabled:opacity-50">
              <Send className="w-4 h-4" />
              {loading ? 'Proses...' : 'Post ke Buku Besar'}
            </button>
          )}
          {canPay && (
            <button onClick={onPayment} disabled={loading}
              className="flex items-center gap-2 btn-primary disabled:opacity-50">
              <CreditCard className="w-4 h-4" />
              Bayar Hutang
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function HutangPage() {
  const qc                    = useQueryClient()
  const [filterStatus, setFilterStatus]   = useState('')
  const [search,       setSearch]         = useState('')
  const [showCreate,   setShowCreate]     = useState(false)
  const [viewPayable,  setViewPayable]    = useState<Payable | null>(null)
  const [paymentPayable, setPaymentPayable] = useState<Payable | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const { data: resp, isLoading, isError, refetch } = useQuery({
    queryKey: ['payables', filterStatus, search],
    queryFn:  () => fetchPayables(filterStatus, search),
  })

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn:  fetchAccounts,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['payables'] })

  const doAction = async (id: number, action: string) => {
    setActionLoading(true)
    try {
      const res  = await fetch(`/api/payables/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      invalidate()
      if (viewPayable?.id === id) setViewPayable(json.data)
    } finally {
      setActionLoading(false)
    }
  }

  const rows         = resp?.data ?? []
  const meta         = resp?.meta
  const overdueCount = rows.filter(r => isOverdue(r)).length

  if (isLoading) return <div className="p-6"><LoadingSkeleton /></div>
  if (isError)   return <div className="p-6"><ErrorState message="Gagal memuat data hutang" onRetry={refetch} /></div>

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-error-container flex items-center justify-center text-error">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-headline-sm font-bold text-on-surface">Hutang Usaha</h1>
            <p className="text-body-sm text-body-grey">Payable Management</p>
          </div>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Buat Hutang
        </button>
      </div>

      {/* Summary Cards */}
      {meta && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card-elevated p-4">
            <p className="text-body-sm text-body-grey">Total Hutang</p>
            <p className="text-headline-sm font-bold text-on-surface mt-1">{fmtIDR(meta.totalAmount)}</p>
            <p className="text-label-sm text-body-grey mt-1">{meta.total} transaksi</p>
          </div>
          <div className="card-elevated p-4">
            <p className="text-body-sm text-body-grey">Belum Lunas</p>
            <p className="text-headline-sm font-bold text-error mt-1">{fmtIDR(meta.totalRemaining)}</p>
            <p className="text-label-sm text-body-grey mt-1">
              {rows.filter(r => r.status === 'OPEN' || r.status === 'PARTIAL').length} hutang
            </p>
          </div>
          <div className="card-elevated p-4">
            <p className="text-body-sm text-body-grey">Sudah Dibayar</p>
            <p className="text-headline-sm font-bold text-success-green mt-1">{fmtIDR(meta.totalPaid)}</p>
            <p className="text-label-sm text-body-grey mt-1">
              {rows.filter(r => r.status === 'PAID').length} lunas
            </p>
          </div>
          <div className="card-elevated p-4">
            <p className="text-body-sm text-body-grey">Jatuh Tempo</p>
            <p className={`text-headline-sm font-bold mt-1 ${overdueCount > 0 ? 'text-error' : 'text-on-surface'}`}>
              {overdueCount}
            </p>
            <p className="text-label-sm text-body-grey mt-1">hutang overdue</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card-elevated p-4 flex flex-wrap gap-3 items-center">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cari vendor / nomor hutang..."
          className="input-field flex-1 min-w-[200px]"
        />
        <div className="flex gap-2 flex-wrap">
          {(['', 'OPEN', 'PARTIAL', 'PAID', 'VOID'] as const).map(s => (
            <button key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-label-sm font-medium transition-colors ${
                filterStatus === s
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container text-body-grey hover:bg-surface-container-high'
              }`}
            >
              {s === '' ? 'Semua' : STATUS_CFG[s].label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card-elevated overflow-hidden">
        <DataTable
          data={rows}
          keyExtractor={r => String(r.id)}
          columns={[
            {
              header: 'No. Hutang',
              accessor: r => (
                <span className="font-mono text-body-sm text-primary font-medium">{r.payableNumber}</span>
              ),
            },
            {
              header: 'Vendor',
              accessor: r => (
                <div>
                  <p className="font-medium text-on-surface">{r.vendorName}</p>
                  {r.referenceNumber && <p className="text-label-sm text-body-grey">{r.referenceNumber}</p>}
                </div>
              ),
            },
            {
              header: 'Jatuh Tempo',
              accessor: r => (
                <span className={isOverdue(r) ? 'text-error font-medium' : 'text-on-surface'}>
                  {fmtDate(r.dueDate)}
                  {isOverdue(r) && <span className="block text-label-sm">Overdue</span>}
                </span>
              ),
            },
            {
              header:   'Total',
              align:    'right',
              accessor: r => <span className="font-mono text-body-sm">{fmtIDR(r.amount)}</span>,
            },
            {
              header:   'Dibayar',
              align:    'right',
              accessor: r => <span className="font-mono text-body-sm text-success-green">{fmtIDR(r.paidAmount)}</span>,
            },
            {
              header:   'Sisa',
              align:    'right',
              accessor: r => (
                <span className={`font-mono text-body-sm ${parseFloat(r.remainingAmount) > 0 ? 'text-error font-semibold' : 'text-body-grey'}`}>
                  {fmtIDR(r.remainingAmount)}
                </span>
              ),
            },
            {
              header:   'Status',
              align:    'center',
              accessor: r => (
                <div className="flex flex-col items-center gap-1">
                  <span className={`px-2 py-0.5 rounded-full text-label-sm font-medium ${STATUS_CFG[r.status].color}`}>
                    {STATUS_CFG[r.status].label}
                  </span>
                  <span className={`px-1.5 py-0.5 rounded text-label-sm ${JOURNAL_STATUS_CFG[r.journal.status].color}`}>
                    {JOURNAL_STATUS_CFG[r.journal.status].label}
                  </span>
                </div>
              ),
            },
            {
              header:   'Aksi',
              align:    'center',
              accessor: r => (
                <div className="flex gap-1 justify-center">
                  <button onClick={() => setViewPayable(r)} title="Detail"
                    className="p-1.5 rounded-lg hover:bg-surface-container-high text-body-grey hover:text-primary transition-colors">
                    <Eye className="w-4 h-4" />
                  </button>
                  {r.journal.status === 'DRAFT' && r.status !== 'VOID' && (
                    <button onClick={() => doAction(r.id, 'approve')} disabled={actionLoading} title="Post ke Buku Besar"
                      className="p-1.5 rounded-lg hover:bg-success-green/10 text-body-grey hover:text-success-green transition-colors disabled:opacity-50">
                      <Send className="w-4 h-4" />
                    </button>
                  )}
                  {(r.status === 'OPEN' || r.status === 'PARTIAL') && (
                    <button onClick={() => { setPaymentPayable(r); setViewPayable(null) }} title="Bayar Hutang"
                      className="p-1.5 rounded-lg hover:bg-error/10 text-body-grey hover:text-error transition-colors">
                      <CreditCard className="w-4 h-4" />
                    </button>
                  )}
                  {r.status !== 'VOID' && r.payments.length === 0 && (
                    <button onClick={() => doAction(r.id, 'void')} disabled={actionLoading} title="Batalkan"
                      className="p-1.5 rounded-lg hover:bg-error-container text-body-grey hover:text-error transition-colors disabled:opacity-50">
                      <Ban className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ),
            },
          ]}
          emptyMessage="Belum ada data hutang"
        />
      </div>

      {/* Modals */}
      {showCreate && (
        <CreatePayableForm
          accounts={accounts}
          onClose={() => setShowCreate(false)}
          onSuccess={invalidate}
        />
      )}

      {viewPayable && (
        <DetailModal
          payable={viewPayable}
          onClose={() => setViewPayable(null)}
          onApprove={() => doAction(viewPayable.id, 'approve')}
          onVoid={() => doAction(viewPayable.id, 'void')}
          onPayment={() => { setPaymentPayable(viewPayable); setViewPayable(null) }}
          loading={actionLoading}
        />
      )}

      {paymentPayable && (
        <PaymentForm
          payable={paymentPayable}
          accounts={accounts}
          onClose={() => setPaymentPayable(null)}
          onSuccess={invalidate}
        />
      )}
    </div>
  )
}
