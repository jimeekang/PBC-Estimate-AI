'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getEstimate } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { 
    ChevronLeft, 
    User, 
    Home, 
    Calendar, 
    MapPin, 
    Phone, 
    Mail, 
    Layout, 
    Sparkles, 
    Info, 
    Droplets, 
    Hammer, 
    ArrowUpToLine, 
    Paintbrush, 
    Palette 
} from 'lucide-react';

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

export default function EstimateDetailsPage() {
    const params = useParams();
    const router = useRouter();
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
        return (
            <div className="flex flex-col justify-center items-center h-screen space-y-4">
                <Sparkles className="h-10 w-10 animate-pulse text-primary" />
                <p className="text-muted-foreground animate-pulse">Loading project details...</p>
            </div>
        );
    }

    if (!estimate) {
        return (
            <div className="flex flex-col justify-center items-center h-screen space-y-4">
                <p className="text-xl font-semibold">Estimate not found.</p>
                <Button onClick={() => router.push('/admin')}>Return to Dashboard</Button>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 max-w-5xl py-10 space-y-6">
            <Button variant="ghost" className="pl-0 hover:bg-transparent" onClick={() => router.push('/admin')}>
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
            </Button>

            <div className="grid lg:grid-cols-3 gap-6">
                {/* Left Column: Customer & Project Specs */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className="shadow-sm border-primary/5">
                        <CardHeader className="bg-muted/30 pb-4">
                            <div className="flex justify-between items-start">
                                <CardTitle className="text-2xl font-bold flex items-center gap-2">
                                    <User className="h-5 w-5 text-primary" />
                                    {estimate.options.name}
                                </CardTitle>
                                <Badge variant="outline" className="bg-background">
                                    <Calendar className="mr-1 h-3 w-3" />
                                    {new Date(estimate.createdAt?.seconds * 1000).toLocaleDateString()}
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-8">
                            <div className="grid md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Contact Details</h3>
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 text-sm">
                                            <Mail className="h-4 w-4 text-primary" />
                                            <span>{estimate.options.email}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm">
                                            <Phone className="h-4 w-4 text-primary" />
                                            <span>{estimate.options.phone || 'No phone provided'}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm">
                                            <MapPin className="h-4 w-4 text-primary" />
                                            <span>{estimate.options.location || 'No location specified'}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Project Overview</h3>
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 text-sm">
                                            <Home className="h-4 w-4 text-primary" />
                                            <span><strong>Property:</strong> {estimate.options.propertyType}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm">
                                            <Layout className="h-4 w-4 text-primary" />
                                            <span><strong>Scope:</strong> {estimate.options.scopeOfPainting}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm">
                                            <Info className="h-4 w-4 text-primary" />
                                            <span><strong>Condition:</strong> {estimate.options.paintCondition || 'Fair'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <Separator />

                            <div className="space-y-6">
                                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Detailed Selection</h3>
                                <div className="grid md:grid-cols-2 gap-6">
                                    {estimate.options.roomsToPaint && estimate.options.roomsToPaint.length > 0 && (
                                        <div className="space-y-2">
                                            <p className="text-sm font-medium">Interior Rooms:</p>
                                            <div className="flex flex-wrap gap-1">
                                                {estimate.options.roomsToPaint.map(room => (
                                                    <Badge key={room} variant="secondary" className="text-[10px]">{room}</Badge>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {estimate.options.exteriorAreas && estimate.options.exteriorAreas.length > 0 && (
                                        <div className="space-y-2">
                                            <p className="text-sm font-medium">Exterior Areas:</p>
                                            <div className="flex flex-wrap gap-1">
                                                {estimate.options.exteriorAreas.map(area => (
                                                    <Badge key={area} variant="outline" className="text-[10px]">{area}</Badge>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="bg-muted/30 p-4 rounded-lg space-y-4">
                                    <div className="flex items-center gap-4 text-sm">
                                        <div className="flex items-center gap-1">
                                            <Paintbrush className="h-4 w-4 text-primary" />
                                            <span>{estimate.options.approxSize ? `${estimate.options.approxSize} sqm` : 'Size N/A'}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Palette className="h-4 w-4 text-primary" />
                                            <span>{estimate.options.existingWallColour || 'Current colour N/A'}</span>
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <p className="text-xs font-semibold text-muted-foreground uppercase">Areas to Paint</p>
                                        <div className="flex gap-2">
                                            {estimate.options.paintAreas.ceilingPaint && <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20">Ceiling</Badge>}
                                            {estimate.options.paintAreas.wallPaint && <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20">Walls</Badge>}
                                            {estimate.options.paintAreas.trimPaint && <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20">Trim</Badge>}
                                        </div>
                                    </div>

                                    {estimate.options.trimPaintOptions && (
                                        <div className="text-xs space-y-1 pt-2 border-t border-primary/5">
                                            <p><strong>Trim Paint Type:</strong> {estimate.options.trimPaintOptions.paintType}</p>
                                            <p><strong>Trim Items:</strong> {estimate.options.trimPaintOptions.trimItems.join(', ')}</p>
                                        </div>
                                    )}
                                </div>
                                
                                {estimate.options.jobDifficulty && estimate.options.jobDifficulty.length > 0 && (
                                    <div className="space-y-2">
                                        <p className="text-sm font-medium">Complexity Factors:</p>
                                        <div className="flex flex-wrap gap-2">
                                            {estimate.options.jobDifficulty.map(diff => (
                                                <div key={diff} className="flex items-center gap-1 text-xs text-muted-foreground bg-amber-50 px-2 py-1 rounded border border-amber-100">
                                                    <Info className="h-3 w-3 text-amber-600" />
                                                    {diff}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column: AI Estimate Result */}
                <div className="space-y-6">
                    <Card className="shadow-md border-primary/20 bg-primary/[0.02]">
                        <CardHeader className="bg-primary/10 border-b border-primary/10">
                            <CardTitle className="text-lg font-bold flex items-center gap-2 text-primary">
                                <Sparkles className="h-5 w-5" />
                                AI Estimate Result
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-6">
                            {estimate.estimate ? (
                                <>
                                    <div className="text-center p-4 bg-white rounded-lg border shadow-sm">
                                        <p className="text-xs text-muted-foreground uppercase font-bold tracking-widest mb-1">Estimated Range</p>
                                        <p className="text-2xl font-black text-primary">
                                            {estimate.estimate.priceRange || 'Calculating...'}
                                        </p>
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <h4 className="text-sm font-bold flex items-center gap-2">
                                            <Info className="h-4 w-4" /> Professional Breakdown
                                        </h4>
                                        <p className="text-sm text-muted-foreground leading-relaxed italic">
                                            "{estimate.estimate.explanation}"
                                        </p>
                                    </div>

                                    {estimate.estimate.details && (
                                        <div className="space-y-3 pt-2">
                                            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Key Pricing Factors</h4>
                                            <ul className="space-y-2">
                                                {estimate.estimate.details.map((detail, index) => (
                                                    <li key={index} className="flex gap-2 text-xs">
                                                        <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                                                        <span>{detail}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="text-center py-10 text-muted-foreground">
                                    No AI data generated for this entry.
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="bg-amber-50 border-amber-100">
                        <CardContent className="p-4 space-y-3">
                            <h4 className="text-sm font-bold flex items-center gap-2 text-amber-700">
                                <Info className="h-4 w-4" /> Next Steps
                            </h4>
                            <p className="text-xs text-amber-800 leading-relaxed">
                                Review the AI result against historical data. This estimate is indicative and serves as a conversation starter for the on-site inspection.
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
