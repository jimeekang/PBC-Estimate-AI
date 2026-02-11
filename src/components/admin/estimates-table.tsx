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
import { Search, Loader2, Calendar } from 'lucide-react';

interface EstimateDocument {
  id: string;
  options: {
    name: string;
    email: string;
    phone: string;
    typeOfWork: string[];
    createdAt?: any;
  };
  estimate?: {
    priceRange?: string;
  };
  createdAt: any;
}

export default function EstimatesTable() {
    const [estimates, setEstimates] = useState<EstimateDocument[]>([]);
    const [filteredEstimates, setFilteredEstimates] = useState<EstimateDocument[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const router = useRouter();

    useEffect(() => {
        const fetchEstimates = async () => {
            setLoading(true);
            try {
                const data = await getEstimates();
                const sorted = (data as EstimateDocument[]).sort((a, b) => 
                    (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
                );
                setEstimates(sorted);
                setFilteredEstimates(sorted);
            } catch (error) {
                console.error("Error fetching estimates:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchEstimates();
    }, []);

    useEffect(() => {
        const filtered = estimates.filter(est => 
            est.options.name.toLowerCase().includes(search.toLowerCase()) ||
            est.options.email.toLowerCase().includes(search.toLowerCase())
        );
        setFilteredEstimates(filtered);
    }, [search, estimates]);

    const handleRowClick = (estimateId: string) => {
        router.push(`/admin/estimate/${estimateId}`);
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
            <div className="p-4 border-b">
                <div className="relative max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search by name or email..." 
                        className="pl-9"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
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
                        {filteredEstimates.length > 0 ? (
                            filteredEstimates.map((estimate) => (
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
                                            {new Date(estimate.createdAt?.seconds * 1000).toLocaleDateString()}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
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
        </div>
    );
}
