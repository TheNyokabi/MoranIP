'use client';

import { useRouter } from 'next/navigation';
import { useParams } from 'next/navigation';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Edit2, Trash2, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/shared/empty-state';

interface Column {
  key: string;
  label: string;
  render?: (value: any, row: any) => React.ReactNode;
}

interface DataTableProps {
  columns: Column[];
  data: any[];
  isLoading?: boolean;
  onRowClick?: (row: any) => void;
  rowLink?: (row: any) => string;
  onEdit?: (row: any) => void;
  onDelete?: (row: any) => void;
  searchable?: boolean;
  searchPlaceholder?: string;
  pageSize?: number;
  emptyMessage?: string;
  emptyIcon?: React.ElementType;
}

export function DataTable({
  columns,
  data,
  isLoading = false,
  onRowClick,
  rowLink,
  onEdit,
  onDelete,
  searchable = false,
  searchPlaceholder = 'Search...',
  pageSize = 10,
  emptyMessage = 'No data available',
  emptyIcon,
}: DataTableProps) {
  const router = useRouter();
  const params = useParams();
  const tenantSlug = params?.tenantSlug as string;
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const handleRowClick = (row: any, e?: React.MouseEvent) => {
    // Don't navigate if clicking on action buttons
    if (e && (e.target as HTMLElement).closest('button')) {
      return;
    }
    if (onRowClick) {
      onRowClick(row);
    } else if (rowLink) {
      const link = rowLink(row);
      router.push(`/w/${tenantSlug}${link}`);
    }
  };

  const handleEdit = (row: any, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onEdit) {
      onEdit(row);
    }
  };

  const handleDelete = (row: any, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(row);
    }
  };

  // Filter data based on search query
  const filteredData = searchable && searchQuery
    ? data.filter((row) =>
      columns.some((col) => {
        const value = row[col.key];
        return value && String(value).toLowerCase().includes(searchQuery.toLowerCase());
      })
    )
    : data;

  // Paginate data
  const totalPages = Math.ceil(filteredData.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedData = filteredData.slice(startIndex, startIndex + pageSize);

  // Reset to page 1 when search changes
  if (searchQuery && currentPage > 1 && filteredData.length === 0) {
    setCurrentPage(1);
  }

  // Add actions column if edit/delete handlers are provided
  const displayColumns = [...columns];
  if (onEdit || onDelete) {
    displayColumns.push({
      key: '_actions',
      label: 'Actions',
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState
        icon={emptyIcon as any}
        title={emptyMessage}
        description="Get started by creating a new item"
      />
    );
  }

  if (filteredData.length === 0) {
    return (
      <div className="space-y-4">
        {searchable && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        )}
        <EmptyState
          icon={emptyIcon as any}
          title="No results found"
          description={`No items match "${searchQuery}"`}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {searchable && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      )}

      <div className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-50 dark:bg-gray-900/50">
            <TableRow className="border-b border-gray-200 dark:border-gray-800">
              {displayColumns.map((column) => (
                <TableHead key={column.key} className="px-4 py-3 text-left">
                  {column.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.map((row, idx) => (
              <TableRow
                key={idx}
                className={`border-b border-gray-200 dark:border-gray-800 ${onRowClick || rowLink
                    ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors'
                    : ''
                  }`}
                onClick={(e) => handleRowClick(row, e)}
              >
                {columns.map((column) => (
                  <TableCell key={`${idx}-${column.key}`} className="px-4 py-3 text-sm">
                    {column.render
                      ? column.render(row[column.key], row)
                      : row[column.key] || '-'}
                  </TableCell>
                ))}
                {(onEdit || onDelete) && (
                  <TableCell className="px-4 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      {onEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => handleEdit(row, e)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      )}
                      {onDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={(e) => handleDelete(row, e)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {startIndex + 1} to {Math.min(startIndex + pageSize, filteredData.length)} of {filteredData.length} results
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <div className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
