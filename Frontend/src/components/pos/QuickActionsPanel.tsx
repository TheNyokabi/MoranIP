"use client"

import React, { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { apiFetch } from '@/lib/api'
import { useAuthStore } from '@/store/auth-store'
import { Loader2, Search, Users, Package, RotateCcw, Zap, Plus, ShoppingCart } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface FrequentItem {
  item_code: string
  item_name: string
  standard_rate: number
  image?: string
  total_sold_qty: number
  frequency_rank: number
}

interface RecentCustomer {
  customer: string
  customer_name: string
  customer_type: string
  phone?: string
  email?: string
  last_purchase_date: string
  last_amount: number
  purchase_count: number
}

interface SearchResult {
  item_code: string
  item_name: string
  standard_rate: number
  barcode?: string
  image?: string
  stock_uom: string
}

export interface QuickActionsPanelProps {
  posProfileId: string
  onItemAdd: (item: any) => void
  onCustomerSelect: (customer: any) => void
  onQuickSale: (data: any) => void
  onBarcodeScan: (barcode: any) => void
  onRepeatSale: (saleData: any) => void
  onBulkAdd: (items: any[]) => void
}

export function QuickActionsPanel({
  posProfileId,
  onItemAdd,
  onCustomerSelect,
  onQuickSale,
  onRepeatSale,
  onBulkAdd
}: QuickActionsPanelProps) {
  const { token } = useAuthStore()
  const { toast } = useToast()

  const [frequentItems, setFrequentItems] = useState<FrequentItem[]>([])
  const [recentCustomers, setRecentCustomers] = useState<RecentCustomer[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'frequent' | 'customers' | 'search'>('frequent')

  // Load frequent items and recent customers on mount
  useEffect(() => {
    if (posProfileId && token) {
      loadFrequentItems()
      loadRecentCustomers()
    }
  }, [posProfileId, token])

  const loadFrequentItems = async () => {
    try {
      const response = await apiFetch(
        `/pos/quick-actions/frequent-items?pos_profile_id=${posProfileId}&limit=12`,
        {},
        token
      )
      setFrequentItems((response as any).frequent_items || [])
    } catch (error) {
      console.error('Failed to load frequent items:', error)
      toast({
        title: "Error",
        description: "Failed to load frequent items",
        variant: "destructive"
      })
    }
  }

  const loadRecentCustomers = async () => {
    try {
      const response = await apiFetch(
        `/pos/quick-actions/recent-customers?pos_profile_id=${posProfileId}&limit=8`,
        {},
        token
      )
      setRecentCustomers((response as any).recent_customers || [])
    } catch (error) {
      console.error('Failed to load recent customers:', error)
      toast({
        title: "Error",
        description: "Failed to load recent customers",
        variant: "destructive"
      })
    }
  }

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      return
    }

    setSearchLoading(true)
    try {
      const response = await apiFetch(
        `/pos/quick-actions/search-items?q=${encodeURIComponent(query)}&pos_profile_id=${posProfileId}&limit=20`,
        {},
        token
      )
      setSearchResults((response as any).search_results || [])
    } catch (error) {
      console.error('Search failed:', error)
      toast({
        title: "Search Error",
        description: "Failed to search items",
        variant: "destructive"
      })
    } finally {
      setSearchLoading(false)
    }
  }, [posProfileId, token, toast])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        handleSearch(searchQuery)
      } else {
        setSearchResults([])
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery, handleSearch])

  const handleQuickSale = async (presetId: string) => {
    setLoading(true)
    try {
      const response = await apiFetch('/pos/quick-actions/quick-sale', {
        method: 'POST',
        body: JSON.stringify({
          preset_id: presetId,
          pos_profile_id: posProfileId
        })
      }, token)

      const res = response as any;
      onQuickSale(res.preset)
      toast({
        title: "Quick Sale",
        description: `${res.preset.name} ready for checkout`
      })
    } catch (error) {
      console.error('Quick sale failed:', error)
      toast({
        title: "Error",
        description: "Failed to load quick sale preset",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleRepeatSale = async (customer: string) => {
    setLoading(true)
    try {
      const response = await apiFetch('/pos/quick-actions/repeat-last-sale', {
        method: 'POST',
        body: JSON.stringify({
          customer,
          pos_profile_id: posProfileId
        })
      }, token)

      onRepeatSale((response as any).last_sale)
      toast({
        title: "Repeat Sale",
        description: `Last sale for ${customer} loaded`
      })
    } catch (error: any) {
      if (error.status === 404) {
        toast({
          title: "No Previous Sale",
          description: `No previous sales found for ${customer}`,
          variant: "destructive"
        })
      } else {
        console.error('Repeat sale failed:', error)
        toast({
          title: "Error",
          description: "Failed to load last sale",
          variant: "destructive"
        })
      }
    } finally {
      setLoading(false)
    }
  }

  const handleBulkAdd = async (items: any[]) => {
    setLoading(true)
    try {
      const response = await apiFetch('/pos/quick-actions/bulk-add', {
        method: 'POST',
        body: JSON.stringify({
          items,
          pos_profile_id: posProfileId
        })
      }, token)

      const res = response as any;
      onBulkAdd(res.items)
      toast({
        title: "Bulk Add",
        description: `Added ${res.total_items} items to cart`
      })
    } catch (error) {
      console.error('Bulk add failed:', error)
      toast({
        title: "Error",
        description: "Failed to add items in bulk",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // F1-F4 for quick actions
      if (event.key === 'F1' && event.ctrlKey) {
        event.preventDefault()
        setActiveTab('frequent')
      } else if (event.key === 'F2' && event.ctrlKey) {
        event.preventDefault()
        setActiveTab('customers')
      } else if (event.key === 'F3' && event.ctrlKey) {
        event.preventDefault()
        setActiveTab('search')
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [])

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Quick Actions
        </CardTitle>
        <div className="flex gap-1">
          <Button
            variant={activeTab === 'frequent' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('frequent')}
            className="text-xs"
          >
            <Package className="h-3 w-3 mr-1" />
            Frequent
          </Button>
          <Button
            variant={activeTab === 'customers' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('customers')}
            className="text-xs"
          >
            <Users className="h-3 w-3 mr-1" />
            Customers
          </Button>
          <Button
            variant={activeTab === 'search' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('search')}
            className="text-xs"
          >
            <Search className="h-3 w-3 mr-1" />
            Search
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-3">
        <ScrollArea className="h-[calc(100vh-300px)]">
          {activeTab === 'frequent' && (
            <div className="space-y-3">
              {/* Quick Sale Presets */}
              <div>
                <h4 className="text-sm font-medium mb-2">Quick Sales</h4>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickSale('coffee_small')}
                    disabled={loading}
                    className="text-xs h-8"
                  >
                    {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3 mr-1" />}
                    Small Coffee
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickSale('coffee_large')}
                    disabled={loading}
                    className="text-xs h-8"
                  >
                    {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3 mr-1" />}
                    Large Coffee
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Frequent Items */}
              <div>
                <h4 className="text-sm font-medium mb-2">Top Items (30 days)</h4>
                <div className="space-y-2">
                  {frequentItems.map((item) => (
                    <div
                      key={item.item_code}
                      className="flex items-center justify-between p-2 rounded-lg border hover:bg-accent cursor-pointer"
                      onClick={() => onItemAdd({
                        item_code: item.item_code,
                        item_name: item.item_name,
                        rate: item.standard_rate,
                        qty: 1
                      })}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            #{item.frequency_rank}
                          </Badge>
                          <div>
                            <p className="text-sm font-medium truncate">{item.item_name}</p>
                            <p className="text-xs text-muted-foreground">{item.item_code}</p>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">KES {item.standard_rate}</p>
                        <p className="text-xs text-muted-foreground">{item.total_sold_qty} sold</p>
                      </div>
                    </div>
                  ))}
                  {frequentItems.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No sales data available
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'customers' && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Recent Customers</h4>
              <div className="space-y-2">
                {recentCustomers.map((customer) => (
                  <div
                    key={customer.customer}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent cursor-pointer"
                    onClick={() => onCustomerSelect(customer.customer)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {customer.customer_type}
                        </Badge>
                        <div>
                          <p className="text-sm font-medium truncate">
                            {customer.customer_name || customer.customer}
                          </p>
                          {customer.phone && (
                            <p className="text-xs text-muted-foreground">{customer.phone}</p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRepeatSale(customer.customer)
                        }}
                        disabled={loading}
                        className="h-6 w-6 p-0"
                      >
                        <RotateCcw className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
                {recentCustomers.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No recent customers
                  </p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'search' && (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search items by code, name, or barcode..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {searchLoading && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="ml-2 text-sm text-muted-foreground">Searching...</span>
                </div>
              )}

              {!searchLoading && searchResults.length > 0 && (
                <div className="space-y-2">
                  {searchResults.map((item) => (
                    <div
                      key={item.item_code}
                      className="flex items-center justify-between p-2 rounded-lg border hover:bg-accent cursor-pointer"
                      onClick={() => onItemAdd({
                        item_code: item.item_code,
                        item_name: item.item_name,
                        rate: item.standard_rate,
                        qty: 1
                      })}
                    >
                      <div className="flex-1 min-w-0">
                        <div>
                          <p className="text-sm font-medium truncate">{item.item_name}</p>
                          <p className="text-xs text-muted-foreground">{item.item_code}</p>
                          {item.barcode && (
                            <p className="text-xs text-muted-foreground">Barcode: {item.barcode}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">KES {item.standard_rate}</p>
                        <p className="text-xs text-muted-foreground">{item.stock_uom}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!searchLoading && searchQuery && searchResults.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No items found for &quot;{searchQuery}&quot;
                </p>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Keyboard Shortcuts Help */}
        <div className="mt-4 pt-3 border-t">
          <p className="text-xs text-muted-foreground text-center">
            <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Ctrl+F1</kbd> Frequent Items •
            <kbd className="px-1 py-0.5 bg-muted rounded text-xs ml-1">Ctrl+F2</kbd> Customers •
            <kbd className="px-1 py-0.5 bg-muted rounded text-xs ml-1">Ctrl+F3</kbd> Search
          </p>
        </div>
      </CardContent>
    </Card>
  )
}