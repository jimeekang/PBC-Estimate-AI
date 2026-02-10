'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { getEstimate } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

// Firestore 문서의 타입을 정의합니다.
interface EstimateDocument {
    id: string;
    options: {
        name: string;
        email: string;
        phone?: string;
        location?: string;
        typeOfWork: string[];
        propertyType: string;
        scopeOfPainting: string;
        roomsToPaint?: string[];
        exteriorAreas?: string[];
        approxSize?: number;
        existingWallColour?: string;
        timingPurpose: string;
        paintCondition?: string;
        jobDifficulty?: string[];
        paintAreas: {
            ceilingPaint: boolean;
            wallPaint: boolean;
            trimPaint: boolean;
        };
        trimPaintOptions?: {
            paintType: string;
            trimItems: string[];
        };
    };
    estimate?: {
        priceRange?: string;
        explanation?: string;
        details?: string[];
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
        <div className="container mx-auto p-4 max-w-4xl py-10">
            <Card className="shadow-lg">
                <CardHeader className="bg-primary/5">
                    <div className="flex justify-between items-center">
                        <CardTitle className="text-2xl font-bold">Estimate Details</CardTitle>
                        <Badge variant="outline">{new Date(estimate.createdAt?.seconds * 1000).toLocaleDateString()}</Badge>
                    </div>
                </CardHeader>
                <CardContent className="space-y-8 pt-6">
                    {/* User Provided Information */}
                    <div className="grid md:grid-cols-2 gap-8">
                        <div className="space-y-3">
                            <h3 className="text-lg font-semibold text-primary">Customer Info</h3>
                            <p><strong>Name:</strong> {estimate.options.name}</p>
                            <p><strong>Email:</strong> {estimate.options.email}</p>
                            <p><strong>Phone:</strong> {estimate.options.phone || 'N/A'}</p>
                            <p><strong>Location:</strong> {estimate.options.location || 'N/A'}</p>
                        </div>
                        <div className="space-y-3">
                            <h3 className="text-lg font-semibold text-primary">Property Info</h3>
                            <p><strong>Property:</strong> {estimate.options.propertyType}</p>
                            <p><strong>Work Type:</strong> {estimate.options.typeOfWork?.join(', ')}</p>
                            <p><strong>Scope:</strong> {estimate.options.scopeOfPainting}</p>
                            <p><strong>Purpose:</strong> {estimate.options.timingPurpose}</p>
                        </div>
                    </div>

                    <Separator />

                    <div className="grid md:grid-cols-2 gap-8">
                        <div className="space-y-3">
                            <h3 className="text-lg font-semibold text-primary">Selection Details</h3>
                            {estimate.options.roomsToPaint && estimate.options.roomsToPaint.length > 0 && (
                                <p><strong>Rooms:</strong> {estimate.options.roomsToPaint.join(', ')}</p>
                            )}
                            {estimate.options.exteriorAreas && estimate.options.exteriorAreas.length > 0 && (
                                <p><strong>Exterior Areas:</strong> {estimate.options.exteriorAreas.join(', ')}</p>
                            )}
                            <p><strong>Condition:</strong> {estimate.options.paintCondition || 'N/A'}</p>
                            <p><strong>Size:</strong> {estimate.options.approxSize ? `${estimate.options.approxSize} sqm` : 'N/A'}</p>
                        </div>
                        <div className="space-y-3">
                            <h3 className="text-lg font-semibold text-primary">Paint Areas</h3>
                            <div className="flex gap-2 flex-wrap">
                                {estimate.options.paintAreas.ceilingPaint && <Badge>Ceiling</Badge>}
                                {estimate.options.paintAreas.wallPaint && <Badge>Wall</Badge>}
                                {estimate.options.paintAreas.trimPaint && <Badge>Trim</Badge>}
                            </div>
                            {estimate.options.trimPaintOptions && (
                                <div className="text-sm bg-muted p-2 rounded">
                                    <p><strong>Trim Type:</strong> {estimate.options.trimPaintOptions.paintType}</p>
                                    <p><strong>Items:</strong> {estimate.options.trimPaintOptions.trimItems.join(', ')}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* AI Generated Estimate */}
                    {estimate.estimate ? (
                        <div className="space-y-4 pt-6 border-t-2 border-primary/20 bg-primary/5 p-6 rounded-lg">
                            <h3 className="text-xl font-bold text-primary flex items-center gap-2">
                                AI Generated Result
                            </h3>
                            <div className="bg-white p-4 rounded-md border shadow-sm">
                                <p className="text-2xl font-bold text-primary mb-2">
                                    {estimate.estimate.priceRange || 'Price not generated'}
                                </p>
                                <p className="text-muted-foreground leading-relaxed italic">
                                    "{estimate.estimate.explanation}"
                                </p>
                            </div>
                            
                            {estimate.estimate.details && (
                                <div className="space-y-2">
                                    <h4 className="font-semibold">Key Factors:</h4>
                                    <ul className="list-disc pl-5 space-y-1">
                                        {estimate.estimate.details.map((detail, index) => (
                                            <li key={index} className="text-sm">{detail}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="pt-4 border-t text-center text-muted-foreground">
                            No AI estimate result found in this document.
                        </div>
                    )}

                </CardContent>
            </Card>
        </div>
    );
};

export default EstimateDetailsPage;
