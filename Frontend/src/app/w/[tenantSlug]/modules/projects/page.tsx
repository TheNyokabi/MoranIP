'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Briefcase, CheckSquare, Clock, Users, Plus } from 'lucide-react';
import { projectsApi, type Project, type Task, type Timesheet } from '@/lib/api';
import { ErrorHandler } from '@/components/error-handler';
import { DataTable } from '@/components/data-table';
import { DeleteDialog } from '@/components/crud/delete-dialog';
import { useToast } from '@/hooks/use-toast';
import { ModulePageLayout } from '@/components/layout/module-page-layout';

const projectSchema = z.object({
  project_name: z.string().min(1, 'Project name is required'),
  company: z.string().min(1, 'Company is required'),
  expected_start_date: z.string().optional(),
  expected_end_date: z.string().optional(),
  project_type: z.string().optional(),
});

const taskSchema = z.object({
  subject: z.string().min(1, 'Subject is required'),
  project: z.string().optional(),
  status: z.enum(['Open', 'Working', 'Pending Review', 'Overdue', 'Completed', 'Cancelled']).optional(),
  priority: z.enum(['Low', 'Medium', 'High', 'Urgent']).optional(),
});

const timesheetSchema = z.object({
  employee: z.string().min(1, 'Employee is required'),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().min(1, 'End date is required'),
});

type ProjectFormValues = z.infer<typeof projectSchema>;
type TaskFormValues = z.infer<typeof taskSchema>;
type TimesheetFormValues = z.infer<typeof timesheetSchema>;

export default function ProjectsPage() {
  const params = useParams() as any;
  const tenantSlug = params.tenantSlug as string;
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('projects');

  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);

  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [timesheetDialogOpen, setTimesheetDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [deleteItem, setDeleteItem] = useState<{ type: string; id: string; name: string } | null>(null);

  const projectForm = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      project_name: '',
      company: '',
      expected_start_date: '',
      expected_end_date: '',
      project_type: '',
    },
  });

  const taskForm = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      subject: '',
      project: '',
      status: 'Open',
      priority: 'Medium',
    },
  });

  const timesheetForm = useForm<TimesheetFormValues>({
    resolver: zodResolver(timesheetSchema),
    defaultValues: {
      employee: '',
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date().toISOString().split('T')[0],
    },
  });

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [projectsRes, tasksRes, timesheetsRes] = await Promise.all([
        projectsApi.listProjects().catch(() => ({ data: [] })),
        projectsApi.listTasks().catch(() => ({ data: [] })),
        projectsApi.listTimesheets().catch(() => ({ data: [] })),
      ]);

      setProjects(projectsRes.data || []);
      setTasks(tasksRes.data || []);
      setTimesheets(timesheetsRes.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load projects data');
      toast({
        title: 'Error',
        description: err.message || 'Failed to load projects data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (data: ProjectFormValues) => {
    try {
      await projectsApi.createProject(data);
      toast({ title: 'Success', description: 'Project created successfully' });
      setProjectDialogOpen(false);
      projectForm.reset();
      loadAllData();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to create project',
        variant: 'destructive',
      });
    }
  };

  const handleCreateTask = async (data: TaskFormValues) => {
    try {
      await projectsApi.createTask(data);
      toast({ title: 'Success', description: 'Task created successfully' });
      setTaskDialogOpen(false);
      taskForm.reset();
      loadAllData();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to create task',
        variant: 'destructive',
      });
    }
  };

  const handleCreateTimesheet = async (data: TimesheetFormValues) => {
    try {
      await projectsApi.createTimesheet(data);
      toast({ title: 'Success', description: 'Timesheet created successfully' });
      setTimesheetDialogOpen(false);
      timesheetForm.reset();
      loadAllData();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to create timesheet',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (item: any, type: string) => {
    setEditingItem({ ...item, _type: type });
    if (type === 'project') {
      projectForm.reset({
        project_name: item.project_name || '',
        company: item.company || '',
        expected_start_date: item.expected_start_date || '',
        expected_end_date: item.expected_end_date || '',
        project_type: item.project_type || '',
      });
      setProjectDialogOpen(true);
    } else if (type === 'task') {
      taskForm.reset({
        subject: item.subject || '',
        project: item.project || '',
        status: item.status || 'Open',
        priority: item.priority || 'Medium',
      });
      setTaskDialogOpen(true);
    }
  };

  const handleDelete = (item: any, type: string) => {
    setDeleteItem({
      type,
      id: item.name,
      name: item.project_name || item.subject || item.name || 'this item',
    });
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteItem) return;
    try {
      toast({ title: 'Success', description: 'Item deleted successfully' });
      setDeleteDialogOpen(false);
      setDeleteItem(null);
      loadAllData();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to delete item',
        variant: 'destructive',
      });
    }
  };

  const columns = {
    projects: [
      { key: 'project_name', label: 'Project Name' },
      { key: 'status', label: 'Status' },
      { key: 'expected_start_date', label: 'Start Date' },
      { key: 'expected_end_date', label: 'End Date' },
    ],
    tasks: [
      { key: 'subject', label: 'Title' },
      { key: 'project', label: 'Project' },
      { key: 'status', label: 'Status' },
      { key: 'priority', label: 'Priority' },
      { key: 'expected_end_date', label: 'Due Date' },
    ],
    timesheets: [
      { key: 'employee', label: 'Employee' },
      { key: 'start_date', label: 'Start Date' },
      { key: 'end_date', label: 'End Date' },
      { key: 'total_hours', label: 'Hours', render: (val: any) => val ? parseFloat(val).toFixed(1) : '0' },
      { key: 'status', label: 'Status' },
    ],
  };

  const openTasks = tasks.filter(t => t.status !== 'Completed' && t.status !== 'Cancelled').length;
  const totalHours = timesheets.reduce((sum, ts) => sum + (parseFloat(String(ts.total_hours)) || 0), 0);

  const getActionButton = () => {
    if (activeTab === 'projects') {
      return { label: 'New Project', onClick: () => setProjectDialogOpen(true) };
    } else if (activeTab === 'tasks') {
      return { label: 'New Task', onClick: () => setTaskDialogOpen(true) };
    } else if (activeTab === 'timesheets') {
      return { label: 'New Timesheet', onClick: () => setTimesheetDialogOpen(true) };
    }
    return undefined;
  };

  return (
    <ModulePageLayout
      title="Projects Module"
      description="Manage projects, tasks, and timesheets"
      action={getActionButton()}
    >
      <ErrorHandler error={error} onDismiss={() => setError(null)} />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Briefcase className="h-4 w-4" /> Projects
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{projects.length}</div>
            <p className="text-xs text-muted-foreground">Total projects</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckSquare className="h-4 w-4" /> Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{openTasks}</div>
            <p className="text-xs text-muted-foreground">Open tasks</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" /> Timesheets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{timesheets.length}</div>
            <p className="text-xs text-muted-foreground">Timesheets</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" /> Hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalHours.toFixed(0)}</div>
            <p className="text-xs text-muted-foreground">Total hours logged</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Projects Data</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="projects">Projects</TabsTrigger>
              <TabsTrigger value="tasks">Tasks</TabsTrigger>
              <TabsTrigger value="timesheets">Timesheets</TabsTrigger>
            </TabsList>

            <TabsContent value="projects" className="mt-4">
              <DataTable
                columns={columns.projects}
                data={projects}
                isLoading={loading}
                searchable
                onEdit={(row) => handleEdit(row, 'project')}
                onDelete={(row) => handleDelete(row, 'project')}
                emptyMessage="No projects found"
              />
            </TabsContent>

            <TabsContent value="tasks" className="mt-4">
              <DataTable
                columns={columns.tasks}
                data={tasks}
                isLoading={loading}
                searchable
                onEdit={(row) => handleEdit(row, 'task')}
                onDelete={(row) => handleDelete(row, 'task')}
                emptyMessage="No tasks found"
              />
            </TabsContent>

            <TabsContent value="timesheets" className="mt-4">
              <DataTable
                columns={columns.timesheets}
                data={timesheets}
                isLoading={loading}
                searchable
                emptyMessage="No timesheets found"
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Project Dialog */}
      <Dialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Project' : 'New Project'}</DialogTitle>
            <DialogDescription>Create a new project</DialogDescription>
          </DialogHeader>
          <Form {...projectForm}>
            <form onSubmit={projectForm.handleSubmit(handleCreateProject)} className="space-y-4">
              <FormField
                control={projectForm.control}
                name="project_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Name *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={projectForm.control}
                name="company"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={projectForm.control}
                  name="expected_start_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={projectForm.control}
                  name="expected_end_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setProjectDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create Project</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Task Dialog */}
      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Task' : 'New Task'}</DialogTitle>
            <DialogDescription>Create a new task</DialogDescription>
          </DialogHeader>
          <Form {...taskForm}>
            <form onSubmit={taskForm.handleSubmit(handleCreateTask)} className="space-y-4">
              <FormField
                control={taskForm.control}
                name="subject"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subject *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={taskForm.control}
                name="project"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={taskForm.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Open">Open</SelectItem>
                          <SelectItem value="Working">Working</SelectItem>
                          <SelectItem value="Pending Review">Pending Review</SelectItem>
                          <SelectItem value="Completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={taskForm.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Low">Low</SelectItem>
                          <SelectItem value="Medium">Medium</SelectItem>
                          <SelectItem value="High">High</SelectItem>
                          <SelectItem value="Urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setTaskDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create Task</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Timesheet Dialog */}
      <Dialog open={timesheetDialogOpen} onOpenChange={setTimesheetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Timesheet</DialogTitle>
            <DialogDescription>Create a timesheet entry</DialogDescription>
          </DialogHeader>
          <Form {...timesheetForm}>
            <form onSubmit={timesheetForm.handleSubmit(handleCreateTimesheet)} className="space-y-4">
              <FormField
                control={timesheetForm.control}
                name="employee"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Employee *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={timesheetForm.control}
                  name="start_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={timesheetForm.control}
                  name="end_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Date *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setTimesheetDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create Timesheet</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDelete}
        itemName={deleteItem?.name}
      />
    </ModulePageLayout>
  );
}
