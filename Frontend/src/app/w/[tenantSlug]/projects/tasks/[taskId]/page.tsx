'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft,
  Edit,
  Save,
  X,
  CheckCircle2,
  Clock,
  Calendar,
  User,
  AlertCircle,
  FileText,
  Target,
  Zap,
} from 'lucide-react';
import { ErrorHandler } from '@/components/error-handler';
import { Badge } from '@/components/ui/badge';

interface Task {
  name: string;
  title: string;
  description?: string;
  project?: string;
  assigned_to?: string;
  status: 'Open' | 'Working' | 'Completed' | 'Closed';
  priority?: 'Low' | 'Medium' | 'High';
  progress?: number;
  start_date?: string;
  end_date?: string;
  due_date?: string;
  depends_on?: string;
  color?: string;
  creation: string;
  modified: string;
}

type TaskStatus = Task['status']
type TaskPriority = NonNullable<Task['priority']>

interface TaskFormData {
  title: string
  description: string
  project: string
  assigned_to: string
  status: TaskStatus
  priority: TaskPriority
  progress: number
  start_date: string
  end_date: string
  due_date: string
  depends_on: string
}

const STATUS_COLORS: Record<string, string> = {
  'Open': 'bg-blue-100 text-blue-800',
  'Working': 'bg-yellow-100 text-yellow-800',
  'Completed': 'bg-green-100 text-green-800',
  'Closed': 'bg-gray-100 text-gray-800',
};

const PRIORITY_COLORS: Record<string, string> = {
  'Low': 'bg-green-100 text-green-800',
  'Medium': 'bg-orange-100 text-orange-800',
  'High': 'bg-red-100 text-red-800',
};

export default function TaskDetailPage() {
  const params = useParams() as any;
  const router = useRouter();
  const tenantSlug = params.tenantSlug as string;
  const taskId = params.taskId as string;
  const tenantId = tenantSlug;

  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('details');

  const [formData, setFormData] = useState<TaskFormData>({
    title: '',
    description: '',
    project: '',
    assigned_to: '',
    status: 'Open',
    priority: 'Medium',
    progress: 0,
    start_date: '',
    end_date: '',
    due_date: '',
    depends_on: '',
  });

  useEffect(() => {
    if (tenantId && taskId) {
      fetchTask();
    }
  }, [tenantId, taskId]);

  const fetchTask = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/tenants/${tenantId}/erp/projects/tasks/${taskId}`,
        {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        }
      );
      if (response.ok) {
        const data = await response.json();
        const taskData = data.data || data;
        setTask(taskData);
        setFormData({
          title: taskData.title || '',
          description: taskData.description || '',
          project: taskData.project || '',
          assigned_to: taskData.assigned_to || '',
          status: (taskData.status as TaskStatus) || 'Open',
          priority: (taskData.priority as TaskPriority) || 'Medium',
          progress: taskData.progress || 0,
          start_date: taskData.start_date || '',
          end_date: taskData.end_date || '',
          due_date: taskData.due_date || '',
          depends_on: taskData.depends_on || '',
        });
      } else {
        setError('Failed to load task');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!task) return;
    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/tenants/${tenantId}/erp/projects/tasks/${taskId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify(formData),
        }
      );

      if (response.ok) {
        setEditMode(false);
        await fetchTask();
      } else {
        setError('Failed to save changes');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center">Loading task...</div>;
  }

  if (!task) {
    return <ErrorHandler error="Task not found" />;
  }

  const dueDate = task.due_date ? new Date(task.due_date) : null;
  const daysDue =
    dueDate && task.status !== 'Completed' && task.status !== 'Closed'
      ? Math.ceil((dueDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
      : null;
  const isOverdue = daysDue !== null && daysDue < 0;

  return (
    <div className="p-6 space-y-6 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{task.title}</h1>
            {task.project && (
              <p className="text-sm text-gray-600">📦 {task.project}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {!editMode && (
            <Button onClick={() => setEditMode(true)} variant="outline">
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
          {editMode && (
            <>
              <Button onClick={() => setEditMode(false)} variant="ghost">
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            </>
          )}
        </div>
      </div>

      {error && <ErrorHandler error={error} />}

      {/* Status Badges */}
      <div className="flex gap-2 flex-wrap">
        <Badge className={STATUS_COLORS[task.status] || 'bg-gray-100 text-gray-800'}>
          <CheckCircle2 className="h-3 w-3 mr-1" />
          {task.status}
        </Badge>
        {task.priority && (
          <Badge className={PRIORITY_COLORS[task.priority] || 'bg-gray-100 text-gray-800'}>
            <Zap className="h-3 w-3 mr-1" />
            {task.priority}
          </Badge>
        )}
        {isOverdue && (
          <Badge className="bg-red-100 text-red-800">
            <AlertCircle className="h-3 w-3 mr-1" />
            Overdue
          </Badge>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-1">
              <Target className="h-4 w-4" />
              Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            {editMode ? (
              <div className="space-y-2">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.progress}
                  onChange={(e) =>
                    setFormData({ ...formData, progress: parseInt(e.target.value) || 0 })
                  }
                />
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${formData.progress}%` }}
                  />
                </div>
              </div>
            ) : (
              <>
                <p className="text-2xl font-bold text-gray-900">{task.progress || 0}%</p>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${task.progress || 0}%` }}
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-1">
              <User className="h-4 w-4" />
              Assigned To
            </CardTitle>
          </CardHeader>
          <CardContent>
            {editMode ? (
              <Input
                value={formData.assigned_to}
                onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                placeholder="user@example.com"
              />
            ) : (
              <p className="text-sm font-medium break-all">{task.assigned_to || '-'}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              Due Date
            </CardTitle>
          </CardHeader>
          <CardContent>
            {editMode ? (
              <Input
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              />
            ) : (
              <div>
                <p className="text-sm font-medium">
                  {task.due_date ? new Date(task.due_date).toLocaleDateString() : '-'}
                </p>
                {daysDue !== null && (
                  <p className={`text-xs ${isOverdue ? 'text-red-600' : 'text-gray-500'}`}>
                    {isOverdue ? `${Math.abs(daysDue)} days overdue` : `${daysDue} days remaining`}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-1">
              <Clock className="h-4 w-4" />
              Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {editMode ? (
              <select
                className="w-full p-2 border rounded"
                value={formData.status}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value as any })
                }
              >
                <option>Open</option>
                <option>Working</option>
                <option>Completed</option>
                <option>Closed</option>
              </select>
            ) : (
              <p className="text-sm font-medium">{task.status}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <CardTitle>Task Details</CardTitle>
          <CardDescription>Task information and timeline</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="details">Overview</TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="info">Information</TabsTrigger>
            </TabsList>

            {/* Details Tab */}
            <TabsContent value="details" className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Title</label>
                {editMode ? (
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                ) : (
                  <p className="p-2 bg-gray-50 rounded">{formData.title}</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                  <FileText className="h-4 w-4" />
                  Description
                </label>
                {editMode ? (
                  <textarea
                    className="w-full p-2 border rounded"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    rows={5}
                    placeholder="Task description and notes..."
                  />
                ) : (
                  <p className="p-2 bg-gray-50 rounded whitespace-pre-wrap">
                    {formData.description || '-'}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Priority</label>
                  {editMode ? (
                    <select
                      className="w-full p-2 border rounded"
                      value={formData.priority}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          priority: e.target.value as TaskPriority,
                        })
                      }
                    >
                      <option>Low</option>
                      <option>Medium</option>
                      <option>High</option>
                    </select>
                  ) : (
                    <p className="p-2 bg-gray-50 rounded">{formData.priority || '-'}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Project</label>
                  {editMode ? (
                    <Input
                      value={formData.project}
                      onChange={(e) => setFormData({ ...formData, project: e.target.value })}
                      placeholder="Project name"
                    />
                  ) : (
                    <p className="p-2 bg-gray-50 rounded">{formData.project || '-'}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Depends On</label>
                {editMode ? (
                  <Input
                    value={formData.depends_on}
                    onChange={(e) => setFormData({ ...formData, depends_on: e.target.value })}
                    placeholder="Parent task name"
                  />
                ) : (
                  <p className="p-2 bg-gray-50 rounded">{formData.depends_on || '-'}</p>
                )}
              </div>
            </TabsContent>

            {/* Timeline Tab */}
            <TabsContent value="timeline" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Start Date</label>
                  {editMode ? (
                    <Input
                      type="date"
                      value={formData.start_date}
                      onChange={(e) =>
                        setFormData({ ...formData, start_date: e.target.value })
                      }
                    />
                  ) : (
                    <p className="p-2 bg-gray-50 rounded">
                      {formData.start_date
                        ? new Date(formData.start_date).toLocaleDateString()
                        : '-'}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">End Date</label>
                  {editMode ? (
                    <Input
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    />
                  ) : (
                    <p className="p-2 bg-gray-50 rounded">
                      {formData.end_date
                        ? new Date(formData.end_date).toLocaleDateString()
                        : '-'}
                    </p>
                  )}
                </div>
              </div>

              {/* Timeline Cards */}
              <div className="grid grid-cols-3 gap-4 mt-6">
                <Card className="bg-blue-50 border-blue-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-blue-900">Created</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="font-medium">{new Date(task.creation).toLocaleDateString()}</p>
                  </CardContent>
                </Card>
                <Card className="bg-purple-50 border-purple-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-purple-900">Modified</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="font-medium">{new Date(task.modified).toLocaleDateString()}</p>
                  </CardContent>
                </Card>
                {dueDate && (
                  <Card className={isOverdue ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}>
                    <CardHeader className="pb-2">
                      <CardTitle className={`text-sm ${isOverdue ? 'text-red-900' : 'text-green-900'}`}>
                        Due Date
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="font-medium">{dueDate.toLocaleDateString()}</p>
                      <p className={`text-xs ${isOverdue ? 'text-red-600' : 'text-green-600'}`}>
                        {isOverdue
                          ? `${Math.abs(daysDue!)} days overdue`
                          : `${daysDue} days remaining`}
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            {/* Information Tab */}
            <TabsContent value="info" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-blue-900">Task Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Badge className={STATUS_COLORS[task.status] || 'bg-gray-100 text-gray-800'}>
                      {task.status}
                    </Badge>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-orange-900">Priority Level</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Badge className={PRIORITY_COLORS[task.priority || 'Medium'] || 'bg-gray-100 text-gray-800'}>
                      {task.priority || 'Medium'}
                    </Badge>
                  </CardContent>
                </Card>
              </div>

              <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                <CardHeader>
                  <CardTitle className="text-sm text-green-900">Task Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-green-800">
                  <p>✓ Title: {task.title}</p>
                  <p>✓ Status: {task.status}</p>
                  <p>✓ Progress: {task.progress || 0}%</p>
                  {task.assigned_to && <p>✓ Assigned to: {task.assigned_to}</p>}
                  {task.project && <p>✓ Project: {task.project}</p>}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
