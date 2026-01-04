'use client'

import { useState } from 'react'
import { X, Upload, FileText } from 'lucide-react'
import Logo from './Logo'

interface CSVImportModalProps {
  onClose: () => void
  onSuccess: () => void
}

export default function CSVImportModal({ onClose, onSuccess }: CSVImportModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<any[]>([])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    if (!selectedFile.name.endsWith('.csv')) {
      setError('Alleen CSV bestanden zijn toegestaan')
      return
    }

    setFile(selectedFile)
    setError(null)

    // Preview CSV
    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      const lines = text.split('\n').filter(line => line.trim())
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
      
      // Parse first 5 rows as preview
      const previewData = []
      for (let i = 1; i < Math.min(6, lines.length); i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''))
        const row: any = {}
        headers.forEach((header, index) => {
          row[header] = values[index] || ''
        })
        previewData.push(row)
      }
      setPreview(previewData)
    }
    reader.readAsText(selectedFile)
  }

  const parseCSV = (text: string): any[] => {
    const lines = text.split('\n').filter(line => line.trim())
    if (lines.length < 2) return []

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, '').toLowerCase())
    const orders: any[] = []

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''))
      if (values.length === 0 || !values[0]) continue

      const order: any = {}
      headers.forEach((header, index) => {
        const value = values[index] || ''
        
        // Map CSV columns to our order structure
        if (header.includes('order') && header.includes('number')) {
          order.shopify_order_number = value
        } else if (header.includes('order') && header.includes('id')) {
          order.shopify_order_id = parseInt(value) || null
        } else if (header.includes('email')) {
          order.customer_email = value
        } else if (header.includes('first') && header.includes('name')) {
          order.customer_first_name = value
        } else if (header.includes('status')) {
          order.status = value.toLowerCase() || 'pending'
        } else if (header.includes('total') || header.includes('amount')) {
          order.total_amount = parseFloat(value) || null
        } else if (header.includes('currency')) {
          order.currency = value || 'EUR'
        } else if (header.includes('created') || header.includes('date')) {
          order.created_at = value
        } else if (header.includes('product') || header.includes('item')) {
          // Handle order items (comma-separated or JSON)
          if (!order.order_items) order.order_items = []
          if (value) {
            order.order_items.push({
              product_name: value,
              quantity: 1,
              price: 0,
            })
          }
        }
      })

      // Ensure required fields
      if (!order.shopify_order_number && !order.shopify_order_id) {
        console.warn(`Skipping row ${i + 1}: missing order number/ID`)
        continue
      }

      if (!order.customer_first_name) {
        console.warn(`Skipping row ${i + 1}: missing first name`)
        continue
      }

      orders.push(order)
    }

    return orders
  }

  const handleImport = async () => {
    if (!file) {
      setError('Selecteer eerst een CSV bestand')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const text = await file.text()
      const orders = parseCSV(text)

      if (orders.length === 0) {
        setError('Geen geldige orders gevonden in CSV bestand')
        setLoading(false)
        return
      }

      const response = await fetch('/api/admin/orders/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ orders }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Import mislukt')
      }

      if (data.errors > 0) {
        alert(`Import voltooid met ${data.imported} nieuwe orders, ${data.updated} bijgewerkt, ${data.errors} fouten.`)
      } else {
        alert(`Succesvol geïmporteerd: ${data.imported} nieuwe orders, ${data.updated} bijgewerkt.`)
      }

      onSuccess()
      onClose()
    } catch (error: any) {
      console.error('Import error:', error)
      setError(error.message || 'Fout bij importeren van CSV')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50">
        <Logo width={170} height={65} />
      </div>
      
      <div className="glass-strong rounded-2xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto mt-12">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-gray-900">
            Importeer Orders via CSV
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-2">CSV Formaat Vereisten:</h4>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li><strong>shopify_order_number</strong> of <strong>order_number</strong> (verplicht)</li>
              <li><strong>customer_first_name</strong> of <strong>first_name</strong> (verplicht)</li>
              <li><strong>customer_email</strong> of <strong>email</strong> (optioneel)</li>
              <li><strong>status</strong> (optioneel: pending, confirmed, in_transit, delivered)</li>
              <li><strong>total_amount</strong> (optioneel)</li>
              <li><strong>created_at</strong> (optioneel)</li>
            </ul>
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Selecteer CSV Bestand
            </label>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 px-4 py-2 bg-[#FF914D] text-white rounded-lg hover:bg-[#C4885E] cursor-pointer transition-colors">
                <Upload className="w-4 h-4" />
                Bestand Kiezen
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
              {file && (
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <FileText className="w-4 h-4" />
                  <span>{file.name}</span>
                  <span className="text-gray-500">({(file.size / 1024).toFixed(1)} KB)</span>
                </div>
              )}
            </div>
          </div>

          {/* Preview */}
          {preview.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                Preview (eerste {preview.length} rijen):
              </h4>
              <div className="overflow-x-auto border border-gray-300 rounded-lg">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      {Object.keys(preview[0]).map((key) => (
                        <th key={key} className="px-2 py-1 text-left font-semibold text-gray-700">
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {preview.map((row, i) => (
                      <tr key={i}>
                        {Object.values(row).map((value: any, j) => (
                          <td key={j} className="px-2 py-1 text-gray-600">
                            {value || '-'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Annuleren
            </button>
            <button
              onClick={handleImport}
              disabled={!file || loading}
              className="flex-1 px-4 py-2 bg-[#FF914D] text-white rounded-lg hover:bg-[#C4885E] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Importeren...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Importeer Orders
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

