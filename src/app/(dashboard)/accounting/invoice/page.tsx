'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Send, Ban, Eye, CreditCard, FileText, Trash2 } from 'lucide-react'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { ErrorState } from '@/components/ui/ErrorState'
import { DataTable } from '@/components/ui/DataTable'

// ─── Local types ──────────────────────────────────────────────────────────────
type JournalStatus = 'DRAFT' | 'POSTED' | 'VOID'
type InvoiceStatus = 'DRAFT' | 'SENT' | 'PARTIAL' | 'PAID' | 'VOID'

interface AccountRef { id: number; code: string; name: string; category?: string }
interface JournalEntry { id: number; account: AccountRef; debit: string; credit: string }
interface JournalDetail {
  id: number; journalNumber: string; status: JournalStatus
  entries?: JournalEntry[]
}

interface InvoiceItem {
  id:          number
  description: string
  quantity:    string
  unitPrice:   string
  amount:      string
}

interface InvoicePayment {
  id:          number
  paymentDate: string
  amount:      string
  description: string | null
  cashAccount: AccountRef
  journal:     JournalDetail
  createdAt:   string
}

interface Invoice {
  id:              number
  invoiceNumber:   string
  customerName:    string
  customerAddress: string | null
  customerEmail:   string | null
  customerPhone:   string | null
  invoiceDate:     string
  dueDate:         string
  notes:           string | null
  taxRate:         string
  subtotal:        string
  taxAmount:       string
  totalAmount:     string
  paidAmount:      string
  remainingAmount: string
  status:          InvoiceStatus
  receivableAccount: AccountRef
  revenueAccount:    AccountRef
  journal?: JournalDetail | null
  items:    InvoiceItem[]
  payments: InvoicePayment[]
  createdAt: string
}

interface Meta {
  total: number; page: number; totalPages: number
  totalAmount: number; totalPaid: number; totalRemaining: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_CFG: Record<InvoiceStatus, { label: string; color: string }> = {
  DRAFT:   { label: 'Draft',        color: 'bg-surface-variant text-body-grey' },
  SENT:    { label: 'Dikirim',      color: 'bg-primary/10 text-primary border border-primary/20' },
  PARTIAL: { label: 'Bayar Sebagian', color: 'bg-warning-container text-on-warning-container border border-warning/30' },
  PAID:    { label: 'Lunas',        color: 'bg-success-green/10 text-success-green border border-success-green/20' },
  VOID:    { label: 'Batal',        color: 'bg-error-container text-on-error-container' },
}

const JOURNAL_CFG: Record<JournalStatus, { label: string; color: string }> = {
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
function isOverdue(inv: Invoice) {
  if (inv.status === 'PAID' || inv.status === 'VOID') return false
  return new Date(inv.dueDate) < new Date()
}

// ─── API calls ────────────────────────────────────────────────────────────────
async function fetchInvoices(filterStatus: string, search: string) {
  const p = new URLSearchParams({ limit: '100' })
  if (filterStatus) p.set('status', filterStatus)
  if (search)       p.set('search', search)
  const res  = await fetch(`/api/invoices?${p}`)
  const json = await res.json()
  if (!json.success) throw new Error(json.error)
  return json as { data: Invoice[]; meta: Meta }
}

async function fetchAccounts() {
  const res  = await fetch('/api/accounts')
  const json = await res.json()
  if (!json.success) throw new Error(json.error)
  return json.data as (AccountRef & { children?: { id: number }[] })[]
}

// ─── Line-item row ────────────────────────────────────────────────────────────
interface LineItem { description: string; quantity: string; unitPrice: string }

function LineItemRow({
  item, index, onChange, onRemove, canRemove,
}: {
  item: LineItem; index: number
  onChange: (i: number, field: keyof LineItem, value: string) => void
  onRemove: (i: number) => void
  canRemove: boolean
}) {
  const qty   = parseFloat(item.quantity)  || 0
  const price = parseFloat(item.unitPrice) || 0
  const amt   = qty * price

  return (
    <tr className="border-t border-outline-variant/50">
      <td className="py-2 pr-2">
        <input
          value={item.description}
          onChange={e => onChange(index, 'description', e.target.value)}
          placeholder="Nama barang / jasa"
          className="input-field w-full text-body-sm"
        />
      </td>
      <td className="py-2 pr-2 w-24">
        <input
          type="number" min="0.01" step="0.01"
          value={item.quantity}
          onChange={e => onChange(index, 'quantity', e.target.value)}
          className="input-field w-full text-body-sm text-right"
        />
      </td>
      <td className="py-2 pr-2 w-36">
        <input
          type="number" min="0" step="1000"
          value={item.unitPrice}
          onChange={e => onChange(index, 'unitPrice', e.target.value)}
          placeholder="0"
          className="input-field w-full text-body-sm text-right"
        />
      </td>
      <td className="py-2 pr-2 w-36 text-right">
        <span className="text-body-sm font-mono text-on-surface">{amt > 0 ? fmtIDR(amt) : '—'}</span>
      </td>
      <td className="py-2 w-8 text-center">
        {canRemove && (
          <button onClick={() => onRemove(index)}
            className="p-1 rounded text-body-grey hover:text-error hover:bg-error-container transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </td>
    </tr>
  )
}

// ─── Create Form ──────────────────────────────────────────────────────────────
function CreateInvoiceForm({
  accounts, onClose, onSuccess,
}: {
  accounts: (AccountRef & { children?: { id: number }[] })[]
  onClose:  () => void
  onSuccess: () => void
}) {
  const [form, setForm] = useState({
    customerName:    '',
    customerAddress: '',
    customerEmail:   '',
    customerPhone:   '',
    invoiceDate:     new Date().toISOString().slice(0, 10),
    dueDate:         '',
    notes:           '',
    taxRate:         '0',
    receivableAccountId: '',
    revenueAccountId:    '',
  })
  const [items, setItems] = useState<LineItem[]>([
    { description: '', quantity: '1', unitPrice: '' },
  ])
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: async () => {
      const res  = await fetch('/api/invoices', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ...form, items }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      return json
    },
    onSuccess: () => { onSuccess(); onClose() },
    onError:   (e: Error) => setError(e.message),
  })

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }))

  const updateItem = (i: number, field: keyof LineItem, value: string) =>
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [field]: value } : it))
  const addItem    = () => setItems(prev => [...prev, { description: '', quantity: '1', unitPrice: '' }])
  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i))

  const leafAccounts = accounts.filter(a => !a.children?.length)
  const assetLeaf    = leafAccounts.filter(a => a.category === 'ASSET')

  const subtotal = items.reduce((s, it) => s + (parseFloat(it.quantity) || 0) * (parseFloat(it.unitPrice) || 0), 0)
  const taxRate  = parseFloat(form.taxRate) || 0
  const taxAmt   = subtotal * (taxRate / 100)
  const total    = subtotal + taxAmt

  const arAcct  = accounts.find(a => a.id === parseInt(form.receivableAccountId))
  const revAcct = accounts.find(a => a.id === parseInt(form.revenueAccountId))

  const validItems   = items.filter(it => it.description.trim() && parseFloat(it.quantity) > 0 && parseFloat(it.unitPrice) > 0)
  const canSubmit    = form.customerName.trim() && form.invoiceDate && form.dueDate &&
                       form.receivableAccountId && form.revenueAccountId &&
                       validItems.length > 0 && total > 0

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface-container-lowest rounded-xl shadow-xl w-full max-w-3xl max-h-[95vh] overflow-y-auto">
        <div className="p-6 border-b border-outline-variant flex items-center justify-between">
          <h2 className="text-title-lg font-semibold text-on-surface">Buat Invoice Baru</h2>
          <button onClick={onClose} className="text-body-grey hover:text-on-surface text-xl leading-none">&times;</button>
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-lg bg-error-container text-on-error-container text-body-sm">{error}</div>
          )}

          {/* Customer Info */}
          <div>
            <p className="text-label-sm font-semibold text-body-grey uppercase tracking-wide mb-3">Informasi Customer</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-label-sm font-medium text-on-surface mb-1">Nama Customer *</label>
                <input value={form.customerName} onChange={set('customerName')} placeholder="PT ABC / Budi Santoso"
                  className="input-field w-full" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-label-sm font-medium text-on-surface mb-1">Alamat</label>
                <textarea value={form.customerAddress} onChange={set('customerAddress')} rows={2}
                  placeholder="Jl. Sudirman No. 1, Jakarta"
                  className="input-field w-full resize-none" />
              </div>
              <div>
                <label className="block text-label-sm font-medium text-on-surface mb-1">Email</label>
                <input type="email" value={form.customerEmail} onChange={set('customerEmail')}
                  placeholder="customer@email.com" className="input-field w-full" />
              </div>
              <div>
                <label className="block text-label-sm font-medium text-on-surface mb-1">Telepon</label>
                <input value={form.customerPhone} onChange={set('customerPhone')}
                  placeholder="08xx-xxxx-xxxx" className="input-field w-full" />
              </div>
            </div>
          </div>

          {/* Invoice Detail */}
          <div>
            <p className="text-label-sm font-semibold text-body-grey uppercase tracking-wide mb-3">Detail Invoice</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-label-sm font-medium text-on-surface mb-1">Tanggal Invoice *</label>
                <input type="date" value={form.invoiceDate} onChange={set('invoiceDate')} className="input-field w-full" />
              </div>
              <div>
                <label className="block text-label-sm font-medium text-on-surface mb-1">Tanggal Jatuh Tempo *</label>
                <input type="date" value={form.dueDate} onChange={set('dueDate')} className="input-field w-full" />
              </div>
              <div>
                <label className="block text-label-sm font-medium text-on-surface mb-1">
                  Akun Piutang * <span className="text-body-grey">(ASSET)</span>
                </label>
                <select value={form.receivableAccountId} onChange={set('receivableAccountId')} className="input-field w-full">
                  <option value="">— Pilih akun —</option>
                  {assetLeaf.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-label-sm font-medium text-on-surface mb-1">Akun Pendapatan *</label>
                <select value={form.revenueAccountId} onChange={set('revenueAccountId')} className="input-field w-full">
                  <option value="">— Pilih akun —</option>
                  {leafAccounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-label-sm font-semibold text-body-grey uppercase tracking-wide">Item Invoice *</p>
              <button onClick={addItem}
                className="flex items-center gap-1 text-label-sm text-primary hover:text-primary/80 font-medium">
                <Plus className="w-3.5 h-3.5" /> Tambah Item
              </button>
            </div>
            <div className="border border-outline-variant rounded-lg overflow-hidden">
              <table className="w-full text-body-sm">
                <thead className="bg-surface-container">
                  <tr>
                    <th className="text-left px-3 py-2 text-body-grey font-medium">Deskripsi</th>
                    <th className="text-right px-3 py-2 text-body-grey font-medium w-24">Qty</th>
                    <th className="text-right px-3 py-2 text-body-grey font-medium w-36">Harga Satuan</th>
                    <th className="text-right px-3 py-2 text-body-grey font-medium w-36">Jumlah</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody className="px-3">
                  {items.map((item, i) => (
                    <LineItemRow key={i} item={item} index={i}
                      onChange={updateItem} onRemove={removeItem} canRemove={items.length > 1} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tax & Totals */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            <div>
              <label className="block text-label-sm font-medium text-on-surface mb-1">
                Catatan
              </label>
              <textarea value={form.notes} onChange={set('notes')} rows={3}
                placeholder="Syarat pembayaran, catatan tambahan..." className="input-field w-full resize-none" />
            </div>
            <div className="p-4 bg-surface-container rounded-lg border border-outline-variant space-y-2">
              <div className="flex justify-between items-center text-body-sm">
                <span className="text-body-grey">Subtotal</span>
                <span className="font-mono font-medium text-on-surface">{fmtIDR(subtotal)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-body-sm text-body-grey flex-1">PPN</span>
                <div className="flex items-center gap-1">
                  <input type="number" min="0" max="100" step="1"
                    value={form.taxRate} onChange={set('taxRate')}
                    className="input-field w-16 text-right text-body-sm py-1"
                  />
                  <span className="text-body-sm text-body-grey">%</span>
                </div>
                <span className="font-mono text-body-sm text-on-surface w-28 text-right">{fmtIDR(taxAmt)}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-outline-variant">
                <span className="text-label-sm font-bold text-on-surface">TOTAL</span>
                <span className="font-mono font-bold text-title-md text-primary">{fmtIDR(total)}</span>
              </div>
            </div>
          </div>

          {/* Journal preview */}
          {arAcct && revAcct && total > 0 && (
            <div className="p-4 bg-surface-container rounded-lg border border-outline-variant">
              <p className="text-label-sm font-semibold text-body-grey mb-2 uppercase tracking-wide">Preview Jurnal (saat disetujui)</p>
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
                    <td className="py-1 text-on-surface">{arAcct.code} — {arAcct.name}</td>
                    <td className="text-right text-success-green font-mono">{fmtIDR(total)}</td>
                    <td className="text-right text-body-grey">—</td>
                  </tr>
                  <tr>
                    <td className="py-1 text-on-surface pl-4">{revAcct.code} — {revAcct.name}</td>
                    <td className="text-right text-body-grey">—</td>
                    <td className="text-right text-primary font-mono">{fmtIDR(total)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-outline-variant flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">Batal</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!canSubmit || mutation.isPending}
            className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            {mutation.isPending ? 'Menyimpan...' : 'Buat Invoice'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Payment Form ──────────────────────────────────────────────────────────────
function PaymentForm({
  invoice, accounts, onClose, onSuccess,
}: {
  invoice:   Invoice
  accounts:  (AccountRef & { children?: { id: number }[] })[]
  onClose:   () => void
  onSuccess: () => void
}) {
  const remaining = parseFloat(invoice.remainingAmount)
  const [form, setForm] = useState({
    paymentDate:   new Date().toISOString().slice(0, 10),
    amount:        remaining.toFixed(0),
    cashAccountId: '',
    description:   '',
  })
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res  = await fetch(`/api/invoices/${invoice.id}`, {
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

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }))

  const assetLeaf = accounts.filter(a => a.category === 'ASSET' && !a.children?.length)
  const payAmount = parseFloat(form.amount) || 0
  const cashAcct  = accounts.find(a => a.id === parseInt(form.cashAccountId))
  const canSubmit = form.paymentDate && form.cashAccountId && payAmount > 0 && payAmount <= remaining + 0.001

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface-container-lowest rounded-xl shadow-xl w-full max-w-lg">
        <div className="p-6 border-b border-outline-variant flex items-center justify-between">
          <div>
            <h2 className="text-title-lg font-semibold text-on-surface">Catat Pembayaran</h2>
            <p className="text-body-sm text-body-grey mt-0.5">{invoice.customerName} — {invoice.invoiceNumber}</p>
          </div>
          <button onClick={onClose} className="text-body-grey hover:text-on-surface text-xl leading-none">&times;</button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-error-container text-on-error-container text-body-sm">{error}</div>
          )}

          <div className="p-3 rounded-lg bg-surface-container border border-outline-variant space-y-1">
            <div className="flex justify-between text-body-sm">
              <span className="text-body-grey">Total Invoice</span>
              <span className="font-mono font-medium">{fmtIDR(invoice.totalAmount)}</span>
            </div>
            <div className="flex justify-between text-body-sm">
              <span className="text-body-grey">Sudah Dibayar</span>
              <span className="font-mono text-success-green">{fmtIDR(invoice.paidAmount)}</span>
            </div>
            <div className="flex justify-between text-body-sm font-semibold border-t border-outline-variant/50 pt-1 mt-1">
              <span className="text-on-surface">Sisa</span>
              <span className="font-mono text-primary">{fmtIDR(invoice.remainingAmount)}</span>
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
              <p className="text-error text-body-sm mt-1">Melebihi sisa invoice</p>
            )}
          </div>

          <div>
            <label className="block text-label-sm font-medium text-on-surface mb-1">
              Akun Kas/Bank * <span className="text-body-grey">(ASSET)</span>
            </label>
            <select value={form.cashAccountId} onChange={set('cashAccountId')} className="input-field w-full">
              <option value="">— Pilih akun —</option>
              {assetLeaf.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-label-sm font-medium text-on-surface mb-1">Keterangan</label>
            <input value={form.description} onChange={set('description')} placeholder="Keterangan opsional"
              className="input-field w-full" />
          </div>

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
                    <td className="py-1">{cashAcct.code} — {cashAcct.name}</td>
                    <td className="text-right text-success-green font-mono">{fmtIDR(payAmount)}</td>
                    <td className="text-right text-body-grey">—</td>
                  </tr>
                  <tr>
                    <td className="py-1 pl-4">{invoice.receivableAccount.code} — {invoice.receivableAccount.name}</td>
                    <td className="text-right text-body-grey">—</td>
                    <td className="text-right text-primary font-mono">{fmtIDR(payAmount)}</td>
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
            {mutation.isPending ? 'Menyimpan...' : 'Catat Pembayaran'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────
function DetailModal({
  invoice: inv, onClose, onApprove, onVoid, onPayment, loading,
}: {
  invoice:   Invoice
  onClose:   () => void
  onApprove: () => void
  onVoid:    () => void
  onPayment: () => void
  loading:   boolean
}) {
  const sCfg     = STATUS_CFG[inv.status]
  const overdue  = isOverdue(inv)
  const canApprove = inv.status === 'DRAFT'
  const canVoid    = inv.status !== 'VOID' && inv.payments.length === 0
  const canPay     = inv.status !== 'DRAFT' && inv.status !== 'PAID' && inv.status !== 'VOID'

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface-container-lowest rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-outline-variant flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-2 py-0.5 rounded-full text-label-sm font-medium ${sCfg.color}`}>{sCfg.label}</span>
              {overdue && (
                <span className="px-2 py-0.5 rounded-full text-label-sm font-medium bg-error-container text-on-error-container">
                  Jatuh Tempo
                </span>
              )}
            </div>
            <h2 className="text-title-lg font-semibold text-on-surface">{inv.invoiceNumber}</h2>
            <p className="text-body-sm text-body-grey">{inv.customerName}</p>
            {inv.customerEmail  && <p className="text-label-sm text-body-grey">{inv.customerEmail}</p>}
            {inv.customerPhone  && <p className="text-label-sm text-body-grey">{inv.customerPhone}</p>}
          </div>
          <button onClick={onClose} className="text-body-grey hover:text-on-surface text-xl leading-none mt-1">&times;</button>
        </div>

        <div className="p-6 space-y-6">
          {/* Amount summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-3 bg-surface-container rounded-lg text-center">
              <p className="text-body-sm text-body-grey">Total Invoice</p>
              <p className="text-title-md font-bold text-on-surface mt-1">{fmtIDR(inv.totalAmount)}</p>
            </div>
            <div className="p-3 bg-success-green/5 rounded-lg text-center">
              <p className="text-body-sm text-body-grey">Dibayar</p>
              <p className="text-title-md font-bold text-success-green mt-1">{fmtIDR(inv.paidAmount)}</p>
            </div>
            <div className="p-3 bg-primary/5 rounded-lg text-center">
              <p className="text-body-sm text-body-grey">Sisa</p>
              <p className="text-title-md font-bold text-primary mt-1">{fmtIDR(inv.remainingAmount)}</p>
            </div>
          </div>

          {/* Info */}
          <div className="grid grid-cols-2 gap-3 text-body-sm">
            <div>
              <span className="text-body-grey">Tanggal Invoice</span>
              <p className="text-on-surface mt-0.5">{fmtDate(inv.invoiceDate)}</p>
            </div>
            <div>
              <span className="text-body-grey">Jatuh Tempo</span>
              <p className={`mt-0.5 font-medium ${overdue ? 'text-error' : 'text-on-surface'}`}>{fmtDate(inv.dueDate)}</p>
            </div>
            <div>
              <span className="text-body-grey">Akun Piutang</span>
              <p className="text-on-surface mt-0.5">{inv.receivableAccount.code} — {inv.receivableAccount.name}</p>
            </div>
            <div>
              <span className="text-body-grey">Akun Pendapatan</span>
              <p className="text-on-surface mt-0.5">{inv.revenueAccount.code} — {inv.revenueAccount.name}</p>
            </div>
            {inv.taxRate !== '0' && (
              <div>
                <span className="text-body-grey">Subtotal / PPN {inv.taxRate}%</span>
                <p className="text-on-surface mt-0.5">{fmtIDR(inv.subtotal)} + {fmtIDR(inv.taxAmount)}</p>
              </div>
            )}
            {inv.notes && (
              <div className="col-span-2">
                <span className="text-body-grey">Catatan</span>
                <p className="text-on-surface mt-0.5">{inv.notes}</p>
              </div>
            )}
          </div>

          {/* Line items */}
          {inv.items.length > 0 && (
            <div>
              <p className="text-label-sm font-semibold text-body-grey uppercase tracking-wide mb-2">Item Invoice</p>
              <table className="w-full text-body-sm border border-outline-variant rounded-lg overflow-hidden">
                <thead className="bg-surface-container">
                  <tr>
                    <th className="text-left px-3 py-2 text-body-grey">Deskripsi</th>
                    <th className="text-right px-3 py-2 text-body-grey">Qty</th>
                    <th className="text-right px-3 py-2 text-body-grey">Harga</th>
                    <th className="text-right px-3 py-2 text-body-grey">Jumlah</th>
                  </tr>
                </thead>
                <tbody>
                  {inv.items.map(it => (
                    <tr key={it.id} className="border-t border-outline-variant/50">
                      <td className="px-3 py-2">{it.description}</td>
                      <td className="px-3 py-2 text-right">{parseFloat(it.quantity)}</td>
                      <td className="px-3 py-2 text-right font-mono">{fmtIDR(it.unitPrice)}</td>
                      <td className="px-3 py-2 text-right font-mono font-medium">{fmtIDR(it.amount)}</td>
                    </tr>
                  ))}
                  {parseFloat(inv.taxRate) > 0 && (
                    <>
                      <tr className="border-t border-outline-variant/50 bg-surface-container/50">
                        <td colSpan={3} className="px-3 py-1.5 text-right text-body-grey">Subtotal</td>
                        <td className="px-3 py-1.5 text-right font-mono">{fmtIDR(inv.subtotal)}</td>
                      </tr>
                      <tr className="bg-surface-container/50">
                        <td colSpan={3} className="px-3 py-1.5 text-right text-body-grey">PPN {inv.taxRate}%</td>
                        <td className="px-3 py-1.5 text-right font-mono">{fmtIDR(inv.taxAmount)}</td>
                      </tr>
                    </>
                  )}
                  <tr className="border-t border-outline-variant bg-surface-container">
                    <td colSpan={3} className="px-3 py-2 text-right font-bold text-on-surface">TOTAL</td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-primary">{fmtIDR(inv.totalAmount)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Journal entries */}
          {inv.journal?.entries && inv.journal.entries.length > 0 && (
            <div>
              <p className="text-label-sm font-semibold text-body-grey uppercase tracking-wide mb-2">
                Jurnal ({inv.journal.journalNumber}){' '}
                <span className={`ml-1 px-1.5 py-0.5 rounded text-label-sm ${JOURNAL_CFG[inv.journal.status].color}`}>
                  {JOURNAL_CFG[inv.journal.status].label}
                </span>
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
                  {inv.journal.entries.map(e => (
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
          {inv.payments.length > 0 && (
            <div>
              <p className="text-label-sm font-semibold text-body-grey uppercase tracking-wide mb-2">Riwayat Pembayaran</p>
              <div className="space-y-2">
                {inv.payments.map(p => (
                  <div key={p.id} className="p-3 bg-surface-container rounded-lg border border-outline-variant/50">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-body-sm font-medium text-on-surface">{fmtDate(p.paymentDate)}</p>
                        <p className="text-label-sm text-body-grey">{p.cashAccount.code} — {p.cashAccount.name}</p>
                        {p.description && <p className="text-label-sm text-body-grey mt-0.5">{p.description}</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-body-sm font-bold text-success-green font-mono">{fmtIDR(p.amount)}</p>
                        <p className="text-label-sm text-body-grey">{p.journal.journalNumber}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-outline-variant flex flex-wrap gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">Tutup</button>
          {canVoid && (
            <button onClick={onVoid} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-error-container text-on-error-container font-medium hover:opacity-90 disabled:opacity-50 text-body-sm">
              <Ban className="w-4 h-4" />
              {loading ? 'Proses...' : 'Batalkan Invoice'}
            </button>
          )}
          {canApprove && (
            <button onClick={onApprove} disabled={loading}
              className="flex items-center gap-2 btn-primary disabled:opacity-50">
              <Send className="w-4 h-4" />
              {loading ? 'Proses...' : 'Setujui & Post ke GL'}
            </button>
          )}
          {canPay && (
            <button onClick={onPayment} disabled={loading}
              className="flex items-center gap-2 btn-primary disabled:opacity-50">
              <CreditCard className="w-4 h-4" />
              Catat Pembayaran
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function InvoicePage() {
  const qc = useQueryClient()
  const [filterStatus,  setFilterStatus]  = useState('')
  const [search,        setSearch]        = useState('')
  const [showCreate,    setShowCreate]    = useState(false)
  const [viewInv,       setViewInv]       = useState<Invoice | null>(null)
  const [paymentInv,    setPaymentInv]    = useState<Invoice | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const { data: resp, isLoading, isError, refetch } = useQuery({
    queryKey: ['invoices', filterStatus, search],
    queryFn:  () => fetchInvoices(filterStatus, search),
  })

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn:  fetchAccounts,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['invoices'] })

  const doAction = async (id: number, action: string) => {
    setActionLoading(true)
    try {
      const res  = await fetch(`/api/invoices/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      invalidate()
      if (viewInv?.id === id) setViewInv(json.data)
    } finally {
      setActionLoading(false)
    }
  }

  const rows         = resp?.data ?? []
  const meta         = resp?.meta
  const overdueCount = rows.filter(isOverdue).length

  if (isLoading) return <div className="p-6"><LoadingSkeleton /></div>
  if (isError)   return <div className="p-6"><ErrorState message="Gagal memuat data invoice" onRetry={refetch} /></div>

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-container flex items-center justify-center text-primary">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-headline-sm font-bold text-on-surface">Invoice</h1>
            <p className="text-body-sm text-body-grey">Faktur Penjualan</p>
          </div>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Buat Invoice
        </button>
      </div>

      {/* Summary Cards */}
      {meta && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card-elevated p-4">
            <p className="text-body-sm text-body-grey">Total Invoice</p>
            <p className="text-headline-sm font-bold text-on-surface mt-1">{fmtIDR(meta.totalAmount)}</p>
            <p className="text-label-sm text-body-grey mt-1">{meta.total} invoice</p>
          </div>
          <div className="card-elevated p-4">
            <p className="text-body-sm text-body-grey">Belum Lunas</p>
            <p className="text-headline-sm font-bold text-primary mt-1">{fmtIDR(meta.totalRemaining)}</p>
            <p className="text-label-sm text-body-grey mt-1">
              {rows.filter(r => r.status === 'SENT' || r.status === 'PARTIAL').length} invoice aktif
            </p>
          </div>
          <div className="card-elevated p-4">
            <p className="text-body-sm text-body-grey">Sudah Diterima</p>
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
            <p className="text-label-sm text-body-grey mt-1">invoice overdue</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card-elevated p-4 flex flex-wrap gap-3 items-center">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cari customer / nomor invoice..."
          className="input-field flex-1 min-w-[200px]"
        />
        <div className="flex gap-2 flex-wrap">
          {(['', 'DRAFT', 'SENT', 'PARTIAL', 'PAID', 'VOID'] as const).map(s => (
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
              header: 'No. Invoice',
              accessor: r => (
                <span className="font-mono text-body-sm text-primary font-medium">{r.invoiceNumber}</span>
              ),
            },
            {
              header: 'Customer',
              accessor: r => (
                <div>
                  <p className="font-medium text-on-surface">{r.customerName}</p>
                  {r.customerEmail && <p className="text-label-sm text-body-grey">{r.customerEmail}</p>}
                </div>
              ),
            },
            {
              header: 'Tgl Invoice',
              accessor: r => <span className="text-body-sm">{fmtDate(r.invoiceDate)}</span>,
            },
            {
              header: 'Jatuh Tempo',
              accessor: r => (
                <span className={isOverdue(r) ? 'text-error font-medium text-body-sm' : 'text-on-surface text-body-sm'}>
                  {fmtDate(r.dueDate)}
                  {isOverdue(r) && <span className="block text-label-sm">Overdue</span>}
                </span>
              ),
            },
            {
              header: 'Total',
              align:  'right',
              accessor: r => <span className="font-mono text-body-sm font-medium">{fmtIDR(r.totalAmount)}</span>,
            },
            {
              header: 'Sisa',
              align:  'right',
              accessor: r => (
                <span className={`font-mono text-body-sm ${parseFloat(r.remainingAmount) > 0 ? 'text-primary font-semibold' : 'text-body-grey'}`}>
                  {fmtIDR(r.remainingAmount)}
                </span>
              ),
            },
            {
              header: 'Status',
              align:  'center',
              accessor: r => (
                <span className={`px-2 py-0.5 rounded-full text-label-sm font-medium ${STATUS_CFG[r.status].color}`}>
                  {STATUS_CFG[r.status].label}
                </span>
              ),
            },
            {
              header: 'Aksi',
              align:  'center',
              accessor: r => (
                <div className="flex gap-1 justify-center">
                  <button onClick={() => setViewInv(r)} title="Detail"
                    className="p-1.5 rounded-lg hover:bg-surface-container-high text-body-grey hover:text-primary transition-colors">
                    <Eye className="w-4 h-4" />
                  </button>
                  {r.status === 'DRAFT' && (
                    <button onClick={() => doAction(r.id, 'approve')} disabled={actionLoading} title="Setujui"
                      className="p-1.5 rounded-lg hover:bg-success-green/10 text-body-grey hover:text-success-green transition-colors disabled:opacity-50">
                      <Send className="w-4 h-4" />
                    </button>
                  )}
                  {(r.status === 'SENT' || r.status === 'PARTIAL') && (
                    <button onClick={() => { setPaymentInv(r); setViewInv(null) }} title="Catat Pembayaran"
                      className="p-1.5 rounded-lg hover:bg-primary/10 text-body-grey hover:text-primary transition-colors">
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
          emptyMessage="Belum ada data invoice"
        />
      </div>

      {/* Modals */}
      {showCreate && (
        <CreateInvoiceForm
          accounts={accounts}
          onClose={()  => setShowCreate(false)}
          onSuccess={invalidate}
        />
      )}

      {viewInv && (
        <DetailModal
          invoice={viewInv}
          onClose={()    => setViewInv(null)}
          onApprove={() => doAction(viewInv.id, 'approve')}
          onVoid={()    => doAction(viewInv.id, 'void')}
          onPayment={()  => { setPaymentInv(viewInv); setViewInv(null) }}
          loading={actionLoading}
        />
      )}

      {paymentInv && (
        <PaymentForm
          invoice={paymentInv}
          accounts={accounts}
          onClose={()  => setPaymentInv(null)}
          onSuccess={() => { invalidate(); setPaymentInv(null) }}
        />
      )}
    </div>
  )
}
