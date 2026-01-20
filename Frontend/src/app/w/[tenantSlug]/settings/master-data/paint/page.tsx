"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Edit, Trash2, Palette, Droplet } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { apiFetch } from '@/lib/api'

interface ColorCode {
  id: string
  name?: string
  color_system: string
  hex_code?: string
  rgb_values?: { r: number; g: number; b: number }
  status: string
  created_at: string
}

interface TintFormula {
  id: string
  color_code_id: string
  name?: string
  base_paint_item: string
  output_volume_ml: number
  version: number
  is_active: boolean
  created_at: string
  components?: TintFormulaComponent[]
}

interface TintFormulaComponent {
  id: string
  tint_item_code: string
  quantity_per_unit: number
  unit_of_measure: string
  notes?: string
}

const COLOR_SYSTEMS = ['RAL', 'PANTONE', 'NCS', 'CUSTOM']

export default function PaintManagementPage() {
  const [colorCodes, setColorCodes] = useState<ColorCode[]>([])
  const [formulas, setFormulas] = useState<TintFormula[]>([])
  const [loading, setLoading] = useState(true)
  const [showColorDialog, setShowColorDialog] = useState(false)
  const [showFormulaDialog, setShowFormulaDialog] = useState(false)
  const [editingColor, setEditingColor] = useState<ColorCode | null>(null)
  const [editingFormula, setEditingFormula] = useState<TintFormula | null>(null)
  const [selectedColorForFormula, setSelectedColorForFormula] = useState<string>('')
  const [token, setToken] = useState<string>('')
  const { toast } = useToast()

  // Color code form
  const [colorForm, setColorForm] = useState({
    id: '',
    name: '',
    color_system: 'CUSTOM',
    hex_code: '',
    status: 'ACTIVE'
  })

  // Formula form
  const [formulaForm, setFormulaForm] = useState({
    color_code_id: '',
    name: '',
    base_paint_item: '',
    output_volume_ml: 1000,
    components: [] as TintFormulaComponent[]
  })

  useEffect(() => {
    const storedToken = localStorage.getItem('moran_jwt_token') || localStorage.getItem('auth_token')
    if (storedToken) {
      setToken(storedToken)
      loadData(storedToken)
    }
  }, [])

  const loadData = async (authToken: string) => {
    try {
      setLoading(true)

      // Load color codes
      const colorsRes = await apiFetch('/paint/color-codes', {}, authToken)
      setColorCodes(colorsRes.data || [])

      // Load formulas
      const formulasRes = await apiFetch('/paint/formulas', {}, authToken)
      setFormulas(formulasRes.data || [])

    } catch (error) {
      console.error('Failed to load paint data:', error)
      toast({
        title: "Error",
        description: "Failed to load paint management data",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreateColor = async () => {
    try {
      const rgbValues = colorForm.hex_code ?
        { r: parseInt(colorForm.hex_code.slice(1, 3), 16),
          g: parseInt(colorForm.hex_code.slice(3, 5), 16),
          b: parseInt(colorForm.hex_code.slice(5, 7), 16) } : undefined

      const data = {
        ...colorForm,
        rgb_values: rgbValues
      }

      await apiFetch('/paint/color-codes', {
        method: 'POST',
        body: JSON.stringify(data)
      }, token)

      toast({
        title: "Success",
        description: "Color code created successfully"
      })

      setShowColorDialog(false)
      setColorForm({ id: '', name: '', color_system: 'CUSTOM', hex_code: '', status: 'ACTIVE' })
      loadData(token)

    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create color code",
        variant: "destructive"
      })
    }
  }

  const handleCreateFormula = async () => {
    try {
      await apiFetch('/paint/formulas', {
        method: 'POST',
        body: JSON.stringify(formulaForm)
      }, token)

      toast({
        title: "Success",
        description: "Tint formula created successfully"
      })

      setShowFormulaDialog(false)
      setFormulaForm({
        color_code_id: '',
        name: '',
        base_paint_item: '',
        output_volume_ml: 1000,
        components: []
      })
      loadData(token)

    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create tint formula",
        variant: "destructive"
      })
    }
  }

  const addComponent = () => {
    setFormulaForm(prev => ({
      ...prev,
      components: [...prev.components, {
        id: '',
        tint_item_code: '',
        quantity_per_unit: 0,
        unit_of_measure: 'ml',
        notes: ''
      }]
    }))
  }

  const updateComponent = (index: number, field: string, value: any) => {
    setFormulaForm(prev => ({
      ...prev,
      components: prev.components.map((comp, i) =>
        i === index ? { ...comp, [field]: value } : comp
      )
    }))
  }

  const removeComponent = (index: number) => {
    setFormulaForm(prev => ({
      ...prev,
      components: prev.components.filter((_, i) => i !== index)
    }))
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Palette className="mx-auto h-8 w-8 text-gray-400 animate-pulse" />
            <p className="mt-2 text-sm text-gray-500">Loading paint management...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Paint Management</h1>
          <p className="text-gray-600">Manage color codes and tint formulas for custom paint sales</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={showColorDialog} onOpenChange={setShowColorDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Color Code
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add Color Code</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="color-id">Color Code ID</Label>
                  <Input
                    id="color-id"
                    placeholder="e.g., RAL-5015"
                    value={colorForm.id}
                    onChange={(e) => setColorForm(prev => ({ ...prev, id: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="color-name">Color Name (Optional)</Label>
                  <Input
                    id="color-name"
                    placeholder="e.g., Sky Blue"
                    value={colorForm.name}
                    onChange={(e) => setColorForm(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="color-system">Color System</Label>
                  <Select
                    value={colorForm.color_system}
                    onValueChange={(value) => setColorForm(prev => ({ ...prev, color_system: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COLOR_SYSTEMS.map(system => (
                        <SelectItem key={system} value={system}>{system}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="hex-code">Hex Code (Optional)</Label>
                  <Input
                    id="hex-code"
                    placeholder="#RRGGBB"
                    value={colorForm.hex_code}
                    onChange={(e) => setColorForm(prev => ({ ...prev, hex_code: e.target.value }))}
                  />
                </div>
                <Button onClick={handleCreateColor} className="w-full">
                  Create Color Code
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={showFormulaDialog} onOpenChange={setShowFormulaDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Droplet className="h-4 w-4 mr-2" />
                Add Tint Formula
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add Tint Formula</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="formula-color">Color Code</Label>
                    <Select
                      value={formulaForm.color_code_id}
                      onValueChange={(value) => setFormulaForm(prev => ({ ...prev, color_code_id: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select color code" />
                      </SelectTrigger>
                      <SelectContent>
                        {colorCodes.map(color => (
                          <SelectItem key={color.id} value={color.id}>
                            {color.id} {color.name ? `(${color.name})` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="formula-name">Formula Name (Optional)</Label>
                    <Input
                      id="formula-name"
                      placeholder="e.g., Standard Formula"
                      value={formulaForm.name}
                      onChange={(e) => setFormulaForm(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="base-paint">Base Paint Item</Label>
                    <Input
                      id="base-paint"
                      placeholder="e.g., BASE-A-WHITE"
                      value={formulaForm.base_paint_item}
                      onChange={(e) => setFormulaForm(prev => ({ ...prev, base_paint_item: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="output-volume">Output Volume (ml)</Label>
                    <Input
                      id="output-volume"
                      type="number"
                      value={formulaForm.output_volume_ml}
                      onChange={(e) => setFormulaForm(prev => ({ ...prev, output_volume_ml: parseInt(e.target.value) || 1000 }))}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Tint Components</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addComponent}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add Component
                    </Button>
                  </div>

                  {formulaForm.components.map((component, index) => (
                    <div key={index} className="flex gap-2 items-end mb-2 p-3 border rounded">
                      <div className="flex-1">
                        <Label className="text-xs">Tint Item Code</Label>
                        <Input
                          placeholder="e.g., TINT-BLUE-001"
                          value={component.tint_item_code}
                          onChange={(e) => updateComponent(index, 'tint_item_code', e.target.value)}
                        />
                      </div>
                      <div className="w-24">
                        <Label className="text-xs">Quantity</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={component.quantity_per_unit}
                          onChange={(e) => updateComponent(index, 'quantity_per_unit', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="w-20">
                        <Label className="text-xs">Unit</Label>
                        <Select
                          value={component.unit_of_measure}
                          onValueChange={(value) => updateComponent(index, 'unit_of_measure', value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ml">ml</SelectItem>
                            <SelectItem value="g">g</SelectItem>
                            <SelectItem value="kg">kg</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeComponent(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                <Button onClick={handleCreateFormula} className="w-full">
                  Create Tint Formula
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="colors" className="space-y-4">
        <TabsList>
          <TabsTrigger value="colors">Color Codes</TabsTrigger>
          <TabsTrigger value="formulas">Tint Formulas</TabsTrigger>
          <TabsTrigger value="manage">Manage Formulas</TabsTrigger>
        </TabsList>

        <TabsContent value="colors">
          <Card>
            <CardHeader>
              <CardTitle>Color Codes</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Color Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>System</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {colorCodes.map(color => (
                    <TableRow key={color.id}>
                      <TableCell className="font-medium">{color.id}</TableCell>
                      <TableCell>{color.name || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{color.color_system}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={color.status === 'ACTIVE' ? 'default' : 'secondary'}>
                          {color.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="formulas">
          <Card>
            <CardHeader>
              <CardTitle>Tint Formulas</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Color Code</TableHead>
                    <TableHead>Formula Name</TableHead>
                    <TableHead>Base Paint</TableHead>
                    <TableHead>Output Volume</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {formulas.map(formula => (
                    <TableRow key={formula.id}>
                      <TableCell className="font-medium">{formula.color_code_id}</TableCell>
                      <TableCell>{formula.name || '-'}</TableCell>
                      <TableCell>{formula.base_paint_item}</TableCell>
                      <TableCell>{formula.output_volume_ml} ml</TableCell>
                      <TableCell>v{formula.version}</TableCell>
                      <TableCell>
                        <Badge variant={formula.is_active ? 'default' : 'secondary'}>
                          {formula.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manage" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Formula Management</CardTitle>
              <p className="text-sm text-muted-foreground">
                Select a color code to create or edit its tint formula
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Color Code Selector */}
              <div>
                <Label htmlFor="color-select">Select Color Code</Label>
                <Select value={selectedColorForFormula} onValueChange={setSelectedColorForFormula}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a color code to manage" />
                  </SelectTrigger>
                  <SelectContent>
                    {colorCodes.map(color => (
                      <SelectItem key={color.id} value={color.id}>
                        {color.id} - {color.name || 'Unnamed'} ({color.color_system})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedColorForFormula && (
                <div className="space-y-4">
                  {/* Current Formula Display */}
                  {(() => {
                    const existingFormula = formulas.find(f => f.color_code_id === selectedColorForFormula && f.is_active)
                    return existingFormula ? (
                      <Card className="border-green-200">
                        <CardHeader>
                          <CardTitle className="text-green-800">Active Formula</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2 text-sm">
                            <p><strong>Base Paint:</strong> {existingFormula.base_paint_item}</p>
                            <p><strong>Output Volume:</strong> {existingFormula.output_volume_ml} ml</p>
                            <p><strong>Version:</strong> {existingFormula.version}</p>
                            <p><strong>Components:</strong> {existingFormula.components?.length || 0} tints</p>
                          </div>
                          <div className="mt-4 flex gap-2">
                            <Button
                              variant="outline"
                              onClick={() => {
                                // Load existing formula for editing
                                setEditingFormula(existingFormula)
                                setFormulaForm({
                                  color_code_id: existingFormula.color_code_id,
                                  name: existingFormula.name || '',
                                  base_paint_item: existingFormula.base_paint_item,
                                  output_volume_ml: existingFormula.output_volume_ml,
                                  components: existingFormula.components?.map(c => ({
                                    id: c.id,
                                    tint_item_code: c.tint_item_code,
                                    quantity_per_unit: c.quantity_per_unit,
                                    unit_of_measure: c.unit_of_measure,
                                    notes: c.notes || ''
                                  })) || []
                                })
                                setShowFormulaDialog(true)
                              }}
                            >
                              Edit Formula
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ) : (
                      <Card className="border-orange-200">
                        <CardHeader>
                          <CardTitle className="text-orange-800">No Active Formula</CardTitle>
                          <p className="text-sm text-orange-600">
                            This color code doesn't have an active tint formula yet.
                          </p>
                        </CardHeader>
                        <CardContent>
                          <Button
                            onClick={() => {
                              setFormulaForm({
                                color_code_id: selectedColorForFormula,
                                name: '',
                                base_paint_item: '',
                                output_volume_ml: 1000,
                                components: [{
                                  id: '',
                                  tint_item_code: '',
                                  quantity_per_unit: 0,
                                  unit_of_measure: 'ml',
                                  notes: ''
                                }]
                              })
                              setShowFormulaDialog(true)
                            }}
                          >
                            Create Formula
                          </Button>
                        </CardContent>
                      </Card>
                    )
                  })()}

                  {/* Formula History */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Formula History</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {formulas
                          .filter(f => f.color_code_id === selectedColorForFormula)
                          .sort((a, b) => b.version - a.version)
                          .map(formula => (
                            <div key={formula.id} className="flex items-center justify-between p-3 border rounded">
                              <div>
                                <p className="font-medium">Version {formula.version}</p>
                                <p className="text-sm text-muted-foreground">
                                  {formula.name || 'Unnamed'} • {formula.base_paint_item}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant={formula.is_active ? "default" : "secondary"}>
                                  {formula.is_active ? "Active" : "Inactive"}
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    // Load formula details
                                    // This would need an API call to get full formula with components
                                  }}
                                >
                                  View
                                </Button>
                              </div>
                            </div>
                          ))}
                        {formulas.filter(f => f.color_code_id === selectedColorForFormula).length === 0 && (
                          <p className="text-muted-foreground text-center py-4">
                            No formulas created yet for this color code.
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}