'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { getEstimate } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Firestore 문서의 타입을 정의합니다.
interface EstimateDocument {
    id: string;
    options: {
        name: string;
        email: string;
        phone: string;
        typeOfWork: string[]; // Corrected from workType to typeOfWork, and it's an array
        address?: string;
        additionalInfo?: string;
    };
    estimate?: {
        priceRange?: string;
        details?: string[];
        breakdown?: { [key: string]: string };
    };
    createdAt: any;
    userId: string;
}

const EstimateDetailsPage = () => {
    const params = useParams();
    const id = params.id as string;
    const [estimate, setEstimate] = useState<EstimateDocument | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!id) return;

        const fetchEstimate = async () => {
            setLoading(true);
            try {
                const estimateData = await getEstimate(id);
                setEstimate(estimateData as EstimateDocument | null);
            } catch (error) {
                console.error("Error fetching estimate:", error);
                setEstimate(null);
            } finally {
                setLoading(false);
            }
        };

        fetchEstimate();
    }, [id]);

    if (loading) {
        return <div className="flex justify-center items-center h-screen">Loading estimate details...</div>;
    }

    if (!estimate) {
        return <div className="flex justify-center items-center h-screen">Estimate not found.</div>;
    }

    return (
        <div className="container mx-auto p-4">
            <Card className="max-w-4xl mx-auto">
                <CardHeader>
                    <CardTitle className="text-3xl font-bold">Estimate Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* User Provided Information */}
                    <div className="space-y-2">
                        <h3 className="text-xl font-semibold">Customer Information</h3>
                        <p><strong>Name:</strong> {estimate.options.name}</p>
                        <p><strong>Email:</strong> {estimate.options.email}</p>
                        <p><strong>Phone:</strong> {estimate.options.phone}</p>
                        <p><strong>Address:</strong> {estimate.options.address || 'N/A'}</p>
                        {/* Correctly access typeOfWork and join the array to a string */}
                        <p><strong>Work Type:</strong> {estimate.options.typeOfWork?.join(', ') || 'N/A'}</p>
                        <p><strong>Additional Info:</strong> {estimate.options.additionalInfo || 'N/A'}</p>
                    </div>

                    {/* AI Generated Estimate */}
                    {estimate.estimate ? (
                        <div className="space-y-2 pt-4 border-t">
                            <h3 className="text-xl font-semibold">AI Generated Estimate</h3>
                            <p className="text-lg"><strong>Price Range:</strong> {estimate.estimate.priceRange || 'Not available'}</p>
                            
                            {estimate.estimate.details && (
                                <div className="prose max-w-none">
                                    <h4 className="font-semibold">Details:</h4>
                                    <ul>
                                        {estimate.estimate.details.map((detail, index) => (
                                            <li key={index}>{detail}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {estimate.estimate.breakdown && (
                                <div>
                                    <h4 className="font-semibold">Cost Breakdown:</h4>
                                    <ul className="list-disc pl-5 space-y-1">
                                        {Object.entries(estimate.estimate.breakdown).map(([key, value]) => (
                                            <li key={key}><strong>{key}:</strong> {value}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    ) : (
                        <p className="pt-4 border-t">No AI estimate has been generated for this request yet.</p>
                    )}

                </CardContent>
            </Card>
        </div>
    );
};

export default EstimateDetailsPage;
