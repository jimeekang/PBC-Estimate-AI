'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getEstimate } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import {
  ChevronLeft,
  ChevronRight,
  User,
  Home,
  Calendar,
  MapPin,
  Phone,
  Mail,
  Layout,
  Sparkles,
  Info,
  Paintbrush,
  Camera,
  X,
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
    otherExteriorArea?: string;
    wallType?: string;
    approxSize?: number;
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
      interiorWindowFrameTypes?: string[];
    };
  };
  estimate?: {
    priceRange?: string;
    explanation?: string;
    details?: string[];
  };
  photoUrls?: string[];
  createdAt: any;
  userId: string;
}

export default function EstimateDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [estimate, setEstimate] = useState<EstimateDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!id) return;

    const fetchEstimate = async () => {
      setLoading(true);
      try {
        const estimateData = await getEstimate(id);
        setEstimate(estimateData as EstimateDocument | null);
      } catch (error) {
        console.error('Error fetching estimate:', error);
        setEstimate(null);
      } finally {
        setLoading(false);
      }
    };

    fetchEstimate();
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center space-y-4">
        <Sparkles className="h-10 w-10 animate-pulse text-primary" />
        <p className="animate-pulse text-muted-foreground">Loading project details...</p>
      </div>
    );
  }

  if (!estimate) {
    return (
      <div className="flex h-screen flex-col items-center justify-center space-y-4">
        <p className="text-xl font-semibold">Estimate not found.</p>
        <Button onClick={() => router.push('/admin')}>Return to Dashboard</Button>
      </div>
    );
  }

  return (
    <>
    <div className="container mx-auto max-w-5xl space-y-6 p-4 py-10">
      <Button variant="ghost" className="pl-0 hover:bg-transparent" onClick={() => router.push('/admin')}>
        <ChevronLeft className="mr-2 h-4 w-4" />
        Back to Dashboard
      </Button>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="border-primary/5 shadow-sm">
            <CardHeader className="bg-muted/30 pb-4">
              <div className="flex items-start justify-between">
                <CardTitle className="flex items-center gap-2 text-2xl font-bold">
                  <User className="h-5 w-5 text-primary" />
                  {estimate.options.name}
                </CardTitle>
                <Badge variant="outline" className="bg-background">
                  <Calendar className="mr-1 h-3 w-3" />
                  {new Date(estimate.createdAt?.seconds * 1000).toLocaleDateString()}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-8 pt-6">
              <div className="grid gap-8 md:grid-cols-2">
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Contact Details
                  </h3>
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
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Project Overview
                  </h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Home className="h-4 w-4 text-primary" />
                      <span>
                        <strong>Property:</strong> {estimate.options.propertyType}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Layout className="h-4 w-4 text-primary" />
                      <span>
                        <strong>Scope:</strong> {estimate.options.scopeOfPainting}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Info className="h-4 w-4 text-primary" />
                      <span>
                        <strong>Condition:</strong> {estimate.options.paintCondition || 'Fair'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-6">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Detailed Selection
                </h3>
                <div className="grid gap-6 md:grid-cols-2">
                  {estimate.options.roomsToPaint && estimate.options.roomsToPaint.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Interior Rooms:</p>
                      <div className="flex flex-wrap gap-1">
                        {estimate.options.roomsToPaint.map((room) => (
                          <Badge key={room} variant="secondary" className="text-[10px]">
                            {room}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {estimate.options.exteriorAreas && estimate.options.exteriorAreas.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Exterior Areas:</p>
                      <div className="flex flex-wrap gap-1">
                        {estimate.options.exteriorAreas.map((area) => (
                          <Badge key={area} variant="outline" className="text-[10px]">
                            {area === 'Etc' && estimate.options.otherExteriorArea
                              ? `${area} (${estimate.options.otherExteriorArea})`
                              : area}
                          </Badge>
                        ))}
                      </div>
                      {estimate.options.wallType && (
                        <div className="mt-2">
                          <p className="text-xs font-semibold uppercase text-muted-foreground">
                            Wall Finish
                          </p>
                          <Badge variant="outline" className="text-xs capitalize">
                            {estimate.options.wallType}
                          </Badge>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-4 rounded-lg bg-muted/30 p-4">
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <Paintbrush className="h-4 w-4 text-primary" />
                      <span>
                        {estimate.options.approxSize ? `${estimate.options.approxSize} sqm` : 'Size N/A'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">
                      Areas to Paint
                    </p>
                    <div className="flex gap-2">
                      {estimate.options.paintAreas.ceilingPaint && (
                        <Badge className="border-primary/20 bg-primary/10 text-primary hover:bg-primary/20">
                          Ceiling
                        </Badge>
                      )}
                      {estimate.options.paintAreas.wallPaint && (
                        <Badge className="border-primary/20 bg-primary/10 text-primary hover:bg-primary/20">
                          Walls
                        </Badge>
                      )}
                      {estimate.options.paintAreas.trimPaint && (
                        <Badge className="border-primary/20 bg-primary/10 text-primary hover:bg-primary/20">
                          Trim
                        </Badge>
                      )}
                    </div>
                  </div>

                  {estimate.options.trimPaintOptions && (
                    <div className="space-y-1 border-t border-primary/5 pt-2 text-xs">
                      <p>
                        <strong>Trim Paint Type:</strong> {estimate.options.trimPaintOptions.paintType}
                      </p>
                      <p>
                        <strong>Trim Items:</strong>{' '}
                        {estimate.options.trimPaintOptions.trimItems.join(', ')}
                      </p>
                      {!!estimate.options.trimPaintOptions.interiorWindowFrameTypes?.length && (
                        <p>
                          <strong>Interior Window Types:</strong>{' '}
                          {estimate.options.trimPaintOptions.interiorWindowFrameTypes.join(', ')}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {estimate.options.jobDifficulty && estimate.options.jobDifficulty.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Complexity Factors:</p>
                    <div className="flex flex-wrap gap-2">
                      {estimate.options.jobDifficulty.map((diff) => (
                        <div
                          key={diff}
                          className="flex items-center gap-1 rounded border border-amber-100 bg-amber-50 px-2 py-1 text-xs text-muted-foreground"
                        >
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

        <div className="space-y-6">
          {estimate.photoUrls && estimate.photoUrls.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Camera className="h-5 w-5 text-primary" />
                  Property Photos
                  <span className="ml-auto text-xs font-normal text-muted-foreground">
                    {estimate.photoUrls.length} photo{estimate.photoUrls.length > 1 ? 's' : ''}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2">
                  {estimate.photoUrls.map((url, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setLightboxIndex(idx)}
                      className="group relative aspect-square overflow-hidden rounded-md border bg-muted hover:ring-2 hover:ring-primary transition-all"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={`Property photo ${idx + 1}`}
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="border-primary/20 bg-primary/[0.02] shadow-md">
            <CardHeader className="border-b border-primary/10 bg-primary/10">
              <CardTitle className="flex items-center gap-2 text-lg font-bold text-primary">
                <Sparkles className="h-5 w-5" />
                AI Estimate Result
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              {estimate.estimate ? (
                <>
                  <div className="rounded-lg border bg-white p-4 text-center shadow-sm">
                    <p className="mb-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      Estimated Range
                    </p>
                    <p className="text-2xl font-black text-primary">
                      {estimate.estimate.priceRange || 'Calculating...'}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="flex items-center gap-2 text-sm font-bold">
                      <Info className="h-4 w-4" /> Professional Breakdown
                    </h4>
                    <p className="text-sm italic leading-relaxed text-muted-foreground">
                      &quot;{estimate.estimate.explanation}&quot;
                    </p>
                  </div>

                  {estimate.estimate.details && (
                    <div className="space-y-3 pt-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Key Pricing Factors
                      </h4>
                      <ul className="space-y-2">
                        {estimate.estimate.details.map((detail, index) => (
                          <li key={index} className="flex gap-2 text-xs">
                            <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                            <span>{detail}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <div className="py-10 text-center text-muted-foreground">
                  No AI data generated for this entry.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>

    {/* Lightbox */}

    {lightboxIndex !== null && estimate.photoUrls && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
        onClick={() => setLightboxIndex(null)}
      >
        {/* Close */}
        <button
          type="button"
          aria-label="Close"
          onClick={() => setLightboxIndex(null)}
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Prev */}
        {lightboxIndex > 0 && (
          <button
            type="button"
            aria-label="Previous photo"
            onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex - 1); }}
            className="absolute left-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}

        {/* Image */}
        <div onClick={(e) => e.stopPropagation()} className="max-h-[90vh] max-w-[90vw]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={estimate.photoUrls[lightboxIndex]}
            alt={`Property photo ${lightboxIndex + 1}`}
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
          />
          <p className="mt-2 text-center text-sm text-white/60">
            {lightboxIndex + 1} / {estimate.photoUrls.length}
          </p>
        </div>

        {/* Next */}
        {lightboxIndex < estimate.photoUrls.length - 1 && (
          <button
            type="button"
            aria-label="Next photo"
            onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex + 1); }}
            className="absolute right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
      </div>
    )}
    </>
  );
}
