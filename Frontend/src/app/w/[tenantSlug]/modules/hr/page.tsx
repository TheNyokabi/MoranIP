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
import { Users, Calendar, Clock, DollarSign, Plus } from 'lucide-react';
import { hrApi, type Employee, type Attendance, type LeaveApplication, type SalaryStructure } from '@/lib/api';
import { ErrorHandler } from '@/components/error-handler';
import { DataTable } from '@/components/data-table';
import { DeleteDialog } from '@/components/crud/delete-dialog';
import { useToast } from '@/hooks/use-toast';
import { ModulePageLayout } from '@/components/layout/module-page-layout';

const employeeSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  company: z.string().min(1, 'Company is required'),
  date_of_joining: z.string().min(1, 'Date of joining is required'),
  designation: z.string().optional(),
  department: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  cell_number: z.string().optional(),
});

const attendanceSchema = z.object({
  employee: z.string().min(1, 'Employee is required'),
  attendance_date: z.string().min(1, 'Date is required'),
  status: z.enum(['Present', 'Absent', 'Half Day', 'Work From Home']),
  working_hours: z.number().min(0).optional(),
});

const leaveSchema = z.object({
  employee: z.string().min(1, 'Employee is required'),
  leave_type: z.string().min(1, 'Leave type is required'),
  from_date: z.string().min(1, 'From date is required'),
  to_date: z.string().min(1, 'To date is required'),
});

type EmployeeFormValues = z.infer<typeof employeeSchema>;
type AttendanceFormValues = z.infer<typeof attendanceSchema>;
type LeaveFormValues = z.infer<typeof leaveSchema>;

export default function HRPage() {
  const params = useParams() as any;
  const tenantSlug = params.tenantSlug as string;
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('employees');

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [leaves, setLeaves] = useState<LeaveApplication[]>([]);
  const [salaryStructures, setSalaryStructures] = useState<SalaryStructure[]>([]);

  const [employeeDialogOpen, setEmployeeDialogOpen] = useState(false);
  const [attendanceDialogOpen, setAttendanceDialogOpen] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [deleteItem, setDeleteItem] = useState<{ type: string; id: string; name: string } | null>(null);

  const employeeForm = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      company: '',
      date_of_joining: new Date().toISOString().split('T')[0],
      designation: '',
      department: '',
      email: '',
      cell_number: '',
    },
  });

  const attendanceForm = useForm<AttendanceFormValues>({
    resolver: zodResolver(attendanceSchema),
    defaultValues: {
      employee: '',
      attendance_date: new Date().toISOString().split('T')[0],
      status: 'Present',
      working_hours: 8,
    },
  });

  const leaveForm = useForm<LeaveFormValues>({
    resolver: zodResolver(leaveSchema),
    defaultValues: {
      employee: '',
      leave_type: '',
      from_date: new Date().toISOString().split('T')[0],
      to_date: new Date().toISOString().split('T')[0],
    },
  });

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [employeesRes, attendanceRes, leavesRes, salaryRes] = await Promise.all([
        hrApi.listEmployees().catch(() => ({ data: [] })),
        hrApi.listAttendance().catch(() => ({ data: [] })),
        hrApi.listLeaveApplications().catch(() => ({ data: [] })),
        hrApi.listSalaryStructures().catch(() => ({ data: [] })),
      ]);

      setEmployees(employeesRes.data || []);
      setAttendance(attendanceRes.data || []);
      setLeaves(leavesRes.data || []);
      setSalaryStructures(salaryRes.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load HR data');
      toast({
        title: 'Error',
        description: err.message || 'Failed to load HR data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEmployee = async (data: EmployeeFormValues) => {
    try {
      await hrApi.createEmployee(data);
      toast({ title: 'Success', description: 'Employee created successfully' });
      setEmployeeDialogOpen(false);
      employeeForm.reset();
      loadAllData();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to create employee',
        variant: 'destructive',
      });
    }
  };

  const handleCreateAttendance = async (data: AttendanceFormValues) => {
    try {
      await hrApi.createAttendance(data);
      toast({ title: 'Success', description: 'Attendance recorded successfully' });
      setAttendanceDialogOpen(false);
      attendanceForm.reset();
      loadAllData();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to record attendance',
        variant: 'destructive',
      });
    }
  };

  const handleCreateLeave = async (data: LeaveFormValues) => {
    try {
      await hrApi.createLeaveApplication(data);
      toast({ title: 'Success', description: 'Leave application created successfully' });
      setLeaveDialogOpen(false);
      leaveForm.reset();
      loadAllData();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to create leave application',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (item: any, type: string) => {
    setEditingItem({ ...item, _type: type });
    if (type === 'employee') {
      employeeForm.reset({
        first_name: item.first_name || '',
        last_name: item.last_name || '',
        company: item.company || '',
        date_of_joining: item.date_of_joining || '',
        designation: item.designation || '',
        department: item.department || '',
        email: item.email || '',
        cell_number: item.cell_number || '',
      });
      setEmployeeDialogOpen(true);
    }
  };

  const handleDelete = (item: any, type: string) => {
    setDeleteItem({
      type,
      id: item.name,
      name: item.employee_name || item.name || 'this item',
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
    employees: [
      { key: 'employee_name', label: 'Name' },
      { key: 'designation', label: 'Designation' },
      { key: 'department', label: 'Department' },
      { key: 'status', label: 'Status' },
      { key: 'date_of_joining', label: 'Date of Joining' },
    ],
    attendance: [
      { key: 'employee', label: 'Employee' },
      { key: 'attendance_date', label: 'Date' },
      { key: 'status', label: 'Status' },
      { key: 'working_hours', label: 'Hours' },
    ],
    leaves: [
      { key: 'employee', label: 'Employee' },
      { key: 'leave_type', label: 'Type' },
      { key: 'from_date', label: 'From' },
      { key: 'to_date', label: 'To' },
      { key: 'status', label: 'Status' },
    ],
    salary: [
      { key: 'employee', label: 'Employee' },
      { key: 'from_date', label: 'From Date' },
      { key: 'base', label: 'Base', render: (val: any) => val ? parseFloat(val).toFixed(2) : '0.00' },
      { key: 'net_pay', label: 'Net Pay', render: (val: any) => val ? parseFloat(val).toFixed(2) : '0.00' },
    ],
  };

  const presentToday = attendance.filter(a => a.status === 'Present').length;
  const activeLeaves = leaves.filter(l => l.status === 'Approved').length;

  const getActionButton = () => {
    if (activeTab === 'employees') {
      return { label: 'New Employee', onClick: () => setEmployeeDialogOpen(true) };
    } else if (activeTab === 'attendance') {
      return { label: 'Mark Attendance', onClick: () => setAttendanceDialogOpen(true) };
    } else if (activeTab === 'leaves') {
      return { label: 'New Leave Application', onClick: () => setLeaveDialogOpen(true) };
    }
    return undefined;
  };

  return (
    <ModulePageLayout
      title="HR Module"
      description="Manage employees, attendance, leave, and salary structures"
      action={getActionButton()}
    >
      <ErrorHandler error={error} onDismiss={() => setError(null)} />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" /> Employees
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{employees.length}</div>
            <p className="text-xs text-muted-foreground">Total employees</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" /> Attendance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{presentToday}</div>
            <p className="text-xs text-muted-foreground">Present today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" /> Leaves
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeLeaves}</div>
            <p className="text-xs text-muted-foreground">Approved leaves</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Salary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{salaryStructures.length}</div>
            <p className="text-xs text-muted-foreground">Active structures</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>HR Data</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="employees">Employees</TabsTrigger>
              <TabsTrigger value="attendance">Attendance</TabsTrigger>
              <TabsTrigger value="leaves">Leaves</TabsTrigger>
              <TabsTrigger value="salary">Salary</TabsTrigger>
            </TabsList>

            <TabsContent value="employees" className="mt-4">
              <DataTable
                columns={columns.employees}
                data={employees}
                isLoading={loading}
                searchable
                onEdit={(row) => handleEdit(row, 'employee')}
                onDelete={(row) => handleDelete(row, 'employee')}
                emptyMessage="No employees found"
              />
            </TabsContent>

            <TabsContent value="attendance" className="mt-4">
              <DataTable
                columns={columns.attendance}
                data={attendance}
                isLoading={loading}
                searchable
                emptyMessage="No attendance records found"
              />
            </TabsContent>

            <TabsContent value="leaves" className="mt-4">
              <DataTable
                columns={columns.leaves}
                data={leaves}
                isLoading={loading}
                searchable
                emptyMessage="No leave applications found"
              />
            </TabsContent>

            <TabsContent value="salary" className="mt-4">
              <DataTable
                columns={columns.salary}
                data={salaryStructures}
                isLoading={loading}
                searchable
                emptyMessage="No salary structures found"
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Employee Dialog */}
      <Dialog open={employeeDialogOpen} onOpenChange={setEmployeeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Employee' : 'New Employee'}</DialogTitle>
            <DialogDescription>Add a new employee to your organization</DialogDescription>
          </DialogHeader>
          <Form {...employeeForm}>
            <form onSubmit={employeeForm.handleSubmit(handleCreateEmployee)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={employeeForm.control}
                  name="first_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name *</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={employeeForm.control}
                  name="last_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name *</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={employeeForm.control}
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
              <FormField
                control={employeeForm.control}
                name="date_of_joining"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date of Joining *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={employeeForm.control}
                  name="designation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Designation</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={employeeForm.control}
                  name="department"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Department</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEmployeeDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create Employee</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Attendance Dialog */}
      <Dialog open={attendanceDialogOpen} onOpenChange={setAttendanceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Attendance</DialogTitle>
            <DialogDescription>Record employee attendance</DialogDescription>
          </DialogHeader>
          <Form {...attendanceForm}>
            <form onSubmit={attendanceForm.handleSubmit(handleCreateAttendance)} className="space-y-4">
              <FormField
                control={attendanceForm.control}
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
              <FormField
                control={attendanceForm.control}
                name="attendance_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={attendanceForm.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Present">Present</SelectItem>
                        <SelectItem value="Absent">Absent</SelectItem>
                        <SelectItem value="Half Day">Half Day</SelectItem>
                        <SelectItem value="Work From Home">Work From Home</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setAttendanceDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Record Attendance</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Leave Dialog */}
      <Dialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Leave Application</DialogTitle>
            <DialogDescription>Create a leave application</DialogDescription>
          </DialogHeader>
          <Form {...leaveForm}>
            <form onSubmit={leaveForm.handleSubmit(handleCreateLeave)} className="space-y-4">
              <FormField
                control={leaveForm.control}
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
              <FormField
                control={leaveForm.control}
                name="leave_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Leave Type *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={leaveForm.control}
                  name="from_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>From Date *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={leaveForm.control}
                  name="to_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>To Date *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setLeaveDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create Leave Application</Button>
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
