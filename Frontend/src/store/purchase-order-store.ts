import { create } from 'zustand'

interface PurchaseOrderItem {
  item_code: string
  item_name?: string
  qty: number
  rate: number
  amount: number
  uom?: string
  warehouse?: string
}

interface PurchaseOrderFormData {
  supplier?: string
  supplier_id?: string
  warehouse?: string
  payment_terms?: string
  delivery_date?: string
  notes?: string
  items: PurchaseOrderItem[]
  total: number
}

interface PurchaseOrderStore {
  formData: PurchaseOrderFormData
  loading: boolean
  updateHeader: (field: string, value: any) => void
  addItem: (item: PurchaseOrderItem) => void
  removeItem: (index: number) => void
  updateItem: (index: number, field: string, value: any) => void
  calculateTotal: () => number
  setLoading: (loading: boolean) => void
  reset: () => void
}

const initialFormData: PurchaseOrderFormData = {
  items: [],
  total: 0
}

export const usePurchaseOrderStore = create<PurchaseOrderStore>((set, get) => ({
  formData: initialFormData,
  loading: false,
  
  updateHeader: (field, value) => {
    set((state) => ({
      formData: {
        ...state.formData,
        [field]: value
      }
    }))
  },
  
  addItem: (item) => {
    set((state) => ({
      formData: {
        ...state.formData,
        items: [...state.formData.items, item]
      }
    }))
    get().calculateTotal()
  },
  
  removeItem: (index) => {
    set((state) => ({
      formData: {
        ...state.formData,
        items: state.formData.items.filter((_, i) => i !== index)
      }
    }))
    get().calculateTotal()
  },
  
  updateItem: (index, field, value) => {
    set((state) => ({
      formData: {
        ...state.formData,
        items: state.formData.items.map((item, i) => 
          i === index ? { ...item, [field]: value } : item
        )
      }
    }))
    get().calculateTotal()
  },
  
  calculateTotal: () => {
    const state = get()
    const total = state.formData.items.reduce((sum, item) => sum + (item.amount || 0), 0)
    set((state) => ({
      formData: {
        ...state.formData,
        total
      }
    }))
    return total
  },
  
  setLoading: (loading) => {
    set({ loading })
  },
  
  reset: () => {
    set({ formData: initialFormData, loading: false })
  }
}))
