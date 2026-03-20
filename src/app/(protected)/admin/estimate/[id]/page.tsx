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
  Sparkles,
  Info,
  Paintbrush,
  Camera,
  X,
  Bed,
  Bath,
  Layers,
  Ruler,
  Clock,
  AlertTriangle,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface InteriorRoom {
  roomName: string;
  otherRoomName?: string;
  paintAreas: {
    ceilingPaint: boolean;
    wallPaint: boolean;
    trimPaint: boolean;
    ensuitePaint?: boolean;
  };
  approxRoomSize?: number;
  handrailDetails?: {
    lengthLm?: number;
    widthMm?: number;
    system?: string;
  };
}

interface ExteriorDoor {
  style: 'Simple' | 'Standard' | 'Complex';
  quantity: number;
}

interface ExteriorWindow {
  type: 'Normal' | 'Awning' | 'Double Hung' | 'French';
  quantity: number;
}

interface ExteriorArchitrave {
  style: 'Simple' | 'Standard' | 'Complex';
  quantity: number;
}

interface EstimateDocument {
  id: string;
  userId: string;
  photoUrls?: string[];
  createdAt: any;
  options: {
    name: string;
    email: string;
    phone?: string;
    location?: string;
    typeOfWork: string[];
    propertyType: string;
    scopeOfPainting: string;
    houseStories?: string;
    bedroomCount?: number;
    bathroomCount?: number;
    // Rooms
    roomsToPaint?: string[];
    interiorRooms?: InteriorRoom[];
    // Exterior areas
    exteriorAreas?: string[];
    otherExteriorArea?: string;
    exteriorTrimItems?: string[];
    exteriorDoors?: ExteriorDoor[];
    exteriorWindows?: ExteriorWindow[];
    exteriorArchitraves?: ExteriorArchitrave[];
    // Wall / size
    wallType?: string;
    wallFinishes?: string[];
    wallHeight?: number;
    approxSize?: number;
    // Meta
    timingPurpose: string;
    paintCondition?: string;
    jobDifficulty?: string[];
    // Paint areas
    paintAreas: {
      ceilingPaint: boolean;
      wallPaint: boolean;
      trimPaint: boolean;
      ensuitePaint?: boolean;
    };
    trimPaintOptions?: {
      paintType: string;
      trimItems: string[];
      interiorWindowFrameTypes?: string[];
    };
    ceilingOptions?: {
      ceilingType: string;
    };
  };
  estimate?: {
    priceRange?: string;
    explanation?: string;
    details?: string[];
    breakdown?: {
      interior?: { min: number; max: number; priceRange: string };
      exterior?: { min: number; max: number; priceRange: string };
      total: { min: number; max: number; priceRange: string };
    };
  };
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function PaintAreaBadges({ areas }: { areas: InteriorRoom['paintAreas'] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {areas.ceilingPaint && (
        <Badge className="border-sky-200 bg-sky-50 text-sky-700 text-[10px]">Ceiling</Badge>
      )}
      {areas.wallPaint && (
        <Badge className="border-sky-200 bg-sky-50 text-sky-700 text-[10px]">Walls</Badge>
      )}
      {areas.trimPaint && (
        <Badge className="border-sky-200 bg-sky-50 text-sky-700 text-[10px]">Trim</Badge>
      )}
      {areas.ensuitePaint && (
        <Badge className="border-sky-200 bg-sky-50 text-sky-700 text-[10px]">Ensuite</Badge>
      )}
    </div>
  );
}

function ConditionBadge({ condition }: { condition?: string }) {
  if (!condition) return null;
  const map: Record<string, string> = {
    Excellent: 'border-green-200 bg-green-50 text-green-700',
    Fair: 'border-yellow-200 bg-yellow-50 text-yellow-700',
    Poor: 'border-red-200 bg-red-50 text-red-700',
  };
  const cls = map[condition] ?? 'border-muted bg-muted/40 text-muted-foreground';
  return <Badge className={`${cls} text-xs`}>{condition}</Badge>;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </p>
  );
}

function InlineTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: (string | number)[][];
}) {
  if (!rows.length) return null;
  return (
    <div className="overflow-hidden rounded-md border text-sm">
      <table className="w-full">
        <thead>
          <tr className="bg-muted/40">
            {headers.map((h) => (
              <th key={h} className="px-3 py-1.5 text-left text-xs font-semibold text-muted-foreground">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t">
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-1.5 text-xs">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

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
        const data = await getEstimate(id);
        setEstimate(data as EstimateDocument | null);
      } catch (err) {
        console.error('Error fetching estimate:', err);
        setEstimate(null);
      } finally {
        setLoading(false);
      }
    };
    fetchEstimate();
  }, [id]);

  // ── Loading / Not Found ──────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center space-y-4">
        <Sparkles className="h-10 w-10 animate-pulse text-primary" />
        <p className="animate-pulse text-muted-foreground">Loading estimate details...</p>
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

  const { options, estimate: est, photoUrls, createdAt } = estimate;
  const hasInterior = options.typeOfWork.includes('Interior Painting');
  const hasExterior = options.typeOfWork.includes('Exterior Painting');
  const formattedDate = createdAt?.seconds
    ? new Date(createdAt.seconds * 1000).toLocaleDateString('en-AU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '—';

  // Wall finishes: prefer new array field, fall back to legacy single value
  const wallFinishes: string[] =
    options.wallFinishes?.length
      ? options.wallFinishes
      : options.wallType
      ? [options.wallType]
      : [];

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      <div className="container mx-auto max-w-6xl space-y-6 p-4 py-10">
        {/* Back nav */}
        <Button
          variant="ghost"
          className="pl-0 hover:bg-transparent"
          onClick={() => router.push('/admin')}
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* ── LEFT COLUMN ──────────────────────────────────────────────── */}
          <div className="space-y-6 lg:col-span-2">

            {/* Card 1: Client & Property */}
            <Card className="border-primary/5 shadow-sm">
              <CardHeader className="bg-muted/30 pb-4">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="flex items-center gap-2 text-2xl font-bold">
                    <User className="h-5 w-5 shrink-0 text-primary" />
                    {options.name}
                  </CardTitle>
                  <Badge variant="outline" className="shrink-0 bg-background text-xs">
                    <Calendar className="mr-1 h-3 w-3" />
                    {formattedDate}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-6 pt-6">
                {/* Contact + Property two-col */}
                <div className="grid gap-6 md:grid-cols-2">
                  {/* Contact */}
                  <div className="space-y-3">
                    <SectionLabel>Contact</SectionLabel>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 shrink-0 text-primary" />
                        <span className="break-all">{options.email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 shrink-0 text-primary" />
                        <span>{options.phone || 'Not provided'}</span>
                      </div>
                      {options.location && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 shrink-0 text-primary" />
                          <span>{options.location}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Property */}
                  <div className="space-y-3">
                    <SectionLabel>Property</SectionLabel>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Home className="h-4 w-4 shrink-0 text-primary" />
                        <span>{options.propertyType}</span>
                      </div>
                      {options.houseStories && (
                        <div className="flex items-center gap-2">
                          <Layers className="h-4 w-4 shrink-0 text-primary" />
                          <span>{options.houseStories} storey{options.houseStories !== '1' ? 's' : ''}</span>
                        </div>
                      )}
                      {options.bedroomCount !== undefined && (
                        <div className="flex items-center gap-2">
                          <Bed className="h-4 w-4 shrink-0 text-primary" />
                          <span>{options.bedroomCount} bedroom{options.bedroomCount !== 1 ? 's' : ''}</span>
                        </div>
                      )}
                      {options.bathroomCount !== undefined && (
                        <div className="flex items-center gap-2">
                          <Bath className="h-4 w-4 shrink-0 text-primary" />
                          <span>{options.bathroomCount} bathroom{options.bathroomCount !== 1 ? 's' : ''}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Badges row */}
                <div className="space-y-4">
                  {/* Type of work */}
                  <div className="flex flex-wrap gap-2">
                    {options.typeOfWork.map((t) => (
                      <Badge
                        key={t}
                        className={
                          t === 'Interior Painting'
                            ? 'border-blue-200 bg-blue-50 text-blue-700'
                            : 'border-green-200 bg-green-50 text-green-700'
                        }
                      >
                        {t}
                      </Badge>
                    ))}
                  </div>

                  {/* Meta row */}
                  <div className="grid gap-3 text-sm sm:grid-cols-3">
                    <div className="space-y-1">
                      <SectionLabel>Scope</SectionLabel>
                      <p>{options.scopeOfPainting}</p>
                    </div>
                    <div className="space-y-1">
                      <SectionLabel>Purpose</SectionLabel>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        <p>{options.timingPurpose}</p>
                      </div>
                    </div>
                    {options.paintCondition && (
                      <div className="space-y-1">
                        <SectionLabel>Paint Condition</SectionLabel>
                        <ConditionBadge condition={options.paintCondition} />
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Card 2: Interior Details */}
            {hasInterior && (
              <Card className="border-primary/5 shadow-sm">
                <CardHeader className="bg-muted/30 pb-4">
                  <CardTitle className="flex items-center gap-2 text-base font-semibold">
                    <Paintbrush className="h-4 w-4 text-primary" />
                    Interior Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5 pt-5">

                  {/* Structured rooms */}
                  {options.interiorRooms && options.interiorRooms.length > 0 ? (
                    <div className="space-y-3">
                      <SectionLabel>Rooms</SectionLabel>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {options.interiorRooms.map((room, i) => {
                          const displayName =
                            room.roomName === 'Other' && room.otherRoomName
                              ? room.otherRoomName
                              : room.roomName;
                          return (
                            <div
                              key={i}
                              className="rounded-lg border bg-muted/20 p-3 space-y-2"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-medium">{displayName}</p>
                                {room.approxRoomSize !== undefined && (
                                  <span className="text-xs text-muted-foreground">
                                    {room.approxRoomSize} sqm
                                  </span>
                                )}
                              </div>
                              {room.roomName === 'Handrail' ? (
                                <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                                  {room.handrailDetails?.lengthLm !== undefined && (
                                    <Badge variant="secondary" className="text-[10px]">
                                      {room.handrailDetails.lengthLm} lm
                                    </Badge>
                                  )}
                                  {room.handrailDetails?.widthMm !== undefined && (
                                    <Badge variant="secondary" className="text-[10px]">
                                      {room.handrailDetails.widthMm} mm
                                    </Badge>
                                  )}
                                  {room.handrailDetails?.system && (
                                    <Badge variant="secondary" className="text-[10px]">
                                      {room.handrailDetails.system}
                                    </Badge>
                                  )}
                                </div>
                              ) : (
                                <PaintAreaBadges areas={room.paintAreas} />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : options.roomsToPaint && options.roomsToPaint.length > 0 ? (
                    <div className="space-y-2">
                      <SectionLabel>Rooms</SectionLabel>
                      <div className="flex flex-wrap gap-1.5">
                        {options.roomsToPaint.map((r) => (
                          <Badge key={r} variant="secondary" className="text-xs">
                            {r}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {/* Global paint areas */}
                  <div className="space-y-2">
                    <SectionLabel>Areas to Paint</SectionLabel>
                    <PaintAreaBadges areas={options.paintAreas} />
                  </div>

                  {/* Ceiling options */}
                  {options.paintAreas.ceilingPaint && options.ceilingOptions?.ceilingType && (
                    <div className="space-y-2">
                      <SectionLabel>Ceiling Type</SectionLabel>
                      <Badge variant="outline" className="text-xs">
                        {options.ceilingOptions.ceilingType}
                      </Badge>
                    </div>
                  )}

                  {/* Trim options */}
                  {options.paintAreas.trimPaint && options.trimPaintOptions && (
                    <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
                      <SectionLabel>Trim Details</SectionLabel>
                      <div className="grid gap-3 sm:grid-cols-2 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Paint Type</p>
                          <p>{options.trimPaintOptions.paintType}</p>
                        </div>
                        {options.trimPaintOptions.trimItems.length > 0 && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Trim Items</p>
                            <div className="flex flex-wrap gap-1">
                              {options.trimPaintOptions.trimItems.map((item) => (
                                <Badge key={item} variant="secondary" className="text-[10px]">
                                  {item}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {!!options.trimPaintOptions.interiorWindowFrameTypes?.length && (
                          <div className="sm:col-span-2">
                            <p className="text-xs text-muted-foreground mb-1">
                              Interior Window Frame Types
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {options.trimPaintOptions.interiorWindowFrameTypes.map((wt) => (
                                <Badge key={wt} variant="secondary" className="text-[10px]">
                                  {wt}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Card 3: Exterior Details */}
            {hasExterior && (
              <Card className="border-primary/5 shadow-sm">
                <CardHeader className="bg-muted/30 pb-4">
                  <CardTitle className="flex items-center gap-2 text-base font-semibold">
                    <Home className="h-4 w-4 text-primary" />
                    Exterior Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5 pt-5">

                  {/* Exterior areas */}
                  {options.exteriorAreas && options.exteriorAreas.length > 0 && (
                    <div className="space-y-2">
                      <SectionLabel>Exterior Areas</SectionLabel>
                      <div className="flex flex-wrap gap-1.5">
                        {options.exteriorAreas.map((area) => (
                          <Badge
                            key={area}
                            className="border-green-200 bg-green-50 text-green-700 text-xs"
                          >
                            {area === 'Etc' && options.otherExteriorArea
                              ? `Other: ${options.otherExteriorArea}`
                              : area}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Size & dimensions */}
                  <div className="grid gap-4 sm:grid-cols-3 text-sm">
                    {options.approxSize !== undefined && (
                      <div className="flex items-center gap-2">
                        <Ruler className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Approx. Size</p>
                          <p className="font-medium">{options.approxSize} sqm</p>
                        </div>
                      </div>
                    )}
                    {options.wallHeight !== undefined && (
                      <div className="flex items-center gap-2">
                        <Layers className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Wall Height</p>
                          <p className="font-medium">{options.wallHeight} m</p>
                        </div>
                      </div>
                    )}
                    {options.houseStories && (
                      <div className="flex items-center gap-2">
                        <Home className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Storeys</p>
                          <p className="font-medium">{options.houseStories}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Wall finishes */}
                  {wallFinishes.length > 0 && (
                    <div className="space-y-2">
                      <SectionLabel>Wall Finishes</SectionLabel>
                      <div className="flex flex-wrap gap-1.5">
                        {wallFinishes.map((wf) => (
                          <Badge key={wf} variant="outline" className="text-xs capitalize">
                            {wf}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Exterior trim items (category checkboxes) */}
                  {options.exteriorTrimItems && options.exteriorTrimItems.length > 0 && (
                    <div className="space-y-2">
                      <SectionLabel>Trim Categories</SectionLabel>
                      <div className="flex flex-wrap gap-1.5">
                        {options.exteriorTrimItems.map((t) => (
                          <Badge key={t} variant="secondary" className="text-xs">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Doors table */}
                  {options.exteriorDoors && options.exteriorDoors.length > 0 && (
                    <div className="space-y-2">
                      <SectionLabel>Exterior Doors</SectionLabel>
                      <InlineTable
                        headers={['Style', 'Qty']}
                        rows={options.exteriorDoors.map((d) => [d.style, d.quantity])}
                      />
                    </div>
                  )}

                  {/* Windows table */}
                  {options.exteriorWindows && options.exteriorWindows.length > 0 && (
                    <div className="space-y-2">
                      <SectionLabel>Exterior Windows</SectionLabel>
                      <InlineTable
                        headers={['Type', 'Qty']}
                        rows={options.exteriorWindows.map((w) => [w.type, w.quantity])}
                      />
                    </div>
                  )}

                  {/* Architraves table */}
                  {options.exteriorArchitraves && options.exteriorArchitraves.length > 0 && (
                    <div className="space-y-2">
                      <SectionLabel>Exterior Architraves</SectionLabel>
                      <InlineTable
                        headers={['Style', 'Qty']}
                        rows={options.exteriorArchitraves.map((a) => [a.style, a.quantity])}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Card 4: Complexity Factors */}
            {options.jobDifficulty && options.jobDifficulty.length > 0 && (
              <Card className="border-amber-200/60 bg-amber-50/30 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base font-semibold text-amber-800">
                    <AlertTriangle className="h-4 w-4" />
                    Complexity Factors
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {options.jobDifficulty.map((d) => (
                      <div
                        key={d}
                        className="flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs text-amber-800"
                      >
                        <Info className="h-3 w-3 shrink-0 text-amber-600" />
                        {d}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* ── RIGHT SIDEBAR ─────────────────────────────────────────────── */}
          <div className="space-y-6">

            {/* AI Estimate Result */}
            <Card className="border-primary/20 bg-primary/[0.02] shadow-md">
              <CardHeader className="border-b border-primary/10 bg-primary/10">
                <CardTitle className="flex items-center gap-2 text-lg font-bold text-primary">
                  <Sparkles className="h-5 w-5" />
                  AI Estimate Result
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5 pt-5">
                {est ? (
                  <>
                    {/* Total price range */}
                    <div className="rounded-lg border bg-white p-4 text-center shadow-sm">
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        Estimated Range
                      </p>
                      <p className="text-2xl font-black text-primary">
                        {est.priceRange || est.breakdown?.total?.priceRange || 'Calculating...'}
                      </p>
                    </div>

                    {/* Breakdown: Interior / Exterior / Total */}
                    {est.breakdown && (
                      <div className="space-y-2">
                        <SectionLabel>Price Breakdown</SectionLabel>
                        <div className="divide-y rounded-lg border text-sm overflow-hidden">
                          {est.breakdown.interior && (
                            <div className="flex items-center justify-between px-3 py-2">
                              <span className="text-muted-foreground">Interior</span>
                              <span className="font-medium text-blue-700">
                                {est.breakdown.interior.priceRange}
                              </span>
                            </div>
                          )}
                          {est.breakdown.exterior && (
                            <div className="flex items-center justify-between px-3 py-2">
                              <span className="text-muted-foreground">Exterior</span>
                              <span className="font-medium text-green-700">
                                {est.breakdown.exterior.priceRange}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center justify-between bg-muted/30 px-3 py-2">
                            <span className="font-semibold">Total</span>
                            <span className="font-bold text-primary">
                              {est.breakdown.total.priceRange}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Explanation */}
                    {est.explanation && (
                      <div className="space-y-1">
                        <SectionLabel>Professional Summary</SectionLabel>
                        <p className="text-sm italic leading-relaxed text-muted-foreground">
                          &quot;{est.explanation}&quot;
                        </p>
                      </div>
                    )}

                    {/* Key pricing factors */}
                    {est.details && est.details.length > 0 && (
                      <div className="space-y-2">
                        <SectionLabel>Key Pricing Factors</SectionLabel>
                        <ul className="space-y-2">
                          {est.details.map((detail, i) => (
                            <li key={i} className="flex gap-2 text-xs">
                              <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                              <span>{detail}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    No AI estimate generated for this entry.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Property Photos */}
            {photoUrls && photoUrls.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Camera className="h-4 w-4 text-primary" />
                    Property Photos
                    <span className="ml-auto text-xs font-normal text-muted-foreground">
                      {photoUrls.length} photo{photoUrls.length !== 1 ? 's' : ''}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2">
                    {photoUrls.map((url, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setLightboxIndex(idx)}
                        className="group relative aspect-square overflow-hidden rounded-md border bg-muted transition-all hover:ring-2 hover:ring-primary"
                        aria-label={`View photo ${idx + 1}`}
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
          </div>
        </div>
      </div>

      {/* ── Lightbox ─────────────────────────────────────────────────────── */}
      {lightboxIndex !== null && photoUrls && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setLightboxIndex(null)}
        >
          {/* Close */}
          <button
            type="button"
            aria-label="Close lightbox"
            onClick={() => setLightboxIndex(null)}
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Prev */}
          {lightboxIndex > 0 && (
            <button
              type="button"
              aria-label="Previous photo"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex(lightboxIndex - 1);
              }}
              className="absolute left-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}

          {/* Image */}
          <div onClick={(e) => e.stopPropagation()} className="max-h-[90vh] max-w-[90vw]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoUrls[lightboxIndex]}
              alt={`Property photo ${lightboxIndex + 1}`}
              className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
            />
            <p className="mt-2 text-center text-sm text-white/60">
              {lightboxIndex + 1} / {photoUrls.length}
            </p>
          </div>

          {/* Next */}
          {lightboxIndex < photoUrls.length - 1 && (
            <button
              type="button"
              aria-label="Next photo"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex(lightboxIndex + 1);
              }}
              className="absolute right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          )}
        </div>
      )}
    </>
  );
}
