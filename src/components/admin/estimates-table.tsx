'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { getEstimates } from '@/lib/firebase';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Loader2, Calendar, FilterX, ChevronLeft, ChevronRight } from 'lucide-react';

type FirestoreTimestampLike =
    | Date
    | string
    | {
          seconds?: number;
          toDate?: () => Date;
      }
    | null
    | undefined;

function isTimestampObject(value: FirestoreTimestampLike): value is { seconds?: number; toDate?: () => Date } {
    return !!value && typeof value === 'object' && !(value instanceof Date);
}

export interface EstimateDocument {
  id: string;
  options: {
    name: string;
    email: string;
    phone: string;
    typeOfWork: string[];
    createdAt?: FirestoreTimestampLike;
  };
  estimate?: {
    priceRange?: string;
  };
  createdAt?: FirestoreTimestampLike;
}

interface EstimatesTableProps {
    estimates?: EstimateDocument[];
    loading?: boolean;
}

const ITEMS_PER_PAGE = 20;

function getEstimateDate(estimate: EstimateDocument) {
    const rawCreatedAt = estimate.createdAt ?? estimate.options.createdAt;

    if (!rawCreatedAt) {
        return null;
    }

    if (rawCreatedAt instanceof Date) {
        return rawCreatedAt;
    }

    if (isTimestampObject(rawCreatedAt) && typeof rawCreatedAt.toDate === 'function') {
        return rawCreatedAt.toDate();
    }

    if (isTimestampObject(rawCreatedAt) && typeof rawCreatedAt.seconds === 'number') {
        return new Date(rawCreatedAt.seconds * 1000);
    }

    if (typeof rawCreatedAt !== 'string') {
        return null;
    }

    const parsedDate = new Date(rawCreatedAt);
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function getDateInputBoundary(value: string, boundary: 'start' | 'end') {
    if (!value) {
        return null;
    }

    const date = new Date(`${value}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    if (boundary === 'end') {
        date.setHours(23, 59, 59, 999);
    }

    return date;
}

export default function EstimatesTable({ estimates: initialEstimates, loading: initialLoading = true }: EstimatesTableProps) {
    const [estimates, setEstimates] = useState<EstimateDocument[]>(initialEstimates ?? []);
    const [loading, setLoading] = useState(initialEstimates ? initialLoading : true);
    const [search, setSearch] = useState('');
    const [workType, setWorkType] = useState('all');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const router = useRouter();

    useEffect(() => {
        if (initialEstimates) {
            setEstimates(initialEstimates);
            setLoading(initialLoading);
            return;
        }

        const fetchEstimates = async () => {
            setLoading(true);
            try {
                const data = await getEstimates();
                const sorted = (data as EstimateDocument[]).sort((a, b) => 
                    (getEstimateDate(b)?.getTime() || 0) - (getEstimateDate(a)?.getTime() || 0)
                );
                setEstimates(sorted);
            } catch (error) {
                console.error("Error fetching estimates:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchEstimates();
    }, [initialEstimates, initialLoading]);

    useEffect(() => {
        setCurrentPage(1);
    }, [search, workType, dateFrom, dateTo]);

    const handleRowClick = (estimateId: string) => {
        router.push(`/admin/estimate/${estimateId}`);
    };

    const normalizedSearch = search.trim().toLowerCase();
    const fromDate = getDateInputBoundary(dateFrom, 'start');
    const toDate = getDateInputBoundary(dateTo, 'end');

    const availableWorkTypes = Array.from(
        new Set(
            estimates.flatMap((estimate) => estimate.options.typeOfWork ?? [])
        )
    ).sort((a, b) => a.localeCompare(b));

    const filteredEstimates = estimates.filter((estimate) => {
        const estimateDate = getEstimateDate(estimate);
        const matchesSearch =
            !normalizedSearch ||
            estimate.options.name.toLowerCase().includes(normalizedSearch) ||
            estimate.options.email.toLowerCase().includes(normalizedSearch) ||
            estimate.options.phone?.toLowerCase().includes(normalizedSearch);

        const matchesWorkType =
            workType === 'all' ||
            estimate.options.typeOfWork?.includes(workType);

        const matchesFromDate = !fromDate || (estimateDate ? estimateDate >= fromDate : false);
        const matchesToDate = !toDate || (estimateDate ? estimateDate <= toDate : false);

        return matchesSearch && matchesWorkType && matchesFromDate && matchesToDate;
    });

    const totalPages = Math.max(1, Math.ceil(filteredEstimates.length / ITEMS_PER_PAGE));
    const safeCurrentPage = Math.min(currentPage, totalPages);
    const startIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
    const paginatedEstimates = filteredEstimates.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    const pageNumbers = Array.from(
        { length: totalPages },
        (_, index) => index + 1
    ).filter((pageNumber) => Math.abs(pageNumber - safeCurrentPage) <= 1);

    const clearFilters = () => {
        setSearch('');
        setWorkType('all');
        setDateFrom('');
        setDateTo('');
        setCurrentPage(1);
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="border-b p-4">
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr),180px,160px,160px,auto]">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input 
                            placeholder="Search by name, email, or phone..." 
                            className="pl-9"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <Select value={workType} onValueChange={setWorkType}>
                        <SelectTrigger>
                            <SelectValue placeholder="All work types" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All work types</SelectItem>
                            {availableWorkTypes.map((type) => (
                                <SelectItem key={type} value={type}>
                                    {type}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        aria-label="Filter from date"
                    />
                    <Input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        aria-label="Filter to date"
                    />
                    <Button
                        type="button"
                        variant="outline"
                        onClick={clearFilters}
                        className="gap-2"
                    >
                        <FilterX className="h-4 w-4" />
                        Reset
                    </Button>
                </div>

                <div className="mt-3 flex flex-col gap-1 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
                    <p>
                        Showing {filteredEstimates.length === 0 ? 0 : startIndex + 1}-
                        {Math.min(startIndex + ITEMS_PER_PAGE, filteredEstimates.length)} of {filteredEstimates.length} results
                    </p>
                    <p>
                        Page {safeCurrentPage} of {totalPages}
                    </p>
                </div>
            </div>
            
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                            <TableHead className="w-[200px]">Customer</TableHead>
                            <TableHead>Contact Info</TableHead>
                            <TableHead>Work Type</TableHead>
                            <TableHead>Estimate Result</TableHead>
                            <TableHead className="text-right">Date</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedEstimates.length > 0 ? (
                            paginatedEstimates.map((estimate) => {
                                const estimateDate = getEstimateDate(estimate);

                                return (
                                <TableRow 
                                    key={estimate.id} 
                                    onClick={() => handleRowClick(estimate.id)} 
                                    className="cursor-pointer hover:bg-muted/40 transition-colors"
                                >
                                    <TableCell className="font-medium">
                                        {estimate.options.name}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col text-xs">
                                            <span>{estimate.options.email}</span>
                                            <span className="text-muted-foreground">{estimate.options.phone}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-wrap gap-1">
                                            {estimate.options.typeOfWork?.map((type, i) => (
                                                <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0">
                                                    {type.split(' ')[0]}
                                                </Badge>
                                            ))}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <span className="font-semibold text-primary text-sm">
                                            {estimate.estimate?.priceRange || 'N/A'}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right text-xs text-muted-foreground">
                                        <div className="flex items-center justify-end gap-1">
                                            <Calendar className="h-3 w-3" />
                                            {estimateDate ? estimateDate.toLocaleDateString('en-AU') : 'N/A'}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )})
                        ) : (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                    No estimates found.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {filteredEstimates.length > ITEMS_PER_PAGE && (
                <div className="flex flex-col gap-3 border-t px-4 pb-4 pt-2 md:flex-row md:items-center md:justify-between">
                    <div className="text-sm text-muted-foreground">
                        20 results per page
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                            disabled={safeCurrentPage === 1}
                            className="gap-1"
                        >
                            <ChevronLeft className="h-4 w-4" />
                            Previous
                        </Button>
                        {safeCurrentPage > 2 && (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(1)}
                            >
                                1
                            </Button>
                        )}
                        {safeCurrentPage > 3 && (
                            <span className="px-1 text-muted-foreground">...</span>
                        )}
                        {pageNumbers.map((pageNumber) => (
                            <Button
                                key={pageNumber}
                                type="button"
                                variant={pageNumber === safeCurrentPage ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setCurrentPage(pageNumber)}
                            >
                                {pageNumber}
                            </Button>
                        ))}
                        {safeCurrentPage < totalPages - 2 && (
                            <span className="px-1 text-muted-foreground">...</span>
                        )}
                        {safeCurrentPage < totalPages - 1 && (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(totalPages)}
                            >
                                {totalPages}
                            </Button>
                        )}
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                            disabled={safeCurrentPage === totalPages}
                            className="gap-1"
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
