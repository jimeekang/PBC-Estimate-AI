'use client';

import type React from 'react';
import { useForm, useFieldArray, useWatch, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ArrowUpToLine,
  Baseline,
  Construction,
  DoorOpen,
  Layout,
  Layers,
  Loader2,
  MoveUpRight,
  PaintRoller,
  Paintbrush,
  Palette,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  User,
  WandSparkles,
  Home,
  Droplets,
  Hammer,
  Info,
  Calendar,
  ExternalLink,
  Grid3X3,
  Wrench,
  MoreHorizontal,
  Camera,
  X,
  ImagePlus,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { submitEstimate } from '@/app/estimate/actions';
import { uploadEstimatePhotos } from '@/lib/firebase';
import { useEffect, useState, useRef } from 'react';
import { EstimateResult } from './estimate-result';
import type { EstimatePdfMeta } from './estimate-result';
import type { GeneratePaintingEstimateOutput } from '@/ai/flows/generate-painting-estimate';
import { useToast } from '@/hooks/use-toast';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useAuth } from '@/providers/auth-provider';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { db, ensureAppCheck } from '@/lib/firebase';
import { collection, query, where, getCountFromServer } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { APIProvider, useMapsLibrary } from '@vis.gl/react-google-maps';

const trimItems = [
  { id: 'Doors', label: 'Doors', icon: DoorOpen },
  { id: 'Window Frames', label: 'Window Frames', icon: Layout },
  { id: 'Skirting Boards', label: 'Skirting Boards', icon: Baseline },
] as const;

const paintConditionOptions = [
  { id: 'Excellent', label: 'Excellent - Like new, no visible issues' },
  { id: 'Fair', label: 'Fair - Some wear, minor peeling or fading' },
  { id: 'Poor', label: 'Poor - Peeling, cracking, or significant damage' },
] as const;

const jobDifficultyItems = [
  { id: 'Stairs', label: 'Stairs', icon: MoveUpRight },
  { id: 'High ceilings', label: 'High ceilings', icon: ArrowUpToLine },
  { id: 'Extensive mouldings or trims', label: 'Extensive mouldings or trims', icon: Sparkles },
  { id: 'Difficult access areas', label: 'Difficult access areas', icon: Construction },
] as const;

const interiorRoomList = [
  'Master Bedroom',
  'Bedroom 1',
  'Bedroom 2',
  'Bedroom 3',
  'Bathroom',
  'Living Room',
  'Lounge',
  'Dining',
  'Kitchen',
  'Study / Office',
  'Laundry',
  'Stairwell',
  'Hallway',
  'Foyer',
  'Handrail',
  'Walk-in robe',
  'Etc',
] as const;

const exteriorAreaOptions = [
  { id: 'Wall', label: 'Wall', icon: Home },
  { id: 'Eaves', label: 'Eaves', icon: ArrowUpToLine },
  { id: 'Gutter', label: 'Gutter', icon: Droplets },
  { id: 'Fascia', label: 'Fascia', icon: Sparkles },
  { id: 'Exterior Trim', label: 'Exterior Trim', icon: Hammer },
  { id: 'Deck', label: 'Deck', icon: Layout },
  { id: 'Paving', label: 'Paving', icon: Grid3X3 },
  { id: 'Pipes', label: 'Pipes', icon: Wrench },
  { id: 'Roof', label: 'Roof', icon: Home },
  { id: 'Etc', label: 'Etc', icon: MoreHorizontal },
] as const;

const WALL_FINISH_OPTIONS = [
  { id: 'cladding', label: 'Cladding' },
  { id: 'rendered', label: 'Rendered' },
  { id: 'brick', label: 'Brick' },
] as const;

const EXTERIOR_TRIM_OPTIONS = [
  { id: 'Doors', label: 'Doors', icon: DoorOpen },
  { id: 'Window Frames', label: 'Window Frames', icon: Layout },
  { id: 'Architraves', label: 'Architraves', icon: Baseline },
  { id: 'Front Door', label: 'Front Door', icon: DoorOpen },
] as const;

const WINDOW_TYPE_OPTIONS = ['Normal', 'Awning', 'Double Hung', 'French'] as const;

const APARTMENT_STRUCTURE_OPTIONS = [
  { id: 'Studio' as const,    label: 'Studio',                                   bedroomCount: 0, bathroomCount: 1, hasMaster: false, hasEnsuite: false, avgSqm: 40 },
  { id: '1Bed' as const,      label: '1 Bed Apartment',                           bedroomCount: 0, bathroomCount: 1, hasMaster: true,  hasEnsuite: false, avgSqm: 55 },
  { id: '2Bed2Bath' as const, label: '2 Bed / 2 Bath Apartment (Ensuite inc.)',   bedroomCount: 1, bathroomCount: 2, hasMaster: true,  hasEnsuite: true,  avgSqm: 85 },
  { id: '3Bed2Bath' as const, label: '3 Bed / 2 Bath Apartment (Ensuite inc.)',   bedroomCount: 2, bathroomCount: 2, hasMaster: true,  hasEnsuite: true,  avgSqm: 110 },
] as const;

const propertyTypes = ['Apartment', 'House / Townhouse', 'Office', 'Other'] as const;
const EXTERIOR_RESTRICTED_PROPERTY_TYPES = ['Apartment', 'Office'] as const;

const typeOfWorkItems = [
  { id: 'Interior Painting', label: 'Interior Painting' },
  { id: 'Exterior Painting', label: 'Exterior Painting' },
] as const;

const HANDRAIL_SYSTEM_OPTIONS = [
  'paint_to_paint_oil_2coat',
  'paint_to_paint_water_3coat',
  'varnish_to_paint_oil_3coat_min',
  'varnish_to_paint_water_4coat_min',
  'varnish_to_varnish_stain',
  'varnish_to_varnish_clear',
] as const;

const HANDRAIL_SYSTEM_LABELS: Record<(typeof HANDRAIL_SYSTEM_OPTIONS)[number], string> = {
  paint_to_paint_oil_2coat: 'Paint -> paint, oil 2 coats',
  paint_to_paint_water_3coat: 'Paint -> paint, water 3 coats',
  varnish_to_paint_oil_3coat_min: 'Varnish -> paint, oil min 3 coats',
  varnish_to_paint_water_4coat_min: 'Varnish -> paint, water min 4 coats',
  varnish_to_varnish_stain: 'Varnish -> varnish stain',
  varnish_to_varnish_clear: 'Varnish -> varnish clear',
};

const HANDRAIL_SYSTEM_DESCRIPTIONS: Record<(typeof HANDRAIL_SYSTEM_OPTIONS)[number], string> = {
  paint_to_paint_oil_2coat: 'Recoat existing paint finish in oil enamel.',
  paint_to_paint_water_3coat: 'Recoat existing paint finish in water-based 3-coat system.',
  varnish_to_paint_oil_3coat_min: 'Convert varnish to painted oil finish with prepcoat system.',
  varnish_to_paint_water_4coat_min: 'Convert varnish to painted water finish with full build system.',
  varnish_to_varnish_stain: 'Sand back and re-stain with varnish finish.',
  varnish_to_varnish_clear: 'Refresh existing varnish with clear protective coats.',
};

const InteriorHandrailDetailsSchema = z.object({
  lengthLm: z.number().positive().optional(),
  widthMm: z.number().positive().optional(),
  system: z.enum(HANDRAIL_SYSTEM_OPTIONS).optional(),
});

const InteriorRoomItemSchema = z.object({
  roomName: z.string(),
  otherRoomName: z.string().optional(),
  paintAreas: z.object({
    ceilingPaint: z.boolean(),
    wallPaint: z.boolean(),
    trimPaint: z.boolean(),
    ensuitePaint: z.boolean().optional(),
  }),
  approxRoomSize: z.number().optional(),
  handrailDetails: InteriorHandrailDetailsSchema.optional(),
}).superRefine((room, ctx) => {
  if (room.roomName === 'Handrail') {
    if (!(typeof room.handrailDetails?.lengthLm === 'number' && room.handrailDetails.lengthLm > 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['handrailDetails', 'lengthLm'],
        message: 'Enter the total handrail length in linear metres.',
      });
    }

    if (!(typeof room.handrailDetails?.widthMm === 'number' && room.handrailDetails.widthMm > 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['handrailDetails', 'widthMm'],
        message: 'Enter the handrail width in millimetres.',
      });
    }

    if (!room.handrailDetails?.system) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['handrailDetails', 'system'],
        message: 'Select a handrail coating system.',
      });
    }
    return;
  }

  const paintAreas = room.paintAreas ?? {};
  if (!paintAreas.ceilingPaint && !paintAreas.wallPaint && !paintAreas.trimPaint && !paintAreas.ensuitePaint) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['paintAreas'],
      message: 'Select at least one surface for this room.',
    });
  }
});

const SkirtingCalculatorRoomSchema = z.object({
  label: z.string().optional(),
  length: z.number().positive().optional(),
  width: z.number().positive().optional(),
});

const estimateFormSchema = z
  .object({
    name: z.string().min(1, 'Name is required.'),
    email: z.string().email('Invalid email address.'),
    phone: z.string().min(1, 'Phone number is required.'),
    typeOfWork: z
      .array(z.enum(['Interior Painting', 'Exterior Painting']))
      .min(1, 'Please select at least one type of work.'),
    scopeOfPainting: z.enum(['Entire property', 'Specific areas only']),
    propertyType: z.string().min(1, 'Property type is required.'),
    houseStories: z.enum(['1 storey', '2 storey', '3 storey']).optional(),
    bedroomCount: z.coerce.number().min(0).optional(),
    bathroomCount: z.coerce.number().min(0).optional(),
    roomsToPaint: z.array(z.string()).optional(),
    interiorRooms: z.array(InteriorRoomItemSchema).optional(),
    specificInteriorTrimOnly: z.boolean().optional(),

    // --- Exterior ---
    exteriorAreas: z.array(z.string()).optional(),
    otherExteriorArea: z.string().optional(),

    // wallFinishes: multi-select wall finish types
    wallFinishes: z.array(z.enum(['cladding', 'rendered', 'brick'])).optional(),
    wallHeight: z.coerce.number().positive().optional(),

    // ✅ 추가: Exterior Trim 멀티 옵션
    exteriorTrimItems: z
      .array(z.enum(['Doors', 'Window Frames', 'Architraves', 'Front Door']))
      .optional(),
    exteriorFrontDoor: z.boolean().optional(),

    // Exterior trim style+quantity detail
    exteriorDoors: z
      .array(z.object({ style: z.enum(['Simple', 'Standard', 'Complex']), quantity: z.number().min(0).max(20) }))
      .optional(),
    exteriorWindows: z
      .array(z.object({ type: z.enum(['Normal', 'Awning', 'Double Hung', 'French']), quantity: z.number().min(0).max(30) }))
      .optional(),
    exteriorArchitraves: z
      .array(z.object({ style: z.enum(['Simple', 'Standard', 'Complex']), quantity: z.number().min(0).max(50) }))
      .optional(),

    // Deck-specific fields
    deckArea: z.coerce.number().positive().optional(),
    deckServiceType: z.enum(['stain', 'clear', 'paint-conversion', 'paint-recoat']).optional(),
    deckProductType: z.enum(['oil', 'water']).optional(),
    deckCondition: z.enum(['good', 'weathered', 'damaged']).optional(),

    // Paving-specific fields
    pavingArea: z.coerce.number().positive().optional(),
    pavingCondition: z.enum(['good', 'fair', 'poor']).optional(),

    otherInteriorArea: z.string().optional(),
    apartmentStructure: z.enum(['Studio', '1Bed', '2Bed2Bath', '3Bed2Bath']).optional(),
    approxSize: z.coerce.number().positive().optional(),
    interiorWallHeight: z.coerce.number().positive().optional(),
    location: z.string().optional(),
    timingPurpose: z.enum(['Maintenance or refresh', 'Preparing for sale or rental']),
    paintCondition: z.enum(['Excellent', 'Fair', 'Poor']).optional(),
    jobDifficulty: z
      .array(z.enum(['Stairs', 'High ceilings', 'Extensive mouldings or trims', 'Difficult access areas']))
      .optional(),

    paintAreas: z
      .object({
        ceilingPaint: z.boolean().default(false),
        wallPaint: z.boolean().default(false),
        trimPaint: z.boolean().default(false),
        ensuitePaint: z.boolean().optional(),
      })
      .default({}),

    trimPaintOptions: z
      .object({
        paintType: z.enum(['Oil-based', 'Water-based']),
        trimItems: z.array(z.enum(['Doors', 'Window Frames', 'Skirting Boards'])),
        interiorWindowFrameTypes: z.array(z.enum(['Normal', 'Awning', 'Double Hung', 'French'])).optional(),
      })
      .optional(),
    skirtingPricingMode: z.enum(['linear_metres', 'room_calculator']).optional(),
    skirtingLinearMetres: z.coerce.number().positive().optional(),
    skirtingCalculatorRooms: z.array(SkirtingCalculatorRoomSchema).optional(),

    /** Interior door item-level pricing (Specific areas only) */
    interiorDoorItems: z
      .array(
        z.object({
          scope: z.enum(['Door & Frame', 'Door only', 'Frame only']),
          system: z.enum(['oil_2coat', 'water_3coat_white_finish']),
          quantity: z.number().min(1).max(50),
        })
      )
      .optional(),
    interiorWindowItems: z
      .array(
        z.object({
          type: z.enum(['Normal', 'Awning', 'Double Hung', 'French']),
          scope: z.enum(['Window & Frame', 'Window only', 'Frame only']),
          system: z.enum(['oil_2coat', 'water_3coat_white_finish']),
          quantity: z.number().min(1).max(50),
        })
      )
      .optional(),

    ceilingOptions: z
      .object({
        ceilingType: z.enum(['Flat', 'Decorative']),
      })
      .optional(),
  })
  .refine(
    (data) => {
      const hasExterior = (data.typeOfWork ?? []).includes('Exterior Painting');
      if (!hasExterior) return true;
      return !EXTERIOR_RESTRICTED_PROPERTY_TYPES.includes(
        data.propertyType as (typeof EXTERIOR_RESTRICTED_PROPERTY_TYPES)[number]
      );
    },
    { path: ['typeOfWork'], message: 'Exterior painting is only available for house-style properties.' }
  )
  .refine(
    (data) => {
      const hasInterior = (data.typeOfWork ?? []).includes('Interior Painting');
      const needs = hasInterior && data.scopeOfPainting === 'Entire property' && (data.roomsToPaint ?? []).includes('Etc');
      if (!needs) return true;
      return !!data.otherInteriorArea && data.otherInteriorArea.trim().length > 0;
    },
    { path: ['otherInteriorArea'], message: "Please specify the 'Etc' interior area." }
  )
  .refine(
    (data) => {
      const hasExterior = (data.typeOfWork ?? []).includes('Exterior Painting');
      const needs = hasExterior && (data.exteriorAreas ?? []).includes('Etc');
      if (!needs) return true;
      return !!data.otherExteriorArea && data.otherExteriorArea.trim().length > 0;
    },
    { path: ['otherExteriorArea'], message: "Please specify the 'Etc' exterior area." }
  )
  .refine(
    (data) => {
      const hasExterior = (data.typeOfWork ?? []).includes('Exterior Painting');
      if (!hasExterior) return true;
      return (data.exteriorAreas ?? []).length > 0;
    },
    { path: ['exteriorAreas'], message: 'Please select at least one exterior area.' }
  )
  .refine(
    (data) => {
      const hasInterior = (data.typeOfWork ?? []).includes('Interior Painting');
      if (!hasInterior || data.scopeOfPainting !== 'Entire property') return true;
      return !!(
        data.paintAreas?.ceilingPaint ||
        data.paintAreas?.wallPaint ||
        data.paintAreas?.trimPaint ||
        data.paintAreas?.ensuitePaint
      );
    },
    { path: ['paintAreas'], message: 'Please select at least one interior surface.' }
  )
  .refine(
    (data) => {
      const hasInterior = (data.typeOfWork ?? []).includes('Interior Painting');
      const needsApartmentSizing =
        hasInterior && data.scopeOfPainting === 'Entire property' && data.propertyType === 'Apartment';
      if (!needsApartmentSizing) return true;
      return !!data.apartmentStructure || typeof data.approxSize === 'number';
    },
    { path: ['apartmentStructure'], message: 'Select an apartment structure or enter an approximate size.' }
  )
  .refine(
    (data) => {
      const hasInterior = (data.typeOfWork ?? []).includes('Interior Painting');
      const needsWholePropertySizing =
        hasInterior && data.scopeOfPainting === 'Entire property' && data.propertyType !== 'Apartment';
      if (!needsWholePropertySizing) return true;
      const hasCounts =
        typeof data.bedroomCount === 'number' && typeof data.bathroomCount === 'number';
      return hasCounts || typeof data.approxSize === 'number';
    },
    {
      path: ['bedroomCount'],
      message: 'Enter bedroom and bathroom counts or provide an approximate size for a whole-property estimate.',
    }
  )
  .refine(
    (data) => {
      const selectedMeasuredRooms =
        data.scopeOfPainting === 'Specific areas only'
          ? (data.interiorRooms ?? []).filter((room) => room.roomName !== 'Handrail')
          : [];
      if (!selectedMeasuredRooms.length) return true;
      return typeof data.interiorWallHeight === 'number';
    },
    { path: ['interiorWallHeight'], message: 'Enter the interior wall height for specific-area pricing.' }
  )
  .refine(
    (data) => {
      const selectedMeasuredRooms =
        data.scopeOfPainting === 'Specific areas only'
          ? (data.interiorRooms ?? []).filter((room) => room.roomName !== 'Handrail')
          : [];
      if (!selectedMeasuredRooms.length) return true;
      return selectedMeasuredRooms.every((room) => typeof room.approxRoomSize === 'number' && room.approxRoomSize > 0);
    },
    { path: ['interiorRooms'], message: 'Enter an approximate room size for each selected room.' }
  )
  // ✅ Wall 선택 시 wallFinishes 최소 1개
  .refine(
    (data) => {
      const hasExterior = (data.typeOfWork ?? []).includes('Exterior Painting');
      const hasWall = hasExterior && (data.exteriorAreas ?? []).includes('Wall');
      if (!hasWall) return true;
      return (data.wallFinishes ?? []).length > 0;
    },
    { path: ['wallFinishes'], message: 'Please select at least one wall finish.' }
  )
  // ✅ Exterior Trim 선택 시 exteriorTrimItems 최소 1개
  .refine(
    (data) => {
      const hasExterior = (data.typeOfWork ?? []).includes('Exterior Painting');
      const hasTrim = hasExterior && (data.exteriorAreas ?? []).includes('Exterior Trim');
      if (!hasTrim) return true;
      return (data.exteriorTrimItems ?? []).length > 0;
    },
    { path: ['exteriorTrimItems'], message: 'Please select at least one exterior trim item.' }
  )
  // houseStories required when Exterior Painting is selected
  .refine(
    (data) => {
      const hasExterior = (data.typeOfWork ?? []).includes('Exterior Painting');
      if (!hasExterior) return true;
      return !!data.houseStories;
    },
    { path: ['houseStories'], message: 'Please select the number of stories for exterior painting.' }
  )
  .refine(
    (data) => {
      const trimOnly = (data.typeOfWork ?? []).includes('Interior Painting') &&
        data.scopeOfPainting === 'Specific areas only' &&
        !!data.specificInteriorTrimOnly;
      if (!trimOnly) return true;
      return (data.trimPaintOptions?.trimItems ?? []).length > 0;
    },
    { path: ['trimPaintOptions', 'trimItems'], message: 'Please select at least one trim item.' }
  )
  .refine(
    (data) => {
      const needsSkirtingRoom =
        (data.typeOfWork ?? []).includes('Interior Painting') &&
        data.scopeOfPainting === 'Specific areas only' &&
        !data.specificInteriorTrimOnly &&
        (data.trimPaintOptions?.trimItems ?? []).includes('Skirting Boards');
      if (!needsSkirtingRoom) return true;
      return (data.interiorRooms ?? []).some((room) => room.paintAreas?.trimPaint);
    },
    { path: ['interiorRooms'], message: 'Select at least one trim room when including skirting boards.' }
  )
  .refine(
    (data) => {
      const needsTrimOnlySkirting =
        (data.typeOfWork ?? []).includes('Interior Painting') &&
        data.scopeOfPainting === 'Specific areas only' &&
        !!data.specificInteriorTrimOnly &&
        (data.trimPaintOptions?.trimItems ?? []).includes('Skirting Boards');
      if (!needsTrimOnlySkirting) return true;

      if ((data.skirtingPricingMode ?? 'linear_metres') === 'linear_metres') {
        return typeof data.skirtingLinearMetres === 'number' && data.skirtingLinearMetres > 0;
      }

      return (data.skirtingCalculatorRooms ?? []).some(
        (room) => typeof room.length === 'number' && room.length > 0 && typeof room.width === 'number' && room.width > 0
      );
    },
    { path: ['skirtingLinearMetres'], message: 'Enter skirting length or add room dimensions for skirting-only pricing.' }
  )
  .refine(
    (data) => {
      const needsDoorItems = (data.typeOfWork ?? []).includes('Interior Painting') &&
        data.scopeOfPainting === 'Specific areas only' &&
        (data.trimPaintOptions?.trimItems ?? []).includes('Doors');
      if (!needsDoorItems) return true;
      return (data.interiorDoorItems ?? []).length > 0;
    },
    { path: ['interiorDoorItems'], message: 'Please add at least one door quantity.' }
  )
  .refine(
    (data) => {
      const needsWindowItems = (data.typeOfWork ?? []).includes('Interior Painting') &&
        data.scopeOfPainting === 'Specific areas only' &&
        (data.trimPaintOptions?.trimItems ?? []).includes('Window Frames');
      if (!needsWindowItems) return true;
      return (data.interiorWindowItems ?? []).length > 0;
    },
    { path: ['interiorWindowItems'], message: 'Please add at least one window quantity.' }
  );

type EstimateFormValues = z.infer<typeof estimateFormSchema>;

const BOOKING_URL = 'https://clienthub.getjobber.com/booking/3a242065-0473-4039-ac49-e0a471328f15/';

function AutocompleteInput({ field }: { field: any }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const places = useMapsLibrary('places');

  useEffect(() => {
    if (!places || !inputRef.current) return;

    try {
      const autocompleteInstance = new places.Autocomplete(inputRef.current, {
        componentRestrictions: { country: 'au' },
        fields: ['formatted_address'],
      });

      autocompleteInstance.addListener('place_changed', () => {
        const place = autocompleteInstance.getPlace();
        if (place && place.formatted_address) {
          field.onChange(place.formatted_address);
        }
      });
    } catch (error) {
      console.warn('Google Places Autocomplete failed to initialize:', error);
    }
  }, [places, field]);

  return <Input {...field} ref={inputRef} placeholder="e.g. 15 Beach Road, Manly NSW" />;
}

// ── ExteriorTrimDetail ──────────────────────────────────────────────────────
// Generic style+quantity picker for Doors / Windows / Architraves.
// styleKey distinguishes 'style' (Doors, Architraves) from 'type' (Windows).
type DoorStyle = 'Simple' | 'Standard' | 'Complex';
type WindowType = 'Normal' | 'Awning' | 'Double Hung' | 'French';
type ArchStyle = 'Simple' | 'Standard' | 'Complex';

interface ExteriorTrimDetailProps {
  title: string;
  icon: React.ReactNode;
  styles: readonly (DoorStyle | WindowType | ArchStyle)[];
  max: number;
  fieldName: 'exteriorDoors' | 'exteriorWindows' | 'exteriorArchitraves';
  styleKey: 'style' | 'type';
  form: ReturnType<typeof useForm<EstimateFormValues>>;
}

function ExteriorTrimDetail({ title, icon, styles, max, fieldName, styleKey, form }: ExteriorTrimDetailProps) {
  const entries = (form.watch(fieldName) as Array<Record<string, any>>) ?? [];

  const getQty = (s: string): number => {
    const found = entries.find((e) => e[styleKey] === s);
    return found ? (found.quantity as number) : 0;
  };

  const setQty = (s: string, qty: number) => {
    const current: Array<Record<string, any>> = (form.getValues(fieldName) as Array<Record<string, any>>) ?? [];
    const filtered = current.filter((e) => e[styleKey] !== s);
    const next = qty > 0 ? [...filtered, { [styleKey]: s, quantity: qty }] : filtered;
    (form.setValue as any)(fieldName, next);
  };

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/[0.03] p-3 space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
        {icon}
        {title}
      </div>
      <div className="grid grid-cols-1 gap-1.5">
        {styles.map((s) => {
          const qty = getQty(s);
          return (
            <div
              key={s}
              className={cn(
                'flex items-center justify-between rounded-md border px-3 py-2 text-xs transition-colors',
                qty > 0 ? 'border-primary bg-primary/10' : 'bg-background'
              )}
            >
              <span className="font-medium">{s}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label={`Decrease ${s}`}
                  onClick={() => setQty(s, Math.max(0, qty - 1))}
                  className="flex h-6 w-6 items-center justify-center rounded border bg-background text-sm font-bold hover:bg-accent/60 disabled:opacity-40 transition-colors"
                  disabled={qty === 0}
                >
                  -
                </button>
                <span className="w-5 text-center tabular-nums">{qty}</span>
                <button
                  type="button"
                  aria-label={`Increase ${s}`}
                  onClick={() => setQty(s, Math.min(max, qty + 1))}
                  className="flex h-6 w-6 items-center justify-center rounded border bg-background text-sm font-bold hover:bg-accent/60 disabled:opacity-40 transition-colors"
                  disabled={qty >= max}
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
// ── InteriorDoorDetail ───────────────────────────────────────────────────────
// Fixed-price item picker for interior doors (Specific areas only).
// Scope × System matrix — each cell has a +/- quantity counter.

type InteriorDoorScope = 'Door & Frame' | 'Door only' | 'Frame only';
type InteriorDoorSystem = 'oil_2coat' | 'water_3coat_white_finish';
type InteriorWindowScope = 'Window & Frame' | 'Window only' | 'Frame only';
type TrimPaintType = 'Oil-based' | 'Water-based';

const INTERIOR_DOOR_PRICES: Record<InteriorDoorSystem, Record<InteriorDoorScope, number>> = {
  oil_2coat: { 'Door & Frame': 250, 'Door only': 180, 'Frame only': 70 },
  water_3coat_white_finish: { 'Door & Frame': 325, 'Door only': 230, 'Frame only': 95 },
};

const INTERIOR_WINDOW_ITEM_PRICES: Record<
  InteriorDoorSystem,
  Record<WindowType, Record<InteriorWindowScope, number>>
> = {
  oil_2coat: {
    Normal: { 'Window & Frame': 240, 'Window only': 180, 'Frame only': 140 },
    Awning: { 'Window & Frame': 280, 'Window only': 210, 'Frame only': 165 },
    'Double Hung': { 'Window & Frame': 350, 'Window only': 265, 'Frame only': 210 },
    French: { 'Window & Frame': 470, 'Window only': 360, 'Frame only': 290 },
  },
  water_3coat_white_finish: {
    Normal: { 'Window & Frame': 315, 'Window only': 230, 'Frame only': 165 },
    Awning: { 'Window & Frame': 355, 'Window only': 260, 'Frame only': 190 },
    'Double Hung': { 'Window & Frame': 425, 'Window only': 315, 'Frame only': 235 },
    French: { 'Window & Frame': 545, 'Window only': 410, 'Frame only': 315 },
  },
};

const DOOR_SYSTEM_LABELS: Record<InteriorDoorSystem, string> = {
  oil_2coat: '2 coats (oil base)',
  water_3coat_white_finish: '3 coats (water base, white finish)',
};

const DOOR_SCOPES: InteriorDoorScope[] = ['Door & Frame', 'Door only', 'Frame only'];
const DOOR_SYSTEMS: InteriorDoorSystem[] = ['oil_2coat', 'water_3coat_white_finish'];
const WINDOW_SCOPES: InteriorWindowScope[] = ['Window & Frame', 'Window only', 'Frame only'];

function getSystemFromTrimPaintType(paintType: TrimPaintType | undefined): InteriorDoorSystem {
  return paintType === 'Water-based' ? 'water_3coat_white_finish' : 'oil_2coat';
}

function HandrailSystemField({
  form,
  name,
  layout = 'grid',
}: {
  form: ReturnType<typeof useForm<EstimateFormValues>>;
  name: `interiorRooms.${number}.handrailDetails.system`;
  layout?: 'grid' | 'row-list';
}) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem className="space-y-2 sm:col-span-3">
          <FormLabel className="text-xs">Coating system</FormLabel>
          <FormControl>
            <RadioGroup
              value={field.value ?? ''}
              onValueChange={field.onChange}
              className={layout === 'row-list' ? 'space-y-2' : 'grid gap-2 sm:grid-cols-2'}
            >
              {HANDRAIL_SYSTEM_OPTIONS.map((option) => {
                const selected = field.value === option;
                return (
                  <FormItem key={option}>
                    <FormLabel
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors',
                        layout === 'row-list' ? 'w-full flex-row' : 'h-full',
                        selected ? 'border-primary bg-primary/10' : 'bg-background hover:bg-accent/40'
                      )}
                    >
                      <FormControl>
                        <RadioGroupItem value={option} />
                      </FormControl>
                      <div className="space-y-1">
                        <div className="text-xs font-semibold leading-snug">{HANDRAIL_SYSTEM_LABELS[option]}</div>
                        <div className="text-[11px] leading-snug text-muted-foreground">
                          {HANDRAIL_SYSTEM_DESCRIPTIONS[option]}
                        </div>
                      </div>
                    </FormLabel>
                  </FormItem>
                );
              })}
            </RadioGroup>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function InteriorDoorDetail({ form }: { form: ReturnType<typeof useForm<EstimateFormValues>> }) {
  const items = form.watch('interiorDoorItems') ?? [];
  const paintType = (form.watch('trimPaintOptions.paintType') ?? 'Oil-based') as TrimPaintType;
  const activeSystem = getSystemFromTrimPaintType(paintType);

  const getQty = (scope: InteriorDoorScope) =>
    items.find((i) => i.scope === scope && i.system === activeSystem)?.quantity ?? 0;

  const setQty = (scope: InteriorDoorScope, qty: number) => {
    const current = form.getValues('interiorDoorItems') ?? [];
    const filtered = current.filter((i) => !(i.scope === scope && i.system === activeSystem));
    form.setValue(
      'interiorDoorItems',
      qty > 0 ? [...filtered, { scope, system: activeSystem, quantity: qty }] : filtered
    );
  };

  const subtotal = items.reduce(
    (sum, item) =>
      item.system === activeSystem ? sum + (INTERIOR_DOOR_PRICES[item.system]?.[item.scope] ?? 0) * item.quantity : sum,
    0
  );

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/[0.03] p-3 space-y-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
        <DoorOpen className="h-3.5 w-3.5" />
        Interior Doors — Fixed Item Pricing
      </div>
      <p className="text-xs text-muted-foreground">
        Showing {DOOR_SYSTEM_LABELS[activeSystem]} pricing from the selected trim paint type.
      </p>
      <div className="space-y-3">
        {DOOR_SCOPES.map((scope) => {
          const qty = getQty(scope);
          const unitPrice = INTERIOR_DOOR_PRICES[activeSystem][scope];
          return (
            <div key={scope} className="space-y-1">
              <div className="text-xs font-semibold text-foreground">{scope}</div>
              <div
                className={cn(
                  'flex items-center justify-between rounded-md border px-3 py-2 text-xs transition-colors',
                  qty > 0 ? 'border-primary bg-primary/10' : 'bg-background'
                )}
              >
                <div className="min-w-0">
                  <span className="text-muted-foreground">{DOOR_SYSTEM_LABELS[activeSystem]}</span>
                  <span className="ml-2 font-semibold text-primary">AUD {unitPrice}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    aria-label={`Decrease ${scope}`}
                    onClick={() => setQty(scope, Math.max(0, qty - 1))}
                    disabled={qty === 0}
                    className="flex h-6 w-6 items-center justify-center rounded border bg-background text-sm font-bold hover:bg-accent/60 disabled:opacity-40 transition-colors"
                  >
                    -
                  </button>
                  <span className="w-5 text-center tabular-nums">{qty}</span>
                  <button
                    type="button"
                    aria-label={`Increase ${scope}`}
                    onClick={() => setQty(scope, Math.min(50, qty + 1))}
                    disabled={qty >= 50}
                    className="flex h-6 w-6 items-center justify-center rounded border bg-background text-sm font-bold hover:bg-accent/60 disabled:opacity-40 transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {subtotal > 0 && (
        <div className="border-t border-primary/20 pt-2 text-xs flex justify-between font-semibold text-primary">
          <span>Estimated Subtotal</span>
          <span>AUD {subtotal.toLocaleString('en-AU')} <span className="font-normal text-muted-foreground">(+GST)</span></span>
        </div>
      )}
    </div>
  );
}
// ────────────────────────────────────────────────────────────────────────────

function InteriorWindowDetail({ form }: { form: ReturnType<typeof useForm<EstimateFormValues>> }) {
  const items = form.watch('interiorWindowItems') ?? [];
  const paintType = (form.watch('trimPaintOptions.paintType') ?? 'Oil-based') as TrimPaintType;
  const activeSystem = getSystemFromTrimPaintType(paintType);

  const getQty = (type: WindowType, scope: InteriorWindowScope) =>
    items.find((i) => i.type === type && i.scope === scope && i.system === activeSystem)?.quantity ?? 0;

  const setQty = (type: WindowType, scope: InteriorWindowScope, qty: number) => {
    const current = form.getValues('interiorWindowItems') ?? [];
    const filtered = current.filter((i) => !(i.type === type && i.scope === scope && i.system === activeSystem));
    form.setValue(
      'interiorWindowItems',
      qty > 0 ? [...filtered, { type, scope, system: activeSystem, quantity: qty }] : filtered
    );
  };

  const subtotal = items.reduce(
    (sum, item) =>
      item.system === activeSystem
        ? sum + (INTERIOR_WINDOW_ITEM_PRICES[item.system][item.type]?.[item.scope] ?? 0) * item.quantity
        : sum,
    0
  );

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/[0.03] p-3 space-y-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
        <Layout className="h-3.5 w-3.5" />
        Interior Windows - Fixed Item Pricing
      </div>
      <p className="text-xs text-muted-foreground">
        Showing {DOOR_SYSTEM_LABELS[activeSystem]} pricing from the selected trim paint type.
      </p>
      <div className="space-y-3">
        {WINDOW_TYPE_OPTIONS.map((type) => (
          <div key={type} className="space-y-1">
            <div className="text-xs font-semibold text-foreground">{type}</div>
            {WINDOW_SCOPES.map((scope) => {
              const qty = getQty(type, scope);
              const unitPrice = INTERIOR_WINDOW_ITEM_PRICES[activeSystem][type][scope];
              return (
                <div key={scope} className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">{scope}</div>
                  <div
                    className={cn(
                      'flex items-center justify-between rounded-md border px-3 py-2 text-xs transition-colors',
                      qty > 0 ? 'border-primary bg-primary/10' : 'bg-background'
                    )}
                  >
                    <div className="min-w-0">
                      <span className="text-muted-foreground">{DOOR_SYSTEM_LABELS[activeSystem]}</span>
                      <span className="ml-2 font-semibold text-primary">AUD {unitPrice}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        aria-label={`Decrease ${type} ${scope}`}
                        onClick={() => setQty(type, scope, Math.max(0, qty - 1))}
                        disabled={qty === 0}
                        className="flex h-6 w-6 items-center justify-center rounded border bg-background text-sm font-bold hover:bg-accent/60 disabled:opacity-40 transition-colors"
                      >
                        -
                      </button>
                      <span className="w-5 text-center tabular-nums">{qty}</span>
                      <button
                        type="button"
                        aria-label={`Increase ${type} ${scope}`}
                        onClick={() => setQty(type, scope, Math.min(50, qty + 1))}
                        disabled={qty >= 50}
                        className="flex h-6 w-6 items-center justify-center rounded border bg-background text-sm font-bold hover:bg-accent/60 disabled:opacity-40 transition-colors"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {subtotal > 0 && (
        <div className="border-t border-primary/20 pt-2 text-xs flex justify-between font-semibold text-primary">
          <span>Estimated Subtotal</span>
          <span>
            AUD {subtotal.toLocaleString('en-AU')} <span className="font-normal text-muted-foreground">(+GST)</span>
          </span>
        </div>
      )}
    </div>
  );
}

export function EstimateForm() {
  const { user, isAdmin } = useAuth();
  const [state, setState] = useState<{
    data?: GeneratePaintingEstimateOutput;
    error?: string;
    pdfMeta?: EstimatePdfMeta;
  }>({});
  const [isPending, setIsPending] = useState(false);
  const [estimateCount, setEstimateCount] = useState(0);
  const [isCountLoading, setIsCountLoading] = useState(true);
  const [isLimitReached, setIsLimitReached] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const form = useForm<EstimateFormValues>({
    resolver: zodResolver(estimateFormSchema),
    defaultValues: {
      paintAreas: {
        ceilingPaint: true,
        wallPaint: true,
        trimPaint: true,
        ensuitePaint: false,
      },
      trimPaintOptions: {
        paintType: 'Oil-based',
        trimItems: [],
        interiorWindowFrameTypes: [],
      },
      skirtingPricingMode: 'linear_metres',
      skirtingLinearMetres: undefined,
      skirtingCalculatorRooms: [],
      ceilingOptions: {
        ceilingType: 'Flat',
      },
      name: '',
      email: user?.email || '',
      phone: '',
      typeOfWork: [],
      scopeOfPainting: 'Entire property',
      propertyType: '',
      houseStories: '1 storey',
      bedroomCount: undefined,
      bathroomCount: undefined,
      roomsToPaint: [],
      interiorRooms: [],
      specificInteriorTrimOnly: false,
      exteriorAreas: [],
      otherExteriorArea: '',
      otherInteriorArea: '',
      apartmentStructure: undefined,

      wallFinishes: [],
      wallHeight: undefined,
      interiorWallHeight: undefined,
      exteriorTrimItems: [],
      exteriorFrontDoor: false,
      exteriorDoors: [],
      exteriorWindows: [],
      exteriorArchitraves: [],

      location: '',
      timingPurpose: 'Maintenance or refresh',
      paintCondition: undefined,
      jobDifficulty: [],
      interiorDoorItems: [],
      interiorWindowItems: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'interiorRooms',
  });
  const {
    fields: skirtingCalculatorFields,
    append: appendSkirtingCalculatorRoom,
    remove: removeSkirtingCalculatorRoom,
  } = useFieldArray({
    control: form.control,
    name: 'skirtingCalculatorRooms',
  });

  const fetchEstimateCount = async (uid: string) => {
    try {
      await ensureAppCheck();
      const estimatesRef = collection(db, 'estimates');
      const q = query(estimatesRef, where('userId', '==', uid));
      const snapshot = await getCountFromServer(q);
      const count = snapshot.data().count;
      setEstimateCount(count);
      if (!isAdmin) {
        setIsLimitReached(count >= 2);
      }
      return count;
    } catch (err) {
      console.error('Error fetching count:', err);
      return 0;
    }
  };

  useEffect(() => {
    if (!user) {
      setIsCountLoading(false);
      return;
    }

    if (isAdmin) {
      setEstimateCount(0);
      setIsLimitReached(false);
      setIsCountLoading(false);
      return;
    }

    setIsCountLoading(true);
    fetchEstimateCount(user.uid).finally(() => setIsCountLoading(false));
  }, [user, isAdmin]);

  const watchTypeOfWork = useWatch({ control: form.control, name: 'typeOfWork' }) || [];
  const isInterior = watchTypeOfWork.includes('Interior Painting');
  const isExterior = watchTypeOfWork.includes('Exterior Painting');
  const watchScope = useWatch({ control: form.control, name: 'scopeOfPainting' });
  const watchInteriorRooms = useWatch({ control: form.control, name: 'interiorRooms' });
  const watchSpecificTrimOnly = useWatch({ control: form.control, name: 'specificInteriorTrimOnly' }) ?? false;
  const watchRoomsToPaint = useWatch({ control: form.control, name: 'roomsToPaint' }) || [];
  const watchGlobalTrimPaint = useWatch({ control: form.control, name: 'paintAreas.trimPaint' });
  const watchGlobalCeilingPaint = useWatch({ control: form.control, name: 'paintAreas.ceilingPaint' });
  const watchPropertyType = useWatch({ control: form.control, name: 'propertyType' });
  const watchExteriorAreas = useWatch({ control: form.control, name: 'exteriorAreas' }) || [];
  const watchExteriorTrimItems = useWatch({ control: form.control, name: 'exteriorTrimItems' }) || [];
  const watchDeckServiceType = useWatch({ control: form.control, name: 'deckServiceType' });
  const watchApartmentStructure = useWatch({ control: form.control, name: 'apartmentStructure' });
  const watchTrimPaintType = (useWatch({ control: form.control, name: 'trimPaintOptions.paintType' }) ??
    'Oil-based') as TrimPaintType;
  const watchSkirtingPricingMode = useWatch({ control: form.control, name: 'skirtingPricingMode' }) ?? 'linear_metres';
  const isApartmentType = watchPropertyType === 'Apartment';
  const isExteriorRestrictedProperty =
    watchPropertyType === 'Apartment' || watchPropertyType === 'Office';
  const visibleTypeOfWorkItems = isExteriorRestrictedProperty
    ? typeOfWorkItems.filter((item) => item.id !== 'Exterior Painting')
    : typeOfWorkItems;
  const selectedApartmentStructure = APARTMENT_STRUCTURE_OPTIONS.find(
    (option) => option.id === watchApartmentStructure
  );
  const handrailRoomIndex = fields.findIndex((f) => f.roomName === 'Handrail');
  const isWholePropertyHandrailSelected = watchScope === 'Entire property' && handrailRoomIndex > -1;

  const hasAnyRoomTrim = watchInteriorRooms?.some((r) => r.paintAreas?.trimPaint);
  const hasAnyRoomCeiling = watchInteriorRooms?.some((r) => r.paintAreas?.ceilingPaint);

  const showTrimOptions =
  isInterior &&
  ((watchScope === 'Entire property' && watchGlobalTrimPaint) ||
    (watchScope === 'Specific areas only' && (watchSpecificTrimOnly || hasAnyRoomTrim)));

const showCeilingOptions =
  isInterior &&
  ((watchScope === 'Entire property' && watchGlobalCeilingPaint) ||
    (watchScope === 'Specific areas only' && hasAnyRoomCeiling));

  useEffect(() => {
    if (!isInterior || !isApartmentType || watchScope !== 'Entire property' || !watchApartmentStructure) return;
    const option = APARTMENT_STRUCTURE_OPTIONS.find((o) => o.id === watchApartmentStructure);
    if (!option) return;
    const currentApproxSize = form.getValues('approxSize');

    form.setValue('bedroomCount', option.bedroomCount);
    form.setValue('bathroomCount', option.bathroomCount);
    if (currentApproxSize == null || currentApproxSize <= 0 || Number.isNaN(currentApproxSize)) {
      form.setValue('approxSize', option.avgSqm);
    }
    form.setValue('roomsToPaint', option.hasMaster ? ['Master Bedroom'] : []);
    form.setValue('paintAreas.ensuitePaint', option.hasEnsuite);
  }, [watchApartmentStructure, isInterior, isApartmentType, watchScope, form]);

  useEffect(() => {
    if (watchPropertyType === 'Apartment') return;
    if (!form.getValues('apartmentStructure')) return;

    form.setValue('apartmentStructure', undefined, { shouldDirty: true });
    form.setValue('bedroomCount', undefined, { shouldDirty: true });
    form.setValue('bathroomCount', undefined, { shouldDirty: true });
    form.setValue('roomsToPaint', [], { shouldDirty: true });
    form.setValue('paintAreas.ensuitePaint', false, { shouldDirty: true });
  }, [watchPropertyType, form]);

  useEffect(() => {
    if (!isExteriorRestrictedProperty) return;
    if (!form.getValues('typeOfWork')?.includes('Exterior Painting')) return;

    form.setValue(
      'typeOfWork',
      (form.getValues('typeOfWork') ?? []).filter((value) => value !== 'Exterior Painting'),
      { shouldDirty: true, shouldValidate: true }
    );
    form.setValue('exteriorAreas', [], { shouldDirty: true });
    form.setValue('otherExteriorArea', '', { shouldDirty: true });
    form.setValue('wallFinishes', [], { shouldDirty: true });
    form.setValue('wallHeight', undefined, { shouldDirty: true });
    form.setValue('exteriorTrimItems', [], { shouldDirty: true });
    form.setValue('exteriorFrontDoor', false, { shouldDirty: true });
    form.setValue('exteriorDoors', [], { shouldDirty: true });
    form.setValue('exteriorWindows', [], { shouldDirty: true });
    form.setValue('exteriorArchitraves', [], { shouldDirty: true });
    form.setValue('houseStories', undefined, { shouldDirty: true });
  }, [isExteriorRestrictedProperty, watchPropertyType, form]);

  useEffect(() => {
    const activeSystem = getSystemFromTrimPaintType(watchTrimPaintType);
    const currentDoorItems = form.getValues('interiorDoorItems') ?? [];
    if (currentDoorItems.some((item) => item.system !== activeSystem)) {
      form.setValue(
        'interiorDoorItems',
        currentDoorItems.map((item) => ({ ...item, system: activeSystem })),
        { shouldDirty: true }
      );
    }

    const currentWindowItems = form.getValues('interiorWindowItems') ?? [];
    if (currentWindowItems.some((item) => item.system !== activeSystem)) {
      form.setValue(
        'interiorWindowItems',
        currentWindowItems.map((item) => ({ ...item, system: activeSystem })),
        { shouldDirty: true }
      );
    }
  }, [watchTrimPaintType, form]);

  useEffect(() => {
    if (watchScope !== 'Specific areas only') return;
    const legacyWindowTypes = form.getValues('trimPaintOptions.interiorWindowFrameTypes') ?? [];
    if (legacyWindowTypes.length > 0) {
      form.setValue('trimPaintOptions.interiorWindowFrameTypes', [], { shouldDirty: true });
    }
  }, [watchScope, form]);

  const handleToggleRoom = (roomName: string) => {
    const roomIndex = fields.findIndex((f) => f.roomName === roomName);
    if (roomIndex > -1) {
      remove(roomIndex);
    } else {
      append({
        roomName,
        paintAreas: {
          ceilingPaint: false,
          wallPaint: false,
          trimPaint: false,
          ensuitePaint: false,
        },
        handrailDetails:
          roomName === 'Handrail'
            ? {
                lengthLm: undefined,
                widthMm: undefined,
                system: 'paint_to_paint_oil_2coat',
              }
            : undefined,
      });
    }
  };

  const preventInvalidChars = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (['e', 'E', '+', '-'].includes(e.key)) {
      e.preventDefault();
    }
  };

  const preventInvalidCharsNoDecimal = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (['e', 'E', '+', '-', '.'].includes(e.key)) {
      e.preventDefault();
    }
  };

  const preventInvalidPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const paste = e.clipboardData.getData('text');
    if (!/^\d*\.?\d*$/.test(paste)) {
      e.preventDefault();
    }
  };

  const preventInvalidPasteNoDecimal = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const paste = e.clipboardData.getData('text');
    if (!/^\d+$/.test(paste)) {
      e.preventDefault();
    }
  };

  const ensureTrimEnabledForSpecificRoom = () => {
    if (form.getValues('specificInteriorTrimOnly')) return true;

    const rooms = form.getValues('interiorRooms') ?? [];
    const eligibleRoomIndex = rooms.findIndex((room) => room.roomName !== 'Handrail');

    if (eligibleRoomIndex === -1) return false;
    if (rooms.some((room) => room.roomName !== 'Handrail' && room.paintAreas?.trimPaint)) return true;

    form.setValue(`interiorRooms.${eligibleRoomIndex}.paintAreas.trimPaint`, true, {
      shouldDirty: true,
      shouldValidate: true,
    });
    return true;
  };

  const getRoomSurfaceError = (roomIndex: number) => {
    const error = form.formState.errors.interiorRooms?.[roomIndex]?.paintAreas as
      | { message?: string }
      | undefined;
    return error?.message;
  };

  const getArrayFieldError = (fieldName: 'interiorDoorItems' | 'interiorWindowItems') => {
    const error = form.formState.errors[fieldName] as { message?: string } | undefined;
    return error?.message;
  };

  async function onSubmit(values: EstimateFormValues) {
    if (!user) return;

    const idToken = await user.getIdToken();

    if (!isAdmin && estimateCount >= 2) {
      setIsLimitReached(true);
      toast({
        variant: 'destructive',
        title: 'Limit Reached',
        description: 'You have already used your 2 free estimates.',
      });
      return;
    }

    setState({});
    setIsPending(true);
    let photoUrls: string[] = [];
    if (photos.length > 0) {
      try {
        photoUrls = await uploadEstimatePhotos(idToken, photos);
      } catch (err) {
        console.error('Photo upload failed:', err);
        setState({ error: 'Could not upload photos. Please try again.' });
        toast({ variant: 'destructive', title: 'Photo Upload Failed', description: 'Could not upload photos. Please try again.' });
        setIsPending(false);
        return;
      }
    }
    const result = await submitEstimate({ formData: values, idToken, photoUrls });

    if (result.error) {
      if (result.limitReached) {
        setIsLimitReached(true);
      }
      setState({ error: result.error });
      toast({ variant: 'destructive', title: 'Error', description: result.error });
    } else if (result.data) {
      if (!isAdmin) {
        const nextCount =
          typeof result.estimateCount === 'number' ? result.estimateCount : await fetchEstimateCount(user.uid);
        setEstimateCount(nextCount);
        setIsLimitReached(result.limitReached ?? nextCount >= 2);
      }
      const generatedAt = new Date().toISOString();
      const referenceId = `PBC-${generatedAt.slice(2, 10).replace(/-/g, '')}-${values.name
        .replace(/[^a-zA-Z0-9]/g, '')
        .slice(0, 4)
        .toUpperCase() || 'USER'}`;

      setState({
        data: result.data,
        error: result.error,
        pdfMeta: {
          generatedAt,
          recipientName: values.name,
          recipientEmail: values.email,
          location: values.location,
          typeOfWork: values.typeOfWork,
          referenceId,
        },
      });
      toast({ title: 'Success', description: 'Estimate generated!' });
    }
    setIsPending(false);
  }

  function onInvalid(errors: FieldErrors<EstimateFormValues>) {
    const roomErrors = Array.isArray(errors.interiorRooms) ? errors.interiorRooms : [];
    const hasRoomSurfaceError = roomErrors.some((room) => {
      const paintAreas = (room as { paintAreas?: { message?: string } } | undefined)?.paintAreas;
      return !!paintAreas?.message;
    });
    const topLevelRoomError = (!Array.isArray(errors.interiorRooms)
      ? (errors.interiorRooms as { message?: string } | undefined)?.message
      : undefined);
    const directFieldMessage = (
      fieldName:
        | 'typeOfWork'
        | 'exteriorAreas'
        | 'paintAreas'
        | 'apartmentStructure'
        | 'bedroomCount'
        | 'interiorWallHeight'
        | 'skirtingLinearMetres'
        | 'houseStories'
        | 'wallFinishes'
        | 'exteriorTrimItems'
        | 'otherInteriorArea'
        | 'otherExteriorArea'
    ) => (errors[fieldName] as { message?: string } | undefined)?.message;
    const doorItemError = (errors.interiorDoorItems as { message?: string } | undefined)?.message;
    const windowItemError = (errors.interiorWindowItems as { message?: string } | undefined)?.message;
    const prioritizedMessage =
      directFieldMessage('typeOfWork') ??
      directFieldMessage('exteriorAreas') ??
      directFieldMessage('paintAreas') ??
      directFieldMessage('apartmentStructure') ??
      directFieldMessage('bedroomCount') ??
      directFieldMessage('interiorWallHeight') ??
      directFieldMessage('skirtingLinearMetres') ??
      directFieldMessage('houseStories') ??
      directFieldMessage('wallFinishes') ??
      directFieldMessage('exteriorTrimItems') ??
      directFieldMessage('otherInteriorArea') ??
      directFieldMessage('otherExteriorArea') ??
      topLevelRoomError;

    toast({
      variant: 'destructive',
      title: 'Form incomplete',
      description: hasRoomSurfaceError
        ? 'For Interior > Specific areas > Doors or Window Frames, turn on Trim in at least one selected room first.'
        : prioritizedMessage ?? doorItemError ?? windowItemError ?? 'Please check the highlighted fields and try again.',
    });
  }

  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  return (
    <APIProvider apiKey={googleMapsApiKey!}>
      <AnimatePresence>
        {isLimitReached && !isCountLoading && !isAdmin && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <Alert variant="default" className="mb-6 border-primary bg-primary/5">
              <Info className="h-4 w-4 text-primary" />
              <AlertTitle className="text-primary">Free Limit Reached</AlertTitle>
              <AlertDescription>
                You have used your 2 free AI estimates. Please contact us for a professional on-site quote.
              </AlertDescription>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {state.error && !state.data && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <Alert variant="destructive" className="mb-6">
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>Generate Failed</AlertTitle>
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-8">
          {/* Your Details */}
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-6 w-6 text-primary" />
                <span>Your Details</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. John Smith" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="e.g. john@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input
                        type="tel"
                        inputMode="tel"
                        placeholder="e.g. 0412 345 678"
                        pattern="[0-9\s\-\+\(\)]*"
                        maxLength={15}
                        onKeyDown={(e) => {
                          if (
                            !/[\d\s\-\+\(\)Backspace Tab ArrowLeft ArrowRight Delete Home End]/.test(e.key) &&
                            !e.ctrlKey &&
                            !e.metaKey
                          ) {
                            e.preventDefault();
                          }
                        }}
                        onPaste={(e) => {
                          const paste = e.clipboardData.getData('text');
                          if (!/^[\d\s\-\+\(\)]+$/.test(paste)) {
                            e.preventDefault();
                          }
                        }}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location / Suburb</FormLabel>
                    <FormControl>
                      <AutocompleteInput field={field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Job Details */}
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Paintbrush className="h-6 w-6 text-primary" />
                <span>Job Details</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-x-6 gap-y-8">
              <FormField
                control={form.control}
                name="propertyType"
                render={({ field }) => (
                  <FormItem className="sm:col-span-1">
                    <FormLabel>Property Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {propertyTypes.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <AnimatePresence>
                {watchScope === 'Entire property' && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                  >
                    <FormField
                      control={form.control}
                      name="approxSize"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Approx. size (sqm)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              inputMode="decimal"
                              placeholder="e.g. 180"
                              min="10"
                              max="2000"
                              step="1"
                              onKeyDown={preventInvalidChars}
                              onPaste={preventInvalidPaste}
                              onWheel={(e) => e.currentTarget.blur()}
                              {...field}
                              value={field.value ?? ''}
                              onChange={(e) =>
                                field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))
                              }
                            />
                          </FormControl>
                          {isInterior && isApartmentType && watchScope === 'Entire property' && selectedApartmentStructure && (
                            <FormDescription>
                              Default guide for {selectedApartmentStructure.label}: {selectedApartmentStructure.avgSqm} sqm.
                              Your custom sqm entry will be used as-is.
                            </FormDescription>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {(watchPropertyType === 'House / Townhouse' || isExterior) && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="sm:col-span-2"
                  >
                    <FormField
                      control={form.control}
                      name="houseStories"
                      render={({ field }) => (
                        <FormItem className="space-y-3">
                          <FormLabel>Number of Stories {isExterior && <span className="text-destructive">*</span>}</FormLabel>
                          <FormControl>
                            <RadioGroup
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                              className="flex flex-col sm:flex-row gap-4 sm:gap-8"
                            >
                              <FormItem className="flex items-center space-x-3 space-y-0">
                                <FormControl>
                                  <RadioGroupItem value="1 storey" />
                                </FormControl>
                                <FormLabel className="font-normal cursor-pointer">1 storey</FormLabel>
                              </FormItem>
                              <FormItem className="flex items-center space-x-3 space-y-0">
                                <FormControl>
                                  <RadioGroupItem value="2 storey" />
                                </FormControl>
                                <FormLabel className="font-normal cursor-pointer">2 storey</FormLabel>
                              </FormItem>
                              <FormItem className="flex items-center space-x-3 space-y-0">
                                <FormControl>
                                  <RadioGroupItem value="3 storey" />
                                </FormControl>
                                <FormLabel className="font-normal cursor-pointer">3 storey</FormLabel>
                              </FormItem>
                            </RadioGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <FormField
                control={form.control}
                name="typeOfWork"
                render={() => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Type of Work</FormLabel>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                      {visibleTypeOfWorkItems.map((item) => (
                        <FormField
                          key={item.id}
                          control={form.control}
                          name="typeOfWork"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4 has-[:checked]:bg-primary/10 has-[:checked]:border-primary transition-colors">
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(item.id)}
                                  onCheckedChange={(checked) =>
                                    checked
                                      ? field.onChange([...(field.value || []), item.id])
                                      : field.onChange(field.value?.filter((value) => value !== item.id))
                                  }
                                />
                              </FormControl>
                              <FormLabel className="font-normal flex items-center gap-2 cursor-pointer">
                                {item.label}
                              </FormLabel>
                            </FormItem>
                          )}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="scopeOfPainting"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2 space-y-3">
                    <FormLabel>What needs to be painted?</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex flex-col sm:flex-row gap-4 sm:gap-8"
                      >
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="Entire property" />
                          </FormControl>
                          <FormLabel className="font-normal cursor-pointer">Entire property</FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="Specific areas only" />
                          </FormControl>
                          <FormLabel className="font-normal cursor-pointer">Specific areas only</FormLabel>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* Interior (원본 유지) */}
              <AnimatePresence>
  {isInterior && (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="sm:col-span-2 overflow-hidden space-y-8 pt-4"
    >
      {watchScope === 'Entire property' ? (
        isApartmentType ? (
          /* ── Apartment: simplified structure selection ── */
          <div className="space-y-6">
            <FormField
              control={form.control}
              name="apartmentStructure"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel className="text-base font-bold flex items-center gap-2">
                    <Home className="h-4 w-4 text-primary" /> Apartment Structure
                  </FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value ?? ''}
                      className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                    >
                      {APARTMENT_STRUCTURE_OPTIONS.map((opt) => (
                        <FormItem key={opt.id}>
                          <FormLabel
                            className={cn(
                              'flex items-center gap-3 rounded-md border p-4 cursor-pointer transition-colors font-normal w-full',
                              field.value === opt.id
                                ? 'border-primary bg-primary/10'
                                : 'bg-background hover:bg-accent/50'
                            )}
                          >
                            <FormControl>
                              <RadioGroupItem value={opt.id} />
                            </FormControl>
                            <span className="text-sm">{opt.label}</span>
                          </FormLabel>
                        </FormItem>
                      ))}
                    </RadioGroup>
                  </FormControl>
                  <FormDescription className="text-xs text-muted-foreground">
                    Price includes Lounge, Dining, Kitchen &amp; Laundry as standard.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-4">
              <FormLabel>Paint Surfaces</FormLabel>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 rounded-md border p-4 bg-background">
                <FormField
                  control={form.control}
                  name="paintAreas.ceilingPaint"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md p-4 hover:bg-accent/50 transition-colors">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="flex items-center gap-2 cursor-pointer">
                          <PaintRoller className="h-5 w-5" /> Ceiling
                        </FormLabel>
                      </div>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="paintAreas.wallPaint"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md p-4 hover:bg-accent/50 transition-colors">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="flex items-center gap-2 cursor-pointer">
                          <Paintbrush className="h-5 w-5" /> Walls
                        </FormLabel>
                      </div>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="paintAreas.trimPaint"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md p-4 hover:bg-accent/50 transition-colors">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="flex items-center gap-2 cursor-pointer">
                          <Palette className="h-5 w-5" /> Trim
                        </FormLabel>
                      </div>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="space-y-4 rounded-xl border border-primary/20 bg-primary/[0.03] p-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={isWholePropertyHandrailSelected}
                  onCheckedChange={(checked) => {
                    const next = !!checked;
                    if (next && handrailRoomIndex === -1) handleToggleRoom('Handrail');
                    if (!next && handrailRoomIndex > -1) handleToggleRoom('Handrail');
                  }}
                />
                <div className="space-y-1">
                  <FormLabel className="cursor-pointer text-sm font-semibold">
                    Add interior handrail
                  </FormLabel>
                  <FormDescription className="text-xs text-muted-foreground">
                    Uses the same handrail, baluster, and post pricing anchor as Specific areas.
                  </FormDescription>
                </div>
              </div>

              {isWholePropertyHandrailSelected && (
                <div className="grid gap-4 sm:grid-cols-3">
                  <FormField
                    control={form.control}
                    name={`interiorRooms.${handrailRoomIndex}.handrailDetails.lengthLm`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Total length (lm)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            inputMode="decimal"
                            min="0.5"
                            max="50"
                            step="0.1"
                            placeholder="e.g. 4.0"
                            onKeyDown={preventInvalidChars}
                            onPaste={preventInvalidPaste}
                            onWheel={(e) => e.currentTarget.blur()}
                            {...field}
                            value={field.value ?? ''}
                            onChange={(e) =>
                              field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`interiorRooms.${handrailRoomIndex}.handrailDetails.widthMm`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Handrail width (mm)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            inputMode="numeric"
                            min="20"
                            max="200"
                            step="1"
                            placeholder="e.g. 60"
                            onKeyDown={preventInvalidCharsNoDecimal}
                            onPaste={preventInvalidPasteNoDecimal}
                            onWheel={(e) => e.currentTarget.blur()}
                            {...field}
                            value={field.value ?? ''}
                            onChange={(e) =>
                              field.onChange(e.target.value === '' ? undefined : parseInt(e.target.value, 10))
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <HandrailSystemField
                    form={form}
                    name={`interiorRooms.${handrailRoomIndex}.handrailDetails.system`}
                  />
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ── House / Other: existing detailed UI ── */
          <div className="space-y-6">
            <div className="grid sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="bedroomCount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bedrooms</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        max="20"
                        placeholder="0"
                        onKeyDown={preventInvalidCharsNoDecimal}
                        onPaste={preventInvalidPasteNoDecimal}
                        onWheel={(e) => e.currentTarget.blur()}
                        {...field}
                        value={field.value ?? ''}
                        onChange={(e) =>
                          field.onChange(e.target.value === '' ? undefined : parseInt(e.target.value))
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="bathroomCount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bathrooms (Ensuite inc.)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        max="20"
                        placeholder="0"
                        onKeyDown={preventInvalidCharsNoDecimal}
                        onPaste={preventInvalidPasteNoDecimal}
                        onWheel={(e) => e.currentTarget.blur()}
                        {...field}
                        value={field.value ?? ''}
                        onChange={(e) =>
                          field.onChange(e.target.value === '' ? undefined : parseInt(e.target.value))
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-4">
              <FormLabel>Areas to Paint (Interior)</FormLabel>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-2">
                {interiorRoomList
                  .filter((r) => r !== 'Master Bedroom' && !r.includes('Bedroom') && r !== 'Bathroom' && r !== 'Handrail')
                  .map((room) => (
                    <div key={room} className="space-y-2">
                      <div
                        className={cn(
                          'flex flex-row items-center gap-3 rounded-md border p-3 transition-colors bg-background',
                          watchRoomsToPaint.includes(room) ? 'bg-primary/5 border-primary' : ''
                        )}
                      >
                        <Checkbox
                          checked={watchRoomsToPaint.includes(room)}
                          onCheckedChange={(checked) => {
                            const current = form.getValues('roomsToPaint') || [];
                            const next = checked
                              ? [...current, room]
                              : current.filter((v) => v !== room);
                            form.setValue('roomsToPaint', next);
                            if (room === 'Etc' && !checked) form.setValue('otherInteriorArea', '');
                          }}
                        />
                        <FormLabel className="font-normal cursor-pointer text-xs flex-1">{room}</FormLabel>

                        {room === 'Etc' && watchRoomsToPaint.includes('Etc') && (
                          <div className="ml-2 flex-1">
                            <Input
                              {...form.register('otherInteriorArea')}
                              placeholder="Specify room"
                              className="h-7 text-xs"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
              <FormField
                control={form.control}
                name="otherInteriorArea"
                render={() => <FormMessage />}
              />
            </div>

            <div className="space-y-4">
              <FormLabel>Paint Surfaces (Global)</FormLabel>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 rounded-md border p-4 bg-background">
                <FormField
                  control={form.control}
                  name="paintAreas.ceilingPaint"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md p-4 hover:bg-accent/50 transition-colors">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="flex items-center gap-2 cursor-pointer">
                          <PaintRoller className="h-5 w-5" /> Ceiling
                        </FormLabel>
                      </div>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="paintAreas.wallPaint"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md p-4 hover:bg-accent/50 transition-colors">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="flex items-center gap-2 cursor-pointer">
                          <Paintbrush className="h-5 w-5" /> Walls
                        </FormLabel>
                      </div>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="paintAreas.trimPaint"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md p-4 hover:bg-accent/50 transition-colors">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="flex items-center gap-2 cursor-pointer">
                          <Palette className="h-5 w-5" /> Trim
                        </FormLabel>
                      </div>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="space-y-4 rounded-xl border border-primary/20 bg-primary/[0.03] p-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={isWholePropertyHandrailSelected}
                  onCheckedChange={(checked) => {
                    const next = !!checked;
                    if (next && handrailRoomIndex === -1) handleToggleRoom('Handrail');
                    if (!next && handrailRoomIndex > -1) handleToggleRoom('Handrail');
                  }}
                />
                <div className="space-y-1">
                  <FormLabel className="cursor-pointer text-sm font-semibold">
                    Add interior handrail
                  </FormLabel>
                  <FormDescription className="text-xs text-muted-foreground">
                    Uses the same handrail, baluster, and post pricing anchor as Specific areas.
                  </FormDescription>
                </div>
              </div>

              {isWholePropertyHandrailSelected && (
                <div className="grid gap-4 sm:grid-cols-3">
                  <FormField
                    control={form.control}
                    name={`interiorRooms.${handrailRoomIndex}.handrailDetails.lengthLm`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Total length (lm)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            inputMode="decimal"
                            min="0.5"
                            max="50"
                            step="0.1"
                            placeholder="e.g. 4.0"
                            onKeyDown={preventInvalidChars}
                            onPaste={preventInvalidPaste}
                            onWheel={(e) => e.currentTarget.blur()}
                            {...field}
                            value={field.value ?? ''}
                            onChange={(e) =>
                              field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`interiorRooms.${handrailRoomIndex}.handrailDetails.widthMm`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Handrail width (mm)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            inputMode="numeric"
                            min="20"
                            max="200"
                            step="1"
                            placeholder="e.g. 60"
                            onKeyDown={preventInvalidCharsNoDecimal}
                            onPaste={preventInvalidPasteNoDecimal}
                            onWheel={(e) => e.currentTarget.blur()}
                            {...field}
                            value={field.value ?? ''}
                            onChange={(e) =>
                              field.onChange(e.target.value === '' ? undefined : parseInt(e.target.value, 10))
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <HandrailSystemField
                    form={form}
                    name={`interiorRooms.${handrailRoomIndex}.handrailDetails.system`}
                  />
                </div>
              )}
            </div>
          </div>
        )
        ) : (
          <div className="space-y-6">
            <FormField
              control={form.control}
              name="specificInteriorTrimOnly"
              render={({ field }) => (
                <FormItem className="rounded-xl border border-primary/20 bg-primary/[0.03] p-4">
                  <div className="flex items-start gap-3">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                          onCheckedChange={(checked) => {
                            const next = !!checked;
                            field.onChange(next);
                            if (next) {
                              form.setValue('interiorRooms', [], { shouldDirty: true, shouldValidate: true });
                            }
                          }}
                      />
                    </FormControl>
                    <div className="space-y-1">
                      <FormLabel className="cursor-pointer text-sm font-semibold">Trim only section</FormLabel>
                      <FormDescription className="text-xs text-muted-foreground">
                        Use this when the quote is only for trim items. It skips room anchors and shows trim options directly.
                      </FormDescription>
                    </div>
                  </div>
                </FormItem>
              )}
            />

            {watchSpecificTrimOnly ? (
              <div className="rounded-xl border border-dashed border-primary/30 bg-primary/[0.02] p-4 text-sm text-muted-foreground">
                Trim-only pricing is active. Use the Trim Options section below for doors, window frames, and skirting boards.
              </div>
            ) : (
              <>
                <FormField
                  control={form.control}
                  name="interiorWallHeight"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Interior Wall Height (m)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          inputMode="decimal"
                          step="0.1"
                          min="2"
                          max="5"
                          placeholder="e.g. 2.7"
                          onKeyDown={preventInvalidChars}
                          onPaste={preventInvalidPaste}
                          onWheel={(e) => e.currentTarget.blur()}
                          {...field}
                          value={field.value ?? ''}
                          onChange={(e) =>
                            field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))
                          }
                        />
                      </FormControl>
                      <FormDescription className="text-xs text-muted-foreground">
                        Used with room size to estimate wall area and infer skirting length more accurately.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-between items-center">
                  <div className="space-y-1">
                    <FormLabel className="text-base font-bold">Select Rooms & Detail Areas</FormLabel>
                    <p className="text-xs text-muted-foreground">
                      Room selection uses room anchors. If you only need trim pricing, turn on `Trim only section` above.
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    onClick={() => form.setValue('interiorRooms', [])}
                    className="text-primary text-xs"
                  >
                    Deselect all
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {interiorRoomList.map((roomName) => {
                    const roomIndex = fields.findIndex((f) => f.roomName === roomName);
                    const isSelected = roomIndex > -1;
                    const isMasterBedroom = roomName === 'Master Bedroom';
                    const isHandrail = roomName === 'Handrail';
                    const isEtc = roomName === 'Etc';
                    const roomSurfaceError = isSelected && !isHandrail ? getRoomSurfaceError(roomIndex) : undefined;

                    return (
                      <Card
                        key={roomName}
                        className={cn(
                          'border transition-colors cursor-pointer',
                          isSelected ? 'border-primary bg-primary/5' : 'bg-background'
                        )}
                      >
                        <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <Checkbox checked={isSelected} onCheckedChange={() => handleToggleRoom(roomName)} />
                            <span className="font-bold text-sm shrink-0">{roomName}</span>

                            {isEtc && isSelected && (
                              <div className="ml-2 flex-1" onClick={(e) => e.stopPropagation()}>
                                <Input
                                  placeholder="Specify room"
                                  className="h-7 text-xs"
                                  {...form.register(`interiorRooms.${roomIndex}.otherRoomName` as const)}
                                />
                              </div>
                            )}
                          </div>
                        </CardHeader>

                        {isSelected && isHandrail && (
                          <CardContent className="p-4 pt-0 space-y-4">
                            <div className="rounded-lg border border-primary/20 bg-background/80 p-3 text-xs text-muted-foreground">
                              Includes the full interior set: handrail, balusters, and posts. Standard density and access are assumed.
                            </div>

                            <FormField
                              control={form.control}
                              name={`interiorRooms.${roomIndex}.handrailDetails.lengthLm`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs">Total length (lm)</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      inputMode="decimal"
                                      min="0.5"
                                      max="50"
                                      step="0.1"
                                      placeholder="e.g. 4.0"
                                      onKeyDown={preventInvalidChars}
                                      onPaste={preventInvalidPaste}
                                      onWheel={(e) => e.currentTarget.blur()}
                                      {...field}
                                      value={field.value ?? ''}
                                      onChange={(e) =>
                                        field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))
                                      }
                                      className="h-8 text-xs"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name={`interiorRooms.${roomIndex}.handrailDetails.widthMm`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs">Handrail width (mm)</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      inputMode="numeric"
                                      min="20"
                                      max="200"
                                      step="1"
                                      placeholder="e.g. 60"
                                      onKeyDown={preventInvalidCharsNoDecimal}
                                      onPaste={preventInvalidPasteNoDecimal}
                                      onWheel={(e) => e.currentTarget.blur()}
                                      {...field}
                                      value={field.value ?? ''}
                                      onChange={(e) =>
                                        field.onChange(e.target.value === '' ? undefined : parseInt(e.target.value, 10))
                                      }
                                      className="h-8 text-xs"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <HandrailSystemField
                              form={form}
                              name={`interiorRooms.${roomIndex}.handrailDetails.system`}
                              layout="row-list"
                            />
                          </CardContent>
                        )}

                        {isSelected && !isHandrail && (
                          <CardContent className="p-4 pt-0 space-y-4">
                            <FormField
                              control={form.control}
                              name={`interiorRooms.${roomIndex}.approxRoomSize`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs">Approx. size (sqm)</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      inputMode="decimal"
                                      min="1"
                                      max="200"
                                      step="0.5"
                                      placeholder="e.g. 15"
                                      onKeyDown={preventInvalidChars}
                                      onPaste={preventInvalidPaste}
                                      onWheel={(e) => e.currentTarget.blur()}
                                      {...field}
                                      value={field.value ?? ''}
                                      onChange={(e) =>
                                        field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))
                                      }
                                      className="h-8 text-xs"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <div className="space-y-2">
                              <div className="space-y-2">
                                {isMasterBedroom && (
                                  <div className="flex items-center gap-3 pb-2 border-b mb-2">
                                    <Checkbox
                                      checked={form.watch(`interiorRooms.${roomIndex}.paintAreas.ensuitePaint`)}
                                      onCheckedChange={(checked) =>
                                        form.setValue(`interiorRooms.${roomIndex}.paintAreas.ensuitePaint`, !!checked)
                                      }
                                    />
                                    <span className="text-xs font-semibold text-primary">Include Ensuite</span>
                                  </div>
                                )}

                                <div className="flex items-center gap-3">
                                  <Checkbox
                                    checked={form.watch(`interiorRooms.${roomIndex}.paintAreas.ceilingPaint`)}
                                    onCheckedChange={(checked) =>
                                      form.setValue(`interiorRooms.${roomIndex}.paintAreas.ceilingPaint`, !!checked)
                                    }
                                  />
                                  <span className="text-xs">Ceiling</span>
                                </div>

                                <div className="flex items-center gap-3">
                                  <Checkbox
                                    checked={form.watch(`interiorRooms.${roomIndex}.paintAreas.wallPaint`)}
                                    onCheckedChange={(checked) =>
                                      form.setValue(`interiorRooms.${roomIndex}.paintAreas.wallPaint`, !!checked)
                                    }
                                  />
                                  <span className="text-xs">Walls</span>
                                </div>

                                <div className="flex items-center gap-3">
                                  <Checkbox
                                    checked={form.watch(`interiorRooms.${roomIndex}.paintAreas.trimPaint`)}
                                    onCheckedChange={(checked) =>
                                      form.setValue(`interiorRooms.${roomIndex}.paintAreas.trimPaint`, !!checked)
                                    }
                                  />
                                  <span className="text-xs">Trim</span>
                                </div>
                              </div>
                            </div>
                            {roomSurfaceError && <p className="text-xs font-medium text-destructive">{roomSurfaceError}</p>}
                          </CardContent>
                        )}
                      </Card>
                    );
                  })}
                </div>
              </>
            )}
        </div>
      )}

      <AnimatePresence>
        {showCeilingOptions && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-6 border-2 border-primary/20 bg-primary/[0.03] rounded-xl space-y-6"
          >
            <div className="space-y-3">
              <FormLabel className="text-primary font-bold flex items-center gap-2">
                <Layers className="h-4 w-4" /> Ceiling Style Options
              </FormLabel>
              <FormField
                control={form.control}
                name="ceilingOptions.ceilingType"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormControl>
                      <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col sm:flex-row gap-4">
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="Flat" />
                          </FormControl>
                          <FormLabel className="font-normal cursor-pointer">Flat ceiling (standard)</FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="Decorative" />
                          </FormControl>
                          <FormLabel className="font-normal cursor-pointer">Decorative / patterned ceiling</FormLabel>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showTrimOptions && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-6 border-2 border-primary/20 bg-primary/[0.03] rounded-xl space-y-6"
          >
            <div className="space-y-3">
              <FormLabel className="text-primary font-bold flex items-center gap-2">
                <Sparkles className="h-4 w-4" /> Trim Options
              </FormLabel>
              <FormField
                control={form.control}
                name="trimPaintOptions.paintType"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormControl>
                      <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col sm:flex-row gap-4">
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="Oil-based" />
                          </FormControl>
                          <FormLabel className="font-normal cursor-pointer">Oil</FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="Water-based" />
                          </FormControl>
                          <FormLabel className="font-normal cursor-pointer">Water</FormLabel>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4">
                {trimItems.map((item) => (
                  <FormField
                    key={item.id}
                    control={form.control}
                    name="trimPaintOptions.trimItems"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border bg-background p-3 has-[:checked]:bg-primary/10 transition-colors">
                        <FormControl>
                          <Checkbox
                            checked={field.value?.includes(item.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                if (
                                  (item.id === 'Doors' || item.id === 'Window Frames') &&
                                  watchScope === 'Specific areas only' &&
                                  !watchSpecificTrimOnly &&
                                  !ensureTrimEnabledForSpecificRoom()
                                ) {
                                  toast({
                                    variant: 'destructive',
                                    title: 'Select a room first',
                                    description:
                                      `Choose a normal room in Specific areas only before adding ${item.label}.`,
                                  });
                                  return;
                                }

                                field.onChange([...(field.value || []), item.id]);
                                return;
                              }

                              field.onChange(field.value?.filter((value) => value !== item.id));
                              if (item.id === 'Window Frames') form.setValue('trimPaintOptions.interiorWindowFrameTypes', []);
                              if (item.id === 'Window Frames') form.setValue('interiorWindowItems', []);
                              if (item.id === 'Doors') form.setValue('interiorDoorItems', []);
                              if (item.id === 'Skirting Boards') {
                                form.setValue('skirtingLinearMetres', undefined, { shouldDirty: true });
                                form.setValue('skirtingCalculatorRooms', [], { shouldDirty: true });
                                form.setValue('skirtingPricingMode', 'linear_metres', { shouldDirty: true });
                              }
                            }}
                          />
                        </FormControl>
                        <FormLabel className="font-normal flex items-center gap-2 cursor-pointer text-xs">
                          <item.icon className="h-3.5 w-3.5" /> {item.label}
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                ))}
              </div>
               <FormField
                 control={form.control}
                 name="trimPaintOptions.trimItems"
                 render={() => <FormMessage />}
               />

              {form.watch('trimPaintOptions.trimItems')?.includes('Skirting Boards') &&
                watchScope === 'Specific areas only' &&
                watchSpecificTrimOnly && (
                  <div className="rounded-lg border border-primary/20 bg-primary/[0.03] p-4 space-y-4">
                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-primary">Skirting Boards</div>
                      <p className="text-xs text-muted-foreground">
                        Enter either the total linear metres or use the quick room calculator to estimate skirting length.
                      </p>
                    </div>

                    <FormField
                      control={form.control}
                      name="skirtingPricingMode"
                      render={({ field }) => (
                        <FormItem className="space-y-3">
                          <FormControl>
                            <RadioGroup
                              onValueChange={field.onChange}
                              value={field.value ?? 'linear_metres'}
                              className="flex flex-col sm:flex-row gap-4"
                            >
                              <FormItem className="flex items-center space-x-3 space-y-0">
                                <FormControl>
                                  <RadioGroupItem value="linear_metres" />
                                </FormControl>
                                <FormLabel className="font-normal cursor-pointer">Linear metres (Recommended)</FormLabel>
                              </FormItem>
                              <FormItem className="flex items-center space-x-3 space-y-0">
                                <FormControl>
                                  <RadioGroupItem value="room_calculator" />
                                </FormControl>
                                <FormLabel className="font-normal cursor-pointer">Quick room calculator</FormLabel>
                              </FormItem>
                            </RadioGroup>
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    {watchSkirtingPricingMode === 'linear_metres' ? (
                      <FormField
                        control={form.control}
                        name="skirtingLinearMetres"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Total Skirting Length (lm)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                inputMode="decimal"
                                min="1"
                                max="500"
                                step="0.5"
                                placeholder="e.g. 45"
                                onKeyDown={preventInvalidChars}
                                onPaste={preventInvalidPaste}
                                onWheel={(e) => e.currentTarget.blur()}
                                {...field}
                                value={field.value ?? ''}
                                onChange={(e) =>
                                  field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))
                                }
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="text-xs font-medium text-muted-foreground">
                            Add rooms to estimate skirting length from room dimensions.
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => appendSkirtingCalculatorRoom({ label: '', length: undefined, width: undefined })}
                          >
                            Add Room
                          </Button>
                        </div>

                        {skirtingCalculatorFields.length === 0 && (
                          <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                            No rooms added yet.
                          </div>
                        )}

                        <div className="space-y-3">
                          {skirtingCalculatorFields.map((field, index) => (
                            <div key={field.id} className="rounded-md border bg-background p-3 space-y-3">
                              <div className="flex items-center justify-between gap-3">
                                <Input
                                  placeholder="Room label (optional)"
                                  className="h-8 text-xs"
                                  {...form.register(`skirtingCalculatorRooms.${index}.label` as const)}
                                />
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => removeSkirtingCalculatorRoom(index)}
                                >
                                  Remove
                                </Button>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <FormField
                                  control={form.control}
                                  name={`skirtingCalculatorRooms.${index}.length`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="text-xs">Length (m)</FormLabel>
                                      <FormControl>
                                        <Input
                                          type="number"
                                          inputMode="decimal"
                                          min="0.5"
                                          max="50"
                                          step="0.1"
                                          placeholder="e.g. 4.5"
                                          onKeyDown={preventInvalidChars}
                                          onPaste={preventInvalidPaste}
                                          onWheel={(e) => e.currentTarget.blur()}
                                          {...field}
                                          value={field.value ?? ''}
                                          onChange={(e) =>
                                            field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))
                                          }
                                          className="h-8 text-xs"
                                        />
                                      </FormControl>
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={form.control}
                                  name={`skirtingCalculatorRooms.${index}.width`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="text-xs">Width (m)</FormLabel>
                                      <FormControl>
                                        <Input
                                          type="number"
                                          inputMode="decimal"
                                          min="0.5"
                                          max="50"
                                          step="0.1"
                                          placeholder="e.g. 4.5"
                                          onKeyDown={preventInvalidChars}
                                          onPaste={preventInvalidPaste}
                                          onWheel={(e) => e.currentTarget.blur()}
                                          {...field}
                                          value={field.value ?? ''}
                                          onChange={(e) =>
                                            field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))
                                          }
                                          className="h-8 text-xs"
                                        />
                                      </FormControl>
                                    </FormItem>
                                  )}
                                />
                              </div>
                            </div>
                          ))}
                        </div>

                        <FormField
                          control={form.control}
                          name="skirtingLinearMetres"
                          render={() => <FormMessage />}
                        />
                      </div>
                    )}
                  </div>
                )}

              {/* Interior door item pricing (Specific areas only) */}
              {form.watch('trimPaintOptions.trimItems')?.includes('Doors') &&
                watchScope === 'Specific areas only' && (
                  <InteriorDoorDetail form={form} />
                )}
              <FormField
                control={form.control}
                name="interiorDoorItems"
                render={() => <FormMessage />}
              />

              {form.watch('trimPaintOptions.trimItems')?.includes('Window Frames') &&
                (watchScope === 'Specific areas only' ? (
                  <InteriorWindowDetail form={form} />
                ) : (
                  <div className="rounded-lg border border-primary/20 bg-primary/[0.03] p-3 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                      <Layout className="h-3.5 w-3.5" />
                      Interior Window Frames
                    </div>
                    <div className="grid grid-cols-1 gap-1.5">
                      {WINDOW_TYPE_OPTIONS.map((type) => (
                        <FormField
                          key={type}
                          control={form.control}
                          name="trimPaintOptions.interiorWindowFrameTypes"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border bg-background p-3 has-[:checked]:bg-primary/10 transition-colors">
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(type)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      field.onChange([...(field.value || []), type]);
                                      return;
                                    }
                                    field.onChange(field.value?.filter((value) => value !== type));
                                  }}
                                />
                              </FormControl>
                              <FormLabel className="font-normal cursor-pointer text-xs">{type}</FormLabel>
                            </FormItem>
                          )}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              <FormField
                control={form.control}
                name="interiorWindowItems"
                render={() => <FormMessage />}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )}
</AnimatePresence>

              {/* ✅ Exterior (구조 수정 핵심) */}
              <AnimatePresence>
                {isExterior && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="sm:col-span-2 overflow-hidden pt-4"
                  >
                    <div className="space-y-6">
                      {watchPropertyType === 'House / Townhouse' && (
                        <FormField
                          control={form.control}
                          name="wallHeight"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Approx. Wall Height (m)</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  inputMode="decimal"
                                  step="0.1"
                                  min="2"
                                  max="20"
                                  placeholder="e.g. 6.0"
                                  onKeyDown={preventInvalidChars}
                                  onPaste={preventInvalidPaste}
                                  onWheel={(e) => e.currentTarget.blur()}
                                  {...field}
                                  value={field.value ?? ''}
                                  onChange={(e) =>
                                    field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))
                                  }
                                />
                              </FormControl>
                              <FormDescription className="text-xs text-muted-foreground">
                                1 storey ≈ 2.4–3.0m, 2 storey ≈ 4.8–6.0m, 3 storey ≈ 7.2–9.0m
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      <div className="space-y-4">
                      <FormLabel>Exterior Areas</FormLabel>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-2">
                        {exteriorAreaOptions.map((item) => {
                          const isSelected = watchExteriorAreas.includes(item.id);
                          const isWall = item.id === 'Wall';
                          const isEtc = item.id === 'Etc';
                          const isExtTrim = item.id === 'Exterior Trim';
                          const isDeck = item.id === 'Deck';
                          const isPaving = item.id === 'Paving';

                          return (
                            <Card
                              key={item.id}
                              className={cn(
                                'border transition-colors cursor-pointer',
                                isSelected ? 'border-primary bg-primary/5' : 'bg-background'
                              )}
                            >
                              <CardHeader className="p-4">
                                <div className="flex items-center gap-3">
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={(checked) => {
                                      const current = form.getValues('exteriorAreas') || [];
                                      const next = checked
                                        ? [...current, item.id]
                                        : current.filter((v: string) => v !== item.id);

                                      form.setValue('exteriorAreas', next);

                                      if (isEtc && !checked) form.setValue('otherExteriorArea', '');
                                      if (isWall && !checked) form.setValue('wallFinishes', []);
                                      if (isExtTrim && !checked) {
                                        form.setValue('exteriorTrimItems', []);
                                        form.setValue('exteriorFrontDoor', false);
                                        form.setValue('exteriorDoors', []);
                                        form.setValue('exteriorWindows', []);
                                        form.setValue('exteriorArchitraves', []);
                                      }
                                      if (isDeck && !checked) {
                                        form.setValue('deckArea', undefined);
                                        form.setValue('deckServiceType', undefined);
                                        form.setValue('deckProductType', undefined);
                                        form.setValue('deckCondition', undefined);
                                      }
                                      if (isPaving && !checked) {
                                        form.setValue('pavingArea', undefined);
                                        form.setValue('pavingCondition', undefined);
                                      }
                                    }}
                                  />

                                  <div className="flex items-center gap-2 min-w-0">
                                    <item.icon className="h-4 w-4 shrink-0" />
                                    <CardTitle className="text-sm truncate">{item.label}</CardTitle>
                                  </div>
                                </div>
                              </CardHeader>

                              {/* Etc input: 카드 내부 */}
                              {isEtc && isSelected && (
                                <CardContent className="pt-0 px-4 pb-4">
                                  <Input
                                    {...form.register('otherExteriorArea')}
                                    placeholder="Specify: Garden shed, Fence..."
                                    className="h-8 text-xs"
                                  />
                                  <div className="mt-2">
                                    <FormField
                                      control={form.control}
                                      name="otherExteriorArea"
                                      render={() => <FormMessage />}
                                    />
                                  </div>
                                </CardContent>
                              )}

                              {/* ✅ Wall options: 카드 “바로 아래(카드 내부)” + 멀티 */}
                              {isWall && isSelected && (
                                <CardContent className="pt-0 px-4 pb-4 space-y-3">
                                  <div className="text-xs font-semibold text-primary">
                                    Wall finish (select all that apply)
                                  </div>

                                  <FormField
                                    control={form.control}
                                    name="wallFinishes"
                                    render={({ field }) => (
                                      <FormItem className="space-y-2">
                                        <div className="grid grid-cols-1 gap-2">
                                          {WALL_FINISH_OPTIONS.map((opt) => {
                                            const checked = (field.value ?? []).includes(opt.id);
                                            return (
                                              <div
                                                key={opt.id}
                                                className={cn(
                                                  'flex items-center gap-2 rounded-md border p-2 text-xs',
                                                  checked ? 'border-primary bg-primary/10' : 'bg-background'
                                                )}
                                              >
                                                <Checkbox
                                                  checked={checked}
                                                  onCheckedChange={(c) => {
                                                    const current = field.value ?? [];
                                                    const next = c
                                                      ? [...current, opt.id]
                                                      : current.filter((v) => v !== opt.id);
                                                    field.onChange(next);
                                                  }}
                                                />
                                                <span className="cursor-pointer">{opt.label}</span>
                                              </div>
                                            );
                                          })}
                                        </div>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </CardContent>
                              )}

                              {/* Deck: area + service type + product type + condition */}
                              {isDeck && isSelected && (
                                <CardContent className="pt-0 px-4 pb-4 space-y-4">
                                  <div className="text-xs font-semibold text-primary">Deck details</div>

                                  {/* Deck Area */}
                                  <FormField
                                    control={form.control}
                                    name="deckArea"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel className="text-xs">Deck area (sqm)</FormLabel>
                                        <FormControl>
                                          <Input
                                            type="number"
                                            min={1}
                                            placeholder="e.g. 25"
                                            className="h-8 text-xs"
                                            value={field.value ?? ''}
                                            onChange={(e) => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))}
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />

                                  {/* Service Type */}
                                  <FormField
                                    control={form.control}
                                    name="deckServiceType"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel className="text-xs">Service type</FormLabel>
                                        <div className="grid grid-cols-1 gap-2">
                                          {[
                                            { id: 'stain',            label: 'Stain (oil or water-based)' },
                                            { id: 'clear',            label: 'Clear coat / Sealer' },
                                            { id: 'paint-conversion', label: 'Varnish → Paint (3 coat)' },
                                            { id: 'paint-recoat',     label: 'Paint → Paint recoat (2 coat)' },
                                          ].map((opt) => (
                                            <div
                                              key={opt.id}
                                              className={cn(
                                                'flex items-center gap-2 rounded-md border p-2 text-xs cursor-pointer',
                                                field.value === opt.id ? 'border-primary bg-primary/10' : 'bg-background'
                                              )}
                                              onClick={() => field.onChange(opt.id)}
                                            >
                                              <div className={cn(
                                                'h-3 w-3 rounded-full border-2',
                                                field.value === opt.id ? 'border-primary bg-primary' : 'border-muted-foreground'
                                              )} />
                                              <span>{opt.label}</span>
                                            </div>
                                          ))}
                                        </div>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />

                                  {/* Product Type — only for stain / clear */}
                                  {(watchDeckServiceType === 'stain' || watchDeckServiceType === 'clear') && (
                                    <FormField
                                      control={form.control}
                                      name="deckProductType"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel className="text-xs">Product base</FormLabel>
                                          <div className="grid grid-cols-2 gap-2">
                                            {[
                                              { id: 'oil',   label: 'Oil-based' },
                                              { id: 'water', label: 'Water-based' },
                                            ].map((opt) => (
                                              <div
                                                key={opt.id}
                                                className={cn(
                                                  'flex items-center gap-2 rounded-md border p-2 text-xs cursor-pointer',
                                                  field.value === opt.id ? 'border-primary bg-primary/10' : 'bg-background'
                                                )}
                                                onClick={() => field.onChange(opt.id)}
                                              >
                                                <div className={cn(
                                                  'h-3 w-3 rounded-full border-2',
                                                  field.value === opt.id ? 'border-primary bg-primary' : 'border-muted-foreground'
                                                )} />
                                                <span>{opt.label}</span>
                                              </div>
                                            ))}
                                          </div>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                  )}

                                  {/* Condition */}
                                  <FormField
                                    control={form.control}
                                    name="deckCondition"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel className="text-xs">Timber condition</FormLabel>
                                        <div className="grid grid-cols-1 gap-2">
                                          {[
                                            { id: 'good',      label: 'Good — light sand & clean' },
                                            { id: 'weathered', label: 'Weathered — extra sanding needed' },
                                            { id: 'damaged',   label: 'Damaged — heavy prep & board repair' },
                                          ].map((opt) => (
                                            <div
                                              key={opt.id}
                                              className={cn(
                                                'flex items-center gap-2 rounded-md border p-2 text-xs cursor-pointer',
                                                field.value === opt.id ? 'border-primary bg-primary/10' : 'bg-background'
                                              )}
                                              onClick={() => field.onChange(opt.id)}
                                            >
                                              <div className={cn(
                                                'h-3 w-3 rounded-full border-2',
                                                field.value === opt.id ? 'border-primary bg-primary' : 'border-muted-foreground'
                                              )} />
                                              <span>{opt.label}</span>
                                            </div>
                                          ))}
                                        </div>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </CardContent>
                              )}

                              {/* Paving: area + surface condition */}
                              {isPaving && isSelected && (
                                <CardContent className="pt-0 px-4 pb-4 space-y-4">
                                  <div className="text-xs font-semibold text-primary">Paving details</div>

                                  {/* Paving Area */}
                                  <FormField
                                    control={form.control}
                                    name="pavingArea"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel className="text-xs">Paving area (sqm)</FormLabel>
                                        <FormControl>
                                          <Input
                                            type="number"
                                            min={1}
                                            placeholder="e.g. 40"
                                            className="h-8 text-xs"
                                            value={field.value ?? ''}
                                            onChange={(e) => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))}
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />

                                  {/* Surface Condition */}
                                  <FormField
                                    control={form.control}
                                    name="pavingCondition"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel className="text-xs">Surface condition</FormLabel>
                                        <div className="grid grid-cols-1 gap-2">
                                          {[
                                            { id: 'good', label: 'Good — clean, light etch only' },
                                            { id: 'fair', label: 'Fair — stained / oily, acid wash needed' },
                                            { id: 'poor', label: 'Poor — cracked / spalled, crack fill + extra prime' },
                                          ].map((opt) => (
                                            <div
                                              key={opt.id}
                                              className={cn(
                                                'flex items-center gap-2 rounded-md border p-2 text-xs cursor-pointer',
                                                field.value === opt.id ? 'border-primary bg-primary/10' : 'bg-background'
                                              )}
                                              onClick={() => field.onChange(opt.id)}
                                            >
                                              <div className={cn(
                                                'h-3 w-3 rounded-full border-2',
                                                field.value === opt.id ? 'border-primary bg-primary' : 'border-muted-foreground'
                                              )} />
                                              <span>{opt.label}</span>
                                            </div>
                                          ))}
                                        </div>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </CardContent>
                              )}

                              {/* Exterior Trim: style + quantity subsections */}
                              {isExtTrim && isSelected && (
                                <CardContent className="pt-0 px-4 pb-4 space-y-4">
                                  <div className="text-xs font-semibold text-primary">
                                    Select trim items to include
                                  </div>

                                  <FormField
                                    control={form.control}
                                    name="exteriorTrimItems"
                                    render={({ field }) => (
                                      <FormItem className="space-y-2">
                                        <div className="grid grid-cols-1 gap-2">
                                          {EXTERIOR_TRIM_OPTIONS.map((opt) => {
                                            const checked = (field.value ?? []).includes(opt.id);
                                            return (
                                              <div
                                                key={opt.id}
                                                className={cn(
                                                  'flex items-center gap-2 rounded-md border p-2 text-xs',
                                                  checked ? 'border-primary bg-primary/10' : 'bg-background'
                                                )}
                                              >
                                                <Checkbox
                                                  checked={checked}
                                                  onCheckedChange={(c) => {
                                                    const current = field.value ?? [];
                                                    const next = c
                                                      ? [...current, opt.id]
                                                      : current.filter((v) => v !== opt.id);
                                                    field.onChange(next);
                                                    if (opt.id === 'Front Door') {
                                                      form.setValue('exteriorFrontDoor', !!c, { shouldDirty: true });
                                                    }
                                                    // clear detail data when unchecked
                                                    if (!c) {
                                                      if (opt.id === 'Doors') form.setValue('exteriorDoors', []);
                                                      if (opt.id === 'Window Frames') form.setValue('exteriorWindows', []);
                                                      if (opt.id === 'Architraves') form.setValue('exteriorArchitraves', []);
                                                      if (opt.id === 'Front Door') form.setValue('exteriorFrontDoor', false, { shouldDirty: true });
                                                    }
                                                  }}
                                                />
                                                <div className="flex items-center gap-2">
                                                  <opt.icon className="h-3.5 w-3.5" />
                                                  <span className="cursor-pointer">{opt.label}</span>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />

                                  {watchExteriorTrimItems.includes('Front Door') && (
                                    <div className="rounded-lg border border-primary/20 bg-primary/[0.03] p-3 text-xs text-muted-foreground">
                                      Front Door is priced separately as a complex feature range and is not included in the `Doors` quantity counter.
                                    </div>
                                  )}

                                  {/* Doors detail */}
                                  {watchExteriorTrimItems.includes('Doors') && (
                                    <ExteriorTrimDetail
                                      title="Exterior Doors"
                                      icon={<DoorOpen className="h-3.5 w-3.5" />}
                                      styles={['Simple', 'Standard', 'Complex'] as const}
                                      max={20}
                                      fieldName="exteriorDoors"
                                      styleKey="style"
                                      form={form}
                                    />
                                  )}

                                  {/* Window Frames detail */}
                                  {watchExteriorTrimItems.includes('Window Frames') && (
                                    <ExteriorTrimDetail
                                      title="Window Frames"
                                      icon={<Layout className="h-3.5 w-3.5" />}
                                      styles={['Normal', 'Awning', 'Double Hung', 'French'] as const}
                                      max={30}
                                      fieldName="exteriorWindows"
                                      styleKey="type"
                                      form={form}
                                    />
                                  )}

                                  {/* Architraves detail */}
                                  {watchExteriorTrimItems.includes('Architraves') && (
                                    <ExteriorTrimDetail
                                      title="Architraves"
                                      icon={<Baseline className="h-3.5 w-3.5" />}
                                      styles={['Simple', 'Standard', 'Complex'] as const}
                                      max={50}
                                      fieldName="exteriorArchitraves"
                                      styleKey="style"
                                      form={form}
                                    />
                                  )}
                                </CardContent>
                              )}
                            </Card>
                          );
                        })}
                      </div>
                    </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>

          {/* Conditions & Difficulty (원본 유지) */}
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-6 w-6 text-primary" />
                <span>Conditions &amp; Difficulty</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-8">
              <FormField
                control={form.control}
                name="timingPurpose"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>Why are you painting?</FormLabel>
                    <FormControl>
                      <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col space-y-1">
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="Maintenance or refresh" />
                          </FormControl>
                          <FormLabel className="font-normal cursor-pointer">Maintenance or refresh</FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="Preparing for sale or rental" />
                          </FormControl>
                          <FormLabel className="font-normal cursor-pointer">Preparing for sale or rental</FormLabel>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="paintCondition"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel className="text-base flex items-center gap-2">
                      <ShieldAlert className="h-5 w-5" /> Current condition
                    </FormLabel>
                    <FormControl>
                      <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col space-y-1">
                        {paintConditionOptions.map((option) => (
                          <FormItem key={option.id} className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value={option.id} />
                            </FormControl>
                            <FormLabel className="font-normal cursor-pointer">{option.label}</FormLabel>
                          </FormItem>
                        ))}
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="jobDifficulty"
                render={() => (
                  <FormItem>
                    <div className="mb-4">
                      <FormLabel className="text-base flex items-center gap-2">
                        <TrendingUp className="h-5 w-5" /> Complexity Factors
                      </FormLabel>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {jobDifficultyItems.map((item) => (
                        <FormField
                          key={item.id}
                          control={form.control}
                          name="jobDifficulty"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4 has-[:checked]:bg-primary/10 has-[:checked]:border-primary transition-colors">
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(item.id)}
                                  onCheckedChange={(checked) =>
                                    checked
                                      ? field.onChange([...(field.value || []), item.id])
                                      : field.onChange(field.value?.filter((value) => value !== item.id))
                                  }
                                />
                              </FormControl>
                              <FormLabel className="font-normal flex items-center gap-2 cursor-pointer">
                                <item.icon className="h-5 w-5" /> {item.label}
                              </FormLabel>
                            </FormItem>
                          )}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Photo Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Camera className="h-5 w-5 text-primary" />
                Property Photos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Upload photos to help us better understand your property. Include images of areas to be painted, existing damage, surface conditions, or any special features.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  const incoming = Array.from(e.target.files ?? []);
                  setPhotoError(null);
                  const oversized = incoming.filter((f) => f.size > 10 * 1024 * 1024);
                  if (oversized.length > 0) {
                    setPhotoError(`${oversized.length} file(s) exceed the 10 MB limit and were not added.`);
                  }
                  const valid = incoming.filter((f) => f.size <= 10 * 1024 * 1024);
                  const combined = [...photos, ...valid];
                  if (combined.length > 10) {
                    setPhotoError('Maximum 10 photos allowed. Only the first 10 were kept.');
                    setPhotos(combined.slice(0, 10));
                  } else {
                    setPhotos(combined);
                  }
                  // Reset input so the same file can be re-added after removal
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={photos.length >= 10}
                onClick={() => fileInputRef.current?.click()}
              >
                <ImagePlus className="h-4 w-4" />
                Add Photos
                {photos.length > 0 && (
                  <span className="text-muted-foreground">({photos.length}/10)</span>
                )}
              </Button>
              {photoError && (
                <p className="text-sm text-destructive">{photoError}</p>
              )}
              {photos.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {photos.map((file, idx) => {
                    const url = URL.createObjectURL(file);
                    return (
                      <div key={idx} className="relative h-20 w-20 shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={`Upload preview ${idx + 1}`}
                          className="h-20 w-20 rounded-md object-cover border"
                          onLoad={() => URL.revokeObjectURL(url)}
                        />
                        <button
                          type="button"
                          aria-label={`Remove photo ${idx + 1}`}
                          onClick={() => {
                            setPhotoError(null);
                            setPhotos((prev) => prev.filter((_, i) => i !== idx));
                          }}
                          className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="space-y-4">
            <Button
              type="submit"
              size="lg"
              className="w-full text-lg h-14"
              disabled={isPending || (isLimitReached && !isAdmin) || isCountLoading}
            >
              {isPending ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <WandSparkles className="mr-2 h-6 w-6" />}
              {isLimitReached && !isAdmin ? 'Limit Reached' : isCountLoading ? 'Syncing...' : 'Generate AI Estimate'}
            </Button>

            <div className="text-center p-6 rounded-xl border-2 border-primary/20 bg-primary/5 shadow-sm space-y-2">
              <p className="text-base font-medium flex items-center justify-center gap-2 flex-wrap">
                <Calendar className="h-5 w-5 text-primary" />
                <span>Need an on-site assessment?</span>
                <a
                  href={BOOKING_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary font-bold underline hover:text-primary/80 transition-all inline-flex items-center gap-1 bg-white px-3 py-1 rounded-full border border-primary/20 shadow-sm"
                >
                  Book Free Quote <ExternalLink className="h-3 w-3" />
                </a>
              </p>
            </div>

            {!isAdmin && !isCountLoading && (
              <div className="text-center text-xs font-medium text-muted-foreground">
                Remaining free estimates:{' '}
                <span className="text-primary font-bold">{Math.max(0, 2 - estimateCount)} / 2</span>
              </div>
            )}
          </div>
        </form>
      </Form>

      <AnimatePresence>
        {isPending && (
          <motion.div
            className="mt-8 text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Analysing your data...</p>
          </motion.div>
        )}
      </AnimatePresence>

      {state.data && <EstimateResult result={state.data} pdfMeta={state.pdfMeta} />}
    </APIProvider>
  );
}
