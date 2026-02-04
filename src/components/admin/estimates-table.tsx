'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getEstimates } from '@/lib/firebase';

// Firestore 문서의 타입을 정의합니다.
interface EstimateDocument {
  id: string;
  options: {
    name: string;
    email: string;
    phone: string;
    typeOfWork: string[]; // Corrected from workType to typeOfWork, and it's an array
  };
  estimate?: { // estimate object can be optional
    priceRange?: string;
  };
}

const EstimatesTable = () => {
    const [estimates, setEstimates] = useState<EstimateDocument[]>([]);
    const router = useRouter();

    useEffect(() => {
        const fetchEstimates = async () => {
            const estimatesData = await getEstimates();
            setEstimates(estimatesData as EstimateDocument[]);
        };

        fetchEstimates();
    }, []);

    const handleRowClick = (estimateId: string) => {
        router.push(`/admin/estimate/${estimateId}`);
    };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Phone</TableHead>
          <TableHead>Work Type</TableHead>
          <TableHead>Price Range</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {estimates.map((estimate) => (
          <TableRow key={estimate.id} onClick={() => handleRowClick(estimate.id)} className="cursor-pointer">
            <TableCell>{estimate.options.name}</TableCell>
            <TableCell>{estimate.options.email}</TableCell>
            <TableCell>{estimate.options.phone}</TableCell>
            {/* Correctly access typeOfWork and join the array to a string */}
            <TableCell>{estimate.options.typeOfWork?.join(', ') || 'N/A'}</TableCell>
            <TableCell>{estimate.estimate?.priceRange || 'N/A'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

export default EstimatesTable;
