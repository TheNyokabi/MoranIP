"use client"

import * as React from "react"
import { useRouter, useParams } from "next/navigation"
import { useAuthStore } from "@/store/auth-store"
import { useTenantStore } from "@/store/tenant-store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Plus, Trash2, Edit2, Save, X, Calendar, Users, DollarSign, CheckCircle2, AlertCircle, Lightbulb } from "lucide-react"
import { apiCall } from "@/lib/api"
import { ErrorHandler } from "@/components/error-handler"
import { LoadingSpinner } from "@/components/loading-spinner"
import { StatusBadge } from "@/components/status-badge"
import { formatCurrency, formatDate, getDaysRemaining } from "@/lib/utils"

interface ProjectTask {
  id: string
  task_id: string
  task_title: string
  description?: string
  status: 'open' | 'in_progress' | 'completed' | 'cancelled'
  priority: 'low' | 'medium' | 'high' | 'critical'
  assigned_to?: string
  target_completion_date?: string
  completion_date?: string
}

interface Project {
  id: string
  project_name: string
  project_code: string
  customer?: string
  project_manager?: string
  description?: string
  status: 'planning' | 'active' | 'completed' | 'on_hold' | 'cancelled'
  start_date?: string
  end_date?: string
  expected_end_date?: string
  total_budget_amount?: number
  total_consumed_budget?: number
  progress?: number
  creation: string
  modified: string
}

const statusColors: Record<string, string> = {
  'planning': 'bg-blue-100 text-blue-800',
  'active': 'bg-green-100 text-green-800',
  'completed': 'bg-purple-100 text-purple-800',
  'on_hold': 'bg-yellow-100 text-yellow-800',
  'cancelled': 'bg-red-100 text-red-800'
}

const priorityColors: Record<string, string> = {
  'low': 'bg-gray-100 text-gray-800',
  'medium': 'bg-blue-100 text-blue-800',
  'high': 'bg-orange-100 text-orange-800',
  'critical': 'bg-red-100 text-red-800'
}

const taskStatusOptions = ['open', 'in_progress', 'completed', 'cancelled']
const priorityOptions = ['low', 'medium', 'high', 'critical']

export default function ProjectDetailPage() {
  const params = useParams() as { tenantSlug: string; projectId: string }
  const router = useRouter()
  const { token } = useAuthStore()
  const { currentTenant } = useTenantStore()
  
  const projectId = params.projectId
  const tenantSlug = params.tenantSlug
  
  const [project, setProject] = React.useState<Project | null>(null)
  const [tasks, setTasks] = React.useState<ProjectTask[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSaving, setIsSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [editMode, setEditMode] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState("details")
  
  const [formData, setFormData] = React.useState<Partial<Project>>({})
  const [newTask, setNewTask] = React.useState<Partial<ProjectTask>>({
    status: 'open',
    priority: 'medium'
  })
  const [editingTaskId, setEditingTaskId] = React.useState<string | null>(null)

  // Fetch project details
  React.useEffect(() => {
    const fetchProject = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const data = await apiCall(
          `${currentTenant?.id}/erp/projects/{projectId}`.replace('{projectId}', projectId),
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        )
        setProject(data.data || data)
        setFormData(data.data || data)
        
        // Fetch tasks
        const tasksData = await apiCall(
          `${currentTenant?.id}/erp/projects/{projectId}/tasks`.replace('{projectId}', projectId),
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        )
        setTasks(tasksData.data || tasksData || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load project')
      } finally {
        setIsLoading(false)
      }
    }

    if (currentTenant && token && projectId) {
      fetchProject()
    }
  }, [projectId, currentTenant, token])

  const handleSaveProject = async () => {
    if (!project) return
    setIsSaving(true)
    setError(null)
    try {
      const response = await apiCall(
        `${currentTenant?.id}/erp/projects/{projectId}`.replace('{projectId}', projectId),
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(formData)
        }
      )
      setProject(response.data || response)
      setFormData(response.data || response)
      setEditMode(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save project')
    } finally {
      setIsSaving(false)
    }
  }

  const handleAddTask = async () => {
    if (!newTask.task_title?.trim()) {
      setError('Task title is required')
      return
    }
    
    setIsSaving(true)
    setError(null)
    try {
      const taskData = {
        project: projectId,
        title: newTask.task_title,
        description: newTask.description || '',
        status: newTask.status || 'open',
        priority: newTask.priority || 'medium',
        assigned_to: newTask.assigned_to || null,
        target_completion_date: newTask.target_completion_date || null
      }
      
      const response = await apiCall(
        `${currentTenant?.id}/erp/projects/{projectId}/tasks`.replace('{projectId}', projectId),
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(taskData)
        }
      )
      
      setTasks([...tasks, response.data || response])
      setNewTask({ status: 'open', priority: 'medium' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add task')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return
    
    setIsSaving(true)
    setError(null)
    try {
      await apiCall(
        `${currentTenant?.id}/erp/projects/{projectId}/tasks/{taskId}`
          .replace('{projectId}', projectId)
          .replace('{taskId}', taskId),
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      )
      setTasks(tasks.filter(t => t.id !== taskId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete task')
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpdateTask = async (task: ProjectTask) => {
    setIsSaving(true)
    setError(null)
    try {
      const response = await apiCall(
        `${currentTenant?.id}/erp/projects/{projectId}/tasks/{taskId}`
          .replace('{projectId}', projectId)
          .replace('{taskId}', task.id),
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(task)
        }
      )
      setTasks(tasks.map(t => t.id === task.id ? (response.data || response) : t))
      setEditingTaskId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update task')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return <LoadingSpinner />
  }

  if (!project) {
    return (
      <div className="space-y-4">
        <ErrorHandler error="Project not found" />
        <Button onClick={() => router.back()}>Go Back</Button>
      </div>
    )
  }

  const daysRemaining = project.expected_end_date ? getDaysRemaining(project.expected_end_date) : null
  const progressPercent = project.progress || 0
  const budgetUsed = project.total_consumed_budget || 0
  const budgetTotal = project.total_budget_amount || 0
  const budgetPercent = budgetTotal > 0 ? (budgetUsed / budgetTotal) * 100 : 0

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{project.project_name || 'Project'}</h1>
          <p className="text-sm text-gray-600 mt-1">{project.project_code}</p>
        </div>
        {!editMode ? (
          <Button onClick={() => setEditMode(true)} variant="outline">
            <Edit2 className="w-4 h-4 mr-2" />
            Edit
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button onClick={handleSaveProject} disabled={isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save
            </Button>
            <Button onClick={() => {
              setEditMode(false)
              setFormData(project)
            }} variant="ghost">
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Customer */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Customer</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formData.customer || project.customer || 'N/A'}</div>
            <p className="text-xs text-gray-500 mt-1">Project Owner</p>
          </CardContent>
        </Card>

        {/* Project Manager */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Project Manager</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formData.project_manager || project.project_manager || 'Unassigned'}</div>
            <p className="text-xs text-gray-500 mt-1">Lead</p>
          </CardContent>
        </Card>

        {/* Status */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusBadge status={formData.status || project.status} />
            <p className="text-xs text-gray-500 mt-2">{daysRemaining !== null && daysRemaining >= 0 ? `${daysRemaining} days left` : 'Overdue'}</p>
          </CardContent>
        </Card>

        {/* Budget */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Budget</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(budgetTotal)}</div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${Math.min(budgetPercent, 100)}%` }} />
            </div>
            <p className="text-xs text-gray-500 mt-1">{budgetPercent.toFixed(0)}% used</p>
          </CardContent>
        </Card>
      </div>

      {/* Error Handler */}
      {error && <ErrorHandler error={error} />}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="information">Information</TabsTrigger>
        </TabsList>

        {/* Details Tab */}
        <TabsContent value="details" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Project Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Project Name</label>
                <Input
                  value={formData.project_name || ''}
                  onChange={(e) => setFormData({ ...formData, project_name: e.target.value })}
                  disabled={!editMode}
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Customer</label>
                  <Input
                    value={formData.customer || ''}
                    onChange={(e) => setFormData({ ...formData, customer: e.target.value })}
                    disabled={!editMode}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Project Manager</label>
                  <Input
                    value={formData.project_manager || ''}
                    onChange={(e) => setFormData({ ...formData, project_manager: e.target.value })}
                    disabled={!editMode}
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  disabled={!editMode}
                  rows={4}
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Start Date</label>
                  <Input
                    type="date"
                    value={formData.start_date?.split('T')[0] || ''}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    disabled={!editMode}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">End Date</label>
                  <Input
                    type="date"
                    value={formData.expected_end_date?.split('T')[0] || ''}
                    onChange={(e) => setFormData({ ...formData, expected_end_date: e.target.value })}
                    disabled={!editMode}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Total Budget</label>
                  <Input
                    type="number"
                    value={formData.total_budget_amount || ''}
                    onChange={(e) => setFormData({ ...formData, total_budget_amount: parseFloat(e.target.value) })}
                    disabled={!editMode}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Status</label>
                  <select
                    value={formData.status || 'planning'}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    disabled={!editMode}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="planning">Planning</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="on_hold">On Hold</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tasks Tab */}
        <TabsContent value="tasks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Project Tasks</CardTitle>
              <CardDescription>Manage tasks and track progress</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add New Task */}
              {editMode && (
                <div className="border-t pt-4 space-y-3">
                  <div>
                    <label className="text-sm font-medium">Task Title</label>
                    <Input
                      value={newTask.task_title || ''}
                      onChange={(e) => setNewTask({ ...newTask, task_title: e.target.value })}
                      placeholder="Enter task title"
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">Description</label>
                    <Textarea
                      value={newTask.description || ''}
                      onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                      placeholder="Task description"
                      rows={2}
                      className="mt-1"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-sm font-medium">Priority</label>
                      <select
                        value={newTask.priority || 'medium'}
                        onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as any })}
                        className="w-full mt-1 px-2 py-1 text-sm border border-gray-300 rounded"
                      >
                        {priorityOptions.map(p => (
                          <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Status</label>
                      <select
                        value={newTask.status || 'open'}
                        onChange={(e) => setNewTask({ ...newTask, status: e.target.value as any })}
                        className="w-full mt-1 px-2 py-1 text-sm border border-gray-300 rounded"
                      >
                        {taskStatusOptions.map(s => (
                          <option key={s} value={s}>{s.replace('_', ' ').toUpperCase()}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Target Date</label>
                      <Input
                        type="date"
                        value={newTask.target_completion_date?.split('T')[0] || ''}
                        onChange={(e) => setNewTask({ ...newTask, target_completion_date: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <Button onClick={handleAddTask} disabled={isSaving} className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Task
                  </Button>
                </div>
              )}

              {/* Task List */}
              <div className="space-y-2">
                {tasks.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8">No tasks yet</p>
                ) : (
                  tasks.map(task => (
                    <div
                      key={task.id}
                      className="border rounded-lg p-3 hover:bg-gray-50 transition"
                    >
                      {editingTaskId === task.id ? (
                        // Edit Mode
                        <div className="space-y-2">
                          <Input
                            value={task.task_title}
                            onChange={(e) => {
                              const updated = { ...task, task_title: e.target.value }
                              setEditingTaskId(updated.id)
                            }}
                            placeholder="Task title"
                          />
                          <div className="grid grid-cols-3 gap-2">
                            <select
                              value={task.priority}
                              onChange={(e) => {
                                const updated = { ...task, priority: e.target.value as any }
                                setEditingTaskId(updated.id)
                              }}
                              className="text-sm border border-gray-300 rounded px-2 py-1"
                            >
                              {priorityOptions.map(p => (
                                <option key={p} value={p}>{p}</option>
                              ))}
                            </select>
                            <select
                              value={task.status}
                              onChange={(e) => {
                                const updated = { ...task, status: e.target.value as any }
                                setEditingTaskId(updated.id)
                              }}
                              className="text-sm border border-gray-300 rounded px-2 py-1"
                            >
                              {taskStatusOptions.map(s => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                            <Button
                              size="sm"
                              onClick={() => handleUpdateTask(task)}
                              disabled={isSaving}
                            >
                              Save
                            </Button>
                          </div>
                        </div>
                      ) : (
                        // View Mode
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`px-2 py-1 text-xs rounded font-medium ${priorityColors[task.priority]}`}>
                                {task.priority}
                              </span>
                              <span className={`px-2 py-1 text-xs rounded font-medium ${statusColors[task.status]}`}>
                                {task.status.replace('_', ' ')}
                              </span>
                            </div>
                            <p className="font-medium text-sm">{task.task_title}</p>
                            {task.description && <p className="text-xs text-gray-600 mt-1">{task.description}</p>}
                            {task.target_completion_date && (
                              <p className="text-xs text-gray-500 mt-1">Due: {formatDate(task.target_completion_date)}</p>
                            )}
                          </div>
                          {editMode && (
                            <div className="flex gap-2 ml-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditingTaskId(task.id)}
                              >
                                <Edit2 className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDeleteTask(task.id)}
                                disabled={isSaving}
                              >
                                <Trash2 className="w-3 h-3 text-red-500" />
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Project Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">Overall Progress</span>
                  <span className="text-sm font-bold">{progressPercent}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-cyan-500 h-3 rounded-full transition-all"
                    style={{ width: `${Math.min(progressPercent, 100)}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Start Date</p>
                  <p className="font-bold mt-1">{formData.start_date ? formatDate(formData.start_date) : 'Not set'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Expected End Date</p>
                  <p className="font-bold mt-1">{formData.expected_end_date ? formatDate(formData.expected_end_date) : 'Not set'}</p>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-sm text-blue-900">Timeline Status</p>
                    <p className="text-sm text-blue-700 mt-1">
                      {daysRemaining === null
                        ? 'Not set'
                        : daysRemaining > 0
                        ? `${daysRemaining} days remaining`
                        : daysRemaining === 0
                        ? 'Due today'
                        : `${Math.abs(daysRemaining)} days overdue`}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-medium text-sm">Task Summary</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="border rounded p-3">
                    <p className="text-xs text-gray-600">Completed Tasks</p>
                    <p className="text-2xl font-bold mt-1">{tasks.filter(t => t.status === 'completed').length}</p>
                  </div>
                  <div className="border rounded p-3">
                    <p className="text-xs text-gray-600">Active Tasks</p>
                    <p className="text-2xl font-bold mt-1">{tasks.filter(t => t.status === 'in_progress').length}</p>
                  </div>
                  <div className="border rounded p-3">
                    <p className="text-xs text-gray-600">Open Tasks</p>
                    <p className="text-2xl font-bold mt-1">{tasks.filter(t => t.status === 'open').length}</p>
                  </div>
                  <div className="border rounded p-3">
                    <p className="text-xs text-gray-600">Total Tasks</p>
                    <p className="text-2xl font-bold mt-1">{tasks.length}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Information Tab */}
        <TabsContent value="information" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Project Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-600 uppercase tracking-wide">Project Code</p>
                  <p className="font-mono font-bold mt-2">{project.project_code}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 uppercase tracking-wide">Status</p>
                  <div className="mt-2">
                    <StatusBadge status={project.status} />
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium text-sm mb-3">Budget Allocation</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Total Budget</span>
                    <span className="font-bold">{formatCurrency(budgetTotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Consumed</span>
                    <span className="font-bold text-orange-600">{formatCurrency(budgetUsed)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Remaining</span>
                    <span className="font-bold text-green-600">{formatCurrency(budgetTotal - budgetUsed)}</span>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium text-sm mb-3">Timeline</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Created</span>
                    <span className="font-mono">{formatDate(project.creation)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Last Modified</span>
                    <span className="font-mono">{formatDate(project.modified)}</span>
                  </div>
                </div>
              </div>

              {project.description && (
                <div className="border-t pt-4">
                  <h4 className="font-medium text-sm mb-2">Description</h4>
                  <p className="text-sm text-gray-700 leading-relaxed">{project.description}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
