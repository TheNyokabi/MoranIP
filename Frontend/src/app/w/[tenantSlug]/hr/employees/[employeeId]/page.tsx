'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertCircle,
  Edit2,
  Save,
  X,
  Calendar,
  DollarSign,
  FileText,
  User,
  Clock,
  Award,
  Download,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface SalaryComponent {
  name: string;
  amount: number;
  type: 'Earnings' | 'Deductions';
}

interface SalarySlip {
  name: string;
  from_date: string;
  to_date: string;
  gross_pay: number;
  net_pay: number;
  status: 'Draft' | 'Submitted' | 'Cancelled';
}

interface LeaveBalance {
  leave_type: string;
  total_leaves: number;
  leaves_taken: number;
  opening_balance: number;
  closing_balance: number;
}

interface EmployeeDocument {
  name: string;
  document_type: string;
  file_url: string;
  upload_date: string;
}

interface AttendanceRecord {
  name: string;
  attendance_date: string;
  status: 'Present' | 'Absent' | 'Half Day' | 'Leave';
  working_hours: number;
  check_in_time?: string;
  check_out_time?: string;
}

interface Employee {
  name: string;
  employee_name: string;
  employee_number: string;
  status: 'Active' | 'Left' | 'On Leave';
  date_of_birth: string;
  gender: 'Male' | 'Female' | 'Other';
  email: string;
  phone: string;
  department: string;
  designation: string;
  reports_to?: string;
  date_of_joining: string;
  date_of_leaving?: string;
  employment_type: 'Full-time' | 'Part-time' | 'Contract' | 'Temporary';
  company: string;
  salary_components: SalaryComponent[];
  salary_slips: SalarySlip[];
  leave_balances: LeaveBalance[];
  documents: EmployeeDocument[];
  attendance: AttendanceRecord[];
  current_gross_salary: number;
  annual_ctc: number;
  ytd_earnings: number;
  ytd_deductions: number;
  address: string;
  notes: string;
  created_on: string;
  modified_on: string;
}

const defaultEmployee: Employee = {
  name: '',
  employee_name: '',
  employee_number: '',
  status: 'Active',
  date_of_birth: '',
  gender: 'Male',
  email: '',
  phone: '',
  department: '',
  designation: '',
  date_of_joining: '',
  employment_type: 'Full-time',
  company: '',
  salary_components: [],
  salary_slips: [],
  leave_balances: [],
  documents: [],
  attendance: [],
  current_gross_salary: 0,
  annual_ctc: 0,
  ytd_earnings: 0,
  ytd_deductions: 0,
  address: '',
  notes: '',
  created_on: '',
  modified_on: '',
};

export default function EmployeeDetailPage() {
  const params = useParams() as any;
  const employeeId = params?.employeeId as string;
  const tenantSlug = params?.tenantSlug as string;

  const [employee, setEmployee] = useState<Employee>(defaultEmployee);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('details');

  // Fetch employee data
  useEffect(() => {
    const fetchEmployee = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(
          `/api/tenants/${tenantSlug}/erp/hr/employees/${employeeId}`
        );
        if (!response.ok) throw new Error('Failed to fetch employee');
        const data = await response.json();
        setEmployee(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error loading employee');
      } finally {
        setIsLoading(false);
      }
    };

    if (employeeId && tenantSlug) fetchEmployee();
  }, [employeeId, tenantSlug]);

  const handleSave = async () => {
    try {
      const response = await fetch(
        `/api/tenants/${tenantSlug}/erp/hr/employees/${employeeId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(employee),
        }
      );
      if (!response.ok) throw new Error('Failed to save employee');
      setIsEditMode(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error saving employee');
    }
  };

  const calculateAge = (): number => {
    const today = new Date();
    const birthDate = new Date(employee.date_of_birth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }
    return age;
  };

  const calculateTenure = (): number => {
    const today = new Date();
    const joinDate = new Date(employee.date_of_joining);
    return Math.floor(
      (today.getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
    );
  };

  const getTotalLeaveBalance = (): number => {
    return employee.leave_balances.reduce(
      (sum, lb) => sum + lb.closing_balance,
      0
    );
  };

  const getStatusColor = (status: string): string => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'left':
        return 'bg-red-100 text-red-800';
      case 'on leave':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  const getAttendanceColor = (status: string): string => {
    switch (status) {
      case 'Present':
        return 'bg-green-50 text-green-800';
      case 'Absent':
        return 'bg-red-50 text-red-800';
      case 'Half Day':
        return 'bg-yellow-50 text-yellow-800';
      case 'Leave':
        return 'bg-blue-50 text-blue-800';
      default:
        return 'bg-gray-50 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading employee details...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">{employee.employee_name}</h1>
          <p className="text-gray-600 mt-1">{employee.designation}</p>
          <div className="flex gap-2 mt-2">
            <Badge className={getStatusColor(employee.status)}>
              {employee.status}
            </Badge>
            <Badge variant="outline">{employee.employment_type}</Badge>
            <Badge variant="outline">Tenure: {calculateTenure()} years</Badge>
          </div>
        </div>
        <div className="flex gap-2">
          {!isEditMode ? (
            <Button onClick={() => setIsEditMode(true)} variant="default">
              <Edit2 className="w-4 h-4 mr-2" />
              Edit
            </Button>
          ) : (
            <>
              <Button onClick={handleSave} variant="default">
                <Save className="w-4 h-4 mr-2" />
                Save
              </Button>
              <Button
                onClick={() => {
                  setIsEditMode(false);
                  setError(null);
                }}
                variant="outline"
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
            </>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Gross Salary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {employee.current_gross_salary.toLocaleString()}
            </div>
            <p className="text-xs text-gray-500 mt-1">Monthly</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Annual CTC
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {employee.annual_ctc.toLocaleString()}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {Math.round(employee.annual_ctc / 12)} / month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Leave Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {getTotalLeaveBalance().toFixed(1)}
            </div>
            <p className="text-xs text-gray-500 mt-1">Days available</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              YTD Earnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {employee.ytd_earnings.toLocaleString()}
            </div>
            <p className="text-xs text-gray-500 mt-1">Year to date</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="compensation">Compensation</TabsTrigger>
          <TabsTrigger value="leave">Leave Balance</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="salary-history">Salary History</TabsTrigger>
        </TabsList>

        {/* Details Tab */}
        <TabsContent value="details">
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Employee Number</Label>
                  <Input
                    value={employee.employee_number}
                    disabled
                    className="bg-gray-100"
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={employee.email}
                    onChange={(e) =>
                      setEmployee({ ...employee, email: e.target.value })
                    }
                    disabled={!isEditMode}
                  />
                </div>
                <div>
                  <Label>Date of Birth</Label>
                  <div className="flex gap-2">
                    <Input
                      type="date"
                      value={employee.date_of_birth}
                      onChange={(e) =>
                        setEmployee({
                          ...employee,
                          date_of_birth: e.target.value,
                        })
                      }
                      disabled={!isEditMode}
                      className="flex-1"
                    />
                    <Input
                      value={`Age: ${calculateAge()}`}
                      disabled
                      className="flex-1 bg-gray-100"
                    />
                  </div>
                </div>
                <div>
                  <Label>Gender</Label>
                  <Select
                    value={employee.gender}
                    onValueChange={(value) =>
                      setEmployee({
                        ...employee,
                        gender: value as 'Male' | 'Female' | 'Other',
                      })
                    }
                    disabled={!isEditMode}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input
                    value={employee.phone}
                    onChange={(e) =>
                      setEmployee({ ...employee, phone: e.target.value })
                    }
                    disabled={!isEditMode}
                  />
                </div>
                <div>
                  <Label>Status</Label>
                  <Select
                    value={employee.status}
                    onValueChange={(value) =>
                      setEmployee({
                        ...employee,
                        status: value as 'Active' | 'Left' | 'On Leave',
                      })
                    }
                    disabled={!isEditMode}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Left">Left</SelectItem>
                      <SelectItem value="On Leave">On Leave</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Employment Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Department</Label>
                  <Input
                    value={employee.department}
                    onChange={(e) =>
                      setEmployee({ ...employee, department: e.target.value })
                    }
                    disabled={!isEditMode}
                  />
                </div>
                <div>
                  <Label>Designation</Label>
                  <Input
                    value={employee.designation}
                    onChange={(e) =>
                      setEmployee({
                        ...employee,
                        designation: e.target.value,
                      })
                    }
                    disabled={!isEditMode}
                  />
                </div>
                <div>
                  <Label>Reports To</Label>
                  <Input
                    value={employee.reports_to || ''}
                    onChange={(e) =>
                      setEmployee({ ...employee, reports_to: e.target.value })
                    }
                    disabled={!isEditMode}
                  />
                </div>
                <div>
                  <Label>Employment Type</Label>
                  <Select
                    value={employee.employment_type}
                    onValueChange={(value) =>
                      setEmployee({
                        ...employee,
                        employment_type: value as
                          | 'Full-time'
                          | 'Part-time'
                          | 'Contract'
                          | 'Temporary',
                      })
                    }
                    disabled={!isEditMode}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Full-time">Full-time</SelectItem>
                      <SelectItem value="Part-time">Part-time</SelectItem>
                      <SelectItem value="Contract">Contract</SelectItem>
                      <SelectItem value="Temporary">Temporary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Date of Joining</Label>
                  <Input
                    type="date"
                    value={employee.date_of_joining}
                    onChange={(e) =>
                      setEmployee({
                        ...employee,
                        date_of_joining: e.target.value,
                      })
                    }
                    disabled={!isEditMode}
                  />
                </div>
                {employee.date_of_leaving && (
                  <div>
                    <Label>Date of Leaving</Label>
                    <Input
                      type="date"
                      value={employee.date_of_leaving}
                      onChange={(e) =>
                        setEmployee({
                          ...employee,
                          date_of_leaving: e.target.value,
                        })
                      }
                      disabled={!isEditMode}
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Address</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={employee.address}
                onChange={(e) =>
                  setEmployee({ ...employee, address: e.target.value })
                }
                disabled={!isEditMode}
                placeholder="Enter employee address..."
                className="min-h-24"
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Compensation Tab */}
        <TabsContent value="compensation">
          <Card>
            <CardHeader>
              <CardTitle>Salary Components</CardTitle>
              <CardDescription>
                Monthly earnings and deductions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {employee.salary_components.length === 0 ? (
                  <p className="text-gray-500 text-sm">
                    No salary components configured
                  </p>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Component</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {employee.salary_components.map((comp, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">
                              {comp.name}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  comp.type === 'Earnings'
                                    ? 'default'
                                    : 'destructive'
                                }
                              >
                                {comp.type}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              {comp.amount.toLocaleString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t">
                      <div>
                        <p className="text-sm text-gray-600">Total Earnings</p>
                        <p className="text-2xl font-bold">
                          {employee.salary_components
                            .filter((c) => c.type === 'Earnings')
                            .reduce((sum, c) => sum + c.amount, 0)
                            .toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Total Deductions</p>
                        <p className="text-2xl font-bold">
                          {employee.salary_components
                            .filter((c) => c.type === 'Deductions')
                            .reduce((sum, c) => sum + c.amount, 0)
                            .toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Leave Balance Tab */}
        <TabsContent value="leave">
          <Card>
            <CardHeader>
              <CardTitle>Leave Balance</CardTitle>
              <CardDescription>
                Leave usage and available balance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {employee.leave_balances.length === 0 ? (
                  <p className="text-gray-500 text-sm">
                    No leave records found
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {employee.leave_balances.map((leave, idx) => (
                      <Card key={idx} className="bg-gradient-to-br from-blue-50 to-indigo-50">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-semibold">
                            {leave.leave_type}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Total Allocated:</span>
                              <span className="font-semibold">
                                {leave.total_leaves}
                              </span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Taken:</span>
                              <span className="font-semibold text-red-600">
                                {leave.leaves_taken}
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-red-500 h-2 rounded-full"
                                style={{
                                  width: `${(leave.leaves_taken / leave.total_leaves) * 100}%`,
                                }}
                              />
                            </div>
                            <div className="flex justify-between text-sm pt-2 border-t">
                              <span className="text-gray-600 font-semibold">Balance:</span>
                              <span className="font-bold text-green-600">
                                {leave.closing_balance.toFixed(1)}
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Documents
              </CardTitle>
              <CardDescription>
                Employee documents and certifications
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {employee.documents.length === 0 ? (
                  <p className="text-gray-500 text-sm">
                    No documents uploaded
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Document Type</TableHead>
                        <TableHead>Uploaded On</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employee.documents.map((doc, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">
                            {doc.document_type}
                          </TableCell>
                          <TableCell>
                            {new Date(doc.upload_date).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <a
                              href={doc.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline flex items-center justify-end gap-1"
                            >
                              <Download className="w-4 h-4" />
                              Download
                            </a>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Attendance Tab */}
        <TabsContent value="attendance">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Recent Attendance
              </CardTitle>
              <CardDescription>
                Last 20 attendance records
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {employee.attendance.length === 0 ? (
                  <p className="text-gray-500 text-sm">
                    No attendance records
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Hours</TableHead>
                        <TableHead>Check-in</TableHead>
                        <TableHead>Check-out</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employee.attendance.slice(0, 20).map((att, idx) => (
                        <TableRow key={idx}>
                          <TableCell>
                            {new Date(att.attendance_date).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Badge className={getAttendanceColor(att.status)}>
                              {att.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{att.working_hours.toFixed(1)}</TableCell>
                          <TableCell>{att.check_in_time || '-'}</TableCell>
                          <TableCell>{att.check_out_time || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Salary History Tab */}
        <TabsContent value="salary-history">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Salary History
              </CardTitle>
              <CardDescription>
                Recent salary slips
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {employee.salary_slips.length === 0 ? (
                  <p className="text-gray-500 text-sm">
                    No salary slips generated
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Period</TableHead>
                        <TableHead>Gross Pay</TableHead>
                        <TableHead>Deductions</TableHead>
                        <TableHead>Net Pay</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employee.salary_slips.map((slip, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">
                            {new Date(slip.from_date).toLocaleDateString()} -{' '}
                            {new Date(slip.to_date).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            {slip.gross_pay.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            {(slip.gross_pay - slip.net_pay).toLocaleString()}
                          </TableCell>
                          <TableCell className="font-semibold">
                            {slip.net_pay.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                slip.status === 'Submitted'
                                  ? 'default'
                                  : 'secondary'
                              }
                            >
                              {slip.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm">
                              <Download className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Footer */}
      <Card className="bg-gray-50">
        <CardContent className="pt-6 text-xs text-gray-600">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p>Created on: {new Date(employee.created_on).toLocaleDateString()}</p>
            </div>
            <div className="text-right">
              <p>Modified on: {new Date(employee.modified_on).toLocaleDateString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
