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
      
      // Detect separator
      const firstLine = lines[0]
      const hasTabs = firstLine.includes('\t')
      const separator = hasTabs ? '\t' : ','
      
      // Parse CSV with proper quote handling
      const parseLine = (line: string): string[] => {
        const result: string[] = []
        let current = ''
        let inQuotes = false
        
        for (let i = 0; i < line.length; i++) {
          const char = line[i]
          if (char === '"') {
            inQuotes = !inQuotes
          } else if ((char === separator || char === '\t') && !inQuotes) {
            result.push(current.trim())
            current = ''
          } else {
            current += char
          }
        }
        result.push(current.trim())
        return result
      }
      
      const headers = parseLine(lines[0])
      
      // Parse first 5 rows as preview (show key columns only for readability)
      const keyColumns = ['Name', 'Email', 'Billing Name', 'Shipping Name', 'Financial Status', 'Total', 'Lineitem name', 'Lineitem quantity']
      const previewData = []
      for (let i = 1; i < Math.min(6, lines.length); i++) {
        const values = parseLine(lines[i])
        const row: any = {}
        headers.forEach((header, index) => {
          // Only show key columns in preview
          if (keyColumns.includes(header) || index < 5) {
            row[header] = values[index] || ''
          }
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

    // Try to detect separator (tab or comma)
    const firstLine = lines[0]
    const hasTabs = firstLine.includes('\t')
    const separator = hasTabs ? '\t' : ','
    
    // Parse headers - handle quoted values
    const parseLine = (line: string): string[] => {
      const result: string[] = []
      let current = ''
      let inQuotes = false
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i]
        if (char === '"') {
          inQuotes = !inQuotes
        } else if ((char === separator || char === '\t') && !inQuotes) {
          result.push(current.trim())
          current = ''
        } else {
          current += char
        }
      }
      result.push(current.trim())
      return result
    }
    
    const headers = parseLine(lines[0])
    
    // Group orders by order number (since each line item is a separate row)
    const ordersMap = new Map<string, any>()

    for (let i = 1; i < lines.length; i++) {
      const values = parseLine(lines[i])
      if (values.length === 0 || !values[0]) continue

      // Find order number - check "Name" column (first column with #) or look for order number pattern
      let orderNumber = ''
      let orderNumberIndex = -1
      
      // Check if first column is "Name" and contains order number
      if (headers[0] === 'Name' || headers[0].toLowerCase().includes('name')) {
        const nameValue = values[0] || ''
        const match = nameValue.match(/#?(\d+)/)
        if (match) {
          orderNumber = match[1]
          orderNumberIndex = 0
        }
      }
      
      // If not found, look for "Id" column
      if (!orderNumber) {
        const idIndex = headers.findIndex(h => h === 'Id' || h.toLowerCase() === 'id')
        if (idIndex >= 0 && values[idIndex]) {
          orderNumber = values[idIndex].replace('#', '').trim()
          orderNumberIndex = idIndex
        }
      }
      
      if (!orderNumber) {
        console.warn(`Skipping row ${i + 1}: missing order number. First value: ${values[0]}`)
        continue
      }

      // Get or create order object
      let order = ordersMap.get(orderNumber)
      if (!order) {
        order = {
          shopify_order_number: orderNumber,
          order_items: [],
        }
        
        // Extract order-level data (only once per order)
        headers.forEach((header, index) => {
          const value = values[index] || ''
          
          if (header === 'Email' || header === 'Order Email') {
            order.customer_email = value
          } else if (header === 'Billing Name') {
            // Extract first name from full name
            if (value && !order.customer_first_name) {
              const nameParts = value.trim().split(/\s+/)
              order.customer_first_name = nameParts[0] || value
            }
          } else if (header === 'Shipping Name') {
            // Use shipping name if billing name not available
            if (value && !order.customer_first_name) {
              const nameParts = value.trim().split(/\s+/)
              order.customer_first_name = nameParts[0] || value
            }
          } else if (header === 'Financial Status') {
            // Map financial status to our status
            const statusMap: Record<string, string> = {
              'paid': 'confirmed',
              'authorized': 'confirmed',
              'pending': 'pending',
              'refunded': 'cancelled',
              'partially_paid': 'pending',
              'partially_refunded': 'confirmed',
            }
            order.status = statusMap[value.toLowerCase()] || 'pending'
          } else if (header === 'Total') {
            order.total_amount = parseFloat(value) || null
          } else if (header === 'Currency') {
            order.currency = value || 'EUR'
          } else if (header === 'Created at') {
            order.created_at = value
          } else if (header === 'Id') {
            order.shopify_order_id = parseInt(value) || null
          }
        })
        
        ordersMap.set(orderNumber, order)
      }

      // Extract line item data (each row is a line item)
      const lineItem: any = {}
      headers.forEach((header, index) => {
        const value = values[index] || ''
        
        if (header === 'Lineitem name') {
          lineItem.product_name = value
        } else if (header === 'Lineitem quantity') {
          lineItem.quantity = parseInt(value) || 1
        } else if (header === 'Lineitem price') {
          lineItem.price = parseFloat(value) || 0
        } else if (header === 'Lineitem sku') {
          lineItem.sku = value
        }
      })

      // Add line item if it has a product name
      if (lineItem.product_name) {
        order.order_items.push(lineItem)
      }
    }

    // Convert map to array and validate
    const orders: any[] = []
    for (const [orderNumber, order] of ordersMap.entries()) {
      // Ensure required fields
      if (!order.shopify_order_number) {
        console.warn(`Skipping order ${orderNumber}: missing order number`)
        continue
      }

      if (!order.customer_first_name) {
        // Try to extract from email if no name found
        if (order.customer_email) {
          const emailParts = order.customer_email.split('@')[0]
          order.customer_first_name = emailParts.split('.')[0] || emailParts
        } else {
          console.warn(`Skipping order ${orderNumber}: missing first name`)
          continue
        }
      }

      // Default values
      if (!order.status) order.status = 'pending'
      if (!order.currency) order.currency = 'EUR'
      if (!order.order_items || order.order_items.length === 0) {
        order.order_items = []
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
            <h4 className="font-semibold text-blue-900 mb-2">Shopify CSV Formaat:</h4>
            <p className="text-sm text-blue-800 mb-2">
              Het systeem ondersteunt de standaard Shopify export CSV (tab-gescheiden).
            </p>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li><strong>Order nummer</strong> (eerste kolom, format: #1751) - verplicht</li>
              <li><strong>Billing Name</strong> of <strong>Shipping Name</strong> - gebruikt voor voornaam</li>
              <li><strong>Order Email</strong> - klant e-mail</li>
              <li><strong>Financial Status</strong> - order status</li>
              <li><strong>Total</strong> - totaalbedrag</li>
              <li><strong>Lineitem name</strong> - product naam</li>
              <li><strong>Lineitem quantity</strong> - hoeveelheid</li>
            </ul>
            <p className="text-xs text-blue-700 mt-2">
              <strong>Let op:</strong> Elke regel in de CSV is een order item. Orders met meerdere items worden automatisch gegroepeerd.
            </p>
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

