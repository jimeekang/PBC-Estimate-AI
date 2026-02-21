'use client';

import { useForm, useFieldArray, useWatch } from 'react-hook-form';
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
} from '@/form';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { submitEstimate } from '@/app/estimate/actions';
import { useEffect, useState, useRef } from 'react';
import { EstimateResult } from './estimate-result';
import type { GeneratePaintingEstimateOutput } from '@/ai/flows/generate-painting-estimate';
import { useToast } from '@/hooks/use-toast';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useAuth } from '@/providers/auth-provider';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, query, where, getCountFromServer } from 'firebase/firestore';
import { cn } from '@/lib/utils';

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
  'Etc'
] as const;

const exteriorAreaOptions = [
  { id: 'Wall', label: 'Wall', icon: Home },
  { id: 'Eaves', label: 'Eaves', icon: ArrowUpToLine },
  { id: 'Gutter', label: 'Gutter', icon: Droplets },
  { id: 'Fascia', label: 'Fascia', icon: Sparkles },
  { id: 'Exterior Trim', label: 'Exterior Trim', icon: Hammer },
];

const propertyTypes = ['Apartment', 'House / Townhouse', 'Office', 'Other'];

const typeOfWorkItems = [
  { id: 'Interior Painting', label: 'Interior Painting' },
  { id: 'Exterior Painting', label: 'Exterior Painting' },
] as const;

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
});

const estimateFormSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  email: z.string().email('Invalid email address.'),
  phone: z.string().min(1, 'Phone number is required.'),
  typeOfWork: z.array(z.enum(['Interior Painting', 'Exterior Painting'])).min(1, 'Please select at least one type of work.'),
  scopeOfPainting: z.enum(['Entire property', 'Specific areas only']),
  propertyType: z.string().min(1, 'Property type is required.'),
  houseStories: z.enum(['Single story', 'Double story or more']).optional(),
  bedroomCount: z.coerce.number().min(0).optional(),
  roomsToPaint: z.array(z.string()).optional(),
  interiorRooms: z.array(InteriorRoomItemSchema).optional(),
  exteriorAreas: z.array(z.string()).optional(),
  approxSize: z.coerce.number().positive().optional(),
  existingWallColour: z.string().optional(),
  location: z.string().optional(),
  timingPurpose: z.enum(['Maintenance or refresh', 'Preparing for sale or rental']),
  paintCondition: z.enum(['Excellent', 'Fair', 'Poor']).optional(),
  jobDifficulty: z.array(z.enum(['Stairs', 'High ceilings', 'Extensive mouldings or trims', 'Difficult access areas'])).optional(),
  paintAreas: z.object({
    ceilingPaint: z.boolean().default(false),
    wallPaint: z.boolean().default(false),
    trimPaint: z.boolean().default(false),
    ensuitePaint: z.boolean().optional(),
  }).default({}),
  trimPaintOptions: z.object({
    paintType: z.enum(['Oil-based', 'Water-based']),
    trimItems: z.array(z.enum(['Doors', 'Window Frames', 'Skirting Boards'])),
  }).optional(),
  ceilingOptions: z.object({
    ceilingType: z.enum(['Flat', 'Decorative']),
  }).optional(),
});

type EstimateFormValues = z.infer<typeof estimateFormSchema>;

const BOOKING_URL = "https://clienthub.getjobber.com/booking/3a242065-0473-4039-ac49-e0a471328f15/";

export function EstimateForm() {
  const { user, isAdmin } = useAuth();
  const [state, setState] = useState<{data?: GeneratePaintingEstimateOutput, error?: string}>({});
  const [isPending, setIsPending] = useState(false);
  const [estimateCount, setEstimateCount] = useState(0);
  const [isCountLoading, setIsCountLoading] = useState(true);
  const [isLimitReached, setIsLimitReached] = useState(false);
  const { toast } = useToast();

  const inputRef = useRef<HTMLInputElement | null>(null);
  const autocompleteRef = useRef<any>(null);

  const form = useForm<EstimateFormValues>({
    resolver: zodResolver(estimateFormSchema),
    defaultValues: {
      paintAreas: {
        ceilingPaint: false,
        wallPaint: false,
        trimPaint: false,
        ensuitePaint: false,
      },
      trimPaintOptions: {
        paintType: 'Water-based',
        trimItems: [],
      },
      ceilingOptions: {
        ceilingType: 'Flat',
      },
      name: '',
      email: user?.email || '',
      phone: '',
      typeOfWork: [],
      scopeOfPainting: 'Entire property',
      propertyType: '',
      houseStories: 'Single story',
      bedroomCount: 0,
      roomsToPaint: [],
      interiorRooms: [],
      exteriorAreas: [],
      existingWallColour: '',
      location: '',
      timingPurpose: 'Maintenance or refresh',
      paintCondition: undefined,
      jobDifficulty: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "interiorRooms"
  });

  const fetchEstimateCount = async (uid: string) => {
    try {
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
      console.error("Error fetching count:", err);
      return 0;
    }
  };

  useEffect(() => {
    if (user) {
      setIsCountLoading(true);
      fetchEstimateCount(user.uid).finally(() => setIsCountLoading(false));
    }
  }, [user, isAdmin]);

  useEffect(() => {
    const initAutocomplete = () => {
      const google = (window as any).google;
      if (google?.maps?.places && inputRef.current && !autocompleteRef.current) {
        try {
          autocompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, {
            componentRestrictions: { country: 'au' },
            fields: ['formatted_address'],
          });

          autocompleteRef.current.addListener('place_changed', () => {
            const place = autocompleteRef.current.getPlace();
            if (place && place.formatted_address) {
              form.setValue('location', place.formatted_address);
            }
          });
        } catch (err) {
          console.warn("Google Places Autocomplete initialization failed. Ensure the domain is authorized in GCP Console.");
        }
      }
    };

    // Attempt to initialize immediately or when the script loads
    initAutocomplete();

    // Secondary attempt to handle slow script loading
    const timer = setInterval(() => {
      if ((window as any).google?.maps?.places) {
        initAutocomplete();
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [form]);

  const watchTypeOfWork = useWatch({ control: form.control, name: 'typeOfWork' }) || [];
  const isInterior = watchTypeOfWork.includes('Interior Painting');
  const isExterior = watchTypeOfWork.includes('Exterior Painting');
  const watchScope = useWatch({ control: form.control, name: 'scopeOfPainting' });
  const watchInteriorRooms = useWatch({ control: form.control, name: 'interiorRooms' });
  const watchRoomsToPaint = useWatch({ control: form.control, name: 'roomsToPaint' }) || [];
  const watchGlobalTrimPaint = useWatch({ control: form.control, name: 'paintAreas.trimPaint' });
  const watchGlobalCeilingPaint = useWatch({ control: form.control, name: 'paintAreas.ceilingPaint' });
  const watchPropertyType = useWatch({ control: form.control, name: 'propertyType' });

  const hasAnyRoomTrim = watchInteriorRooms?.some(r => r.paintAreas?.trimPaint);
  const hasAnyRoomCeiling = watchInteriorRooms?.some(r => r.paintAreas?.ceilingPaint);
  const hasHandrail = watchInteriorRooms?.some(r => r.roomName === 'Handrail');
  
  const showTrimOptions = (watchScope === 'Entire property' && watchGlobalTrimPaint) || 
                          (watchScope === 'Specific areas only' && (hasAnyRoomTrim || hasHandrail));

  const showCeilingOptions = (watchScope === 'Entire property' && watchGlobalCeilingPaint) ||
                             (watchScope === 'Specific areas only' && hasAnyRoomCeiling);

  const handleToggleRoom = (roomName: string) => {
    const roomIndex = fields.findIndex(f => f.roomName === roomName);
    if (roomIndex > -1) {
      remove(roomIndex);
    } else {
      append({
        roomName,
        paintAreas: {
          ceilingPaint: false,
          wallPaint: false,
          trimPaint: false,
          ensuitePaint: false
        }
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

  async function onSubmit(values: EstimateFormValues) {
    if (!user) return;
    if (!isAdmin) {
      const currentCount = await fetchEstimateCount(user.uid);
      if (currentCount >= 2) {
          setIsLimitReached(true);
          toast({ variant: "destructive", title: "Limit Reached", description: "You have already used your 2 free estimates." });
          return;
      }
    }

    setIsPending(true);
    const result = await submitEstimate(values);
    
    if(result.error) {
        toast({ variant: "destructive", title: "Error", description: result.error });
    } else if (result.data) {
        try {
          await addDoc(collection(db, 'estimates'), {
            userId: user.uid,
            options: result.sanitizedOptions ?? values,
            estimate: result.data,
            createdAt: serverTimestamp(),
          });
          
          if (!isAdmin) {
            const currentCount = await fetchEstimateCount(user.uid);
            setEstimateCount(currentCount);
            setIsLimitReached(currentCount >= 2);
          }
          setState(result);
          toast({ title: "Success", description: "Estimate generated!" });
        } catch (dbError: any) {
            console.error("Firestore Save Error:", dbError);
            toast({ variant: "destructive", title: "Storage Error", description: "Failed to save estimate." });
        }
    }
    setIsPending(false);
  }

  return (
    <>
      <AnimatePresence>
        {isLimitReached && !isCountLoading && !isAdmin && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <Alert variant="default" className="mb-6 border-primary bg-primary/5">
              <Info className="h-4 w-4 text-primary" />
              <AlertTitle className="text-primary">Free Limit Reached</AlertTitle>
              <AlertDescription>You have used your 2 free AI estimates. Please contact us for a professional on-site quote.</AlertDescription>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card className="shadow-md">
            <CardHeader><CardTitle className="flex items-center gap-2"><User className="h-6 w-6 text-primary" /><span>Your Details</span></CardTitle></CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-6">
              <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Name</FormLabel><FormControl><Input placeholder="John Doe" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email Address</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="phone" render={({ field }) => (<FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input placeholder="0412 345 678" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="location" render={({ field }) => (
                <FormItem>
                  <FormLabel>Location / Suburb</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g. Sydney, NSW" 
                      {...field} 
                      ref={(e) => {
                        field.ref(e);
                        inputRef.current = e;
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <Card className="shadow-md">
            <CardHeader><CardTitle className="flex items-center gap-2"><Paintbrush className="h-6 w-6 text-primary" /><span>Job Details</span></CardTitle></CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-x-6 gap-y-8">
              
              <FormField control={form.control} name="propertyType" render={({ field }) => (
                <FormItem><FormLabel>Property Type</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                  <SelectContent>{propertyTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
                </Select><FormMessage /></FormItem>
              )} />

              <AnimatePresence>
                {watchScope === 'Entire property' && (
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
                    <FormField control={form.control} name="approxSize" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Approx. size (sqm)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="e.g. 100" 
                            onKeyDown={preventInvalidChars}
                            {...field} 
                            value={field.value ?? ''} 
                            onChange={e => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </motion.div>
                )}
              </AnimatePresence>
              
              <AnimatePresence>
                {watchPropertyType === 'House / Townhouse' && (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="sm:col-span-2">
                    <FormField control={form.control} name="houseStories" render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel>Number of Stories</FormLabel>
                        <FormControl>
                          <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col sm:flex-row gap-4 sm:gap-8">
                            <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="Single story" /></FormControl><FormLabel className="font-normal cursor-pointer">Single story</FormLabel></FormItem>
                            <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="Double story or more" /></FormControl><FormLabel className="font-normal cursor-pointer">Double story or more</FormLabel></FormItem>
                          </RadioGroup>
                        </FormControl>
                      </FormItem>
                    )} />
                  </motion.div>
                )}
              </AnimatePresence>

              <FormField control={form.control} name="typeOfWork" render={() => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Type of Work</FormLabel>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                    {typeOfWorkItems.map((item) => (
                      <FormField key={item.id} control={form.control} name="typeOfWork" render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4 has-[:checked]:bg-primary/10 has-[:checked]:border-primary transition-colors">
                          <FormControl><Checkbox checked={field.value?.includes(item.id)} onCheckedChange={(checked) => checked ? field.onChange([...(field.value || []), item.id]) : field.onChange(field.value?.filter((value) => value !== item.id))} /></FormControl>
                          <FormLabel className="font-normal flex items-center gap-2 cursor-pointer">{item.label}</FormLabel>
                        </FormItem>
                      )} />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="scopeOfPainting" render={({ field }) => (
                <FormItem className="sm:col-span-2 space-y-3">
                  <FormLabel>What needs to be painted?</FormLabel>
                  <FormControl>
                    <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col sm:flex-row gap-4 sm:gap-8">
                      <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="Entire property" /></FormControl><FormLabel className="font-normal cursor-pointer">Entire property</FormLabel></FormItem>
                      <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="Specific areas only" /></FormControl><FormLabel className="font-normal cursor-pointer">Specific areas only</FormLabel></FormItem>
                    </RadioGroup>
                  </FormControl>
                </FormItem>
              )} />
              
              <AnimatePresence>
                {isInterior && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="sm:col-span-2 overflow-hidden space-y-8 pt-4">
                    {watchScope === 'Entire property' ? (
                      <div className="space-y-6">
                        <div className="grid sm:grid-cols-2 gap-4">
                          <FormField control={form.control} name="bedroomCount" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Number of Other Bedrooms</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  min="0" 
                                  placeholder="0"
                                  onKeyDown={preventInvalidCharsNoDecimal}
                                  {...field} 
                                  value={field.value ?? ''}
                                  onChange={e => field.onChange(e.target.value === '' ? undefined : parseInt(e.target.value))}
                                />
                              </FormControl>
                              <FormDescription>Excluding Master Bedroom</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )} />
                        </div>

                        <div className="space-y-4">
                          <FormLabel>Areas to Paint (Interior)</FormLabel>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                            {interiorRoomList.filter(r => r === 'Master Bedroom' || !r.includes('Bedroom')).map((room) => (
                              <FormField key={room} control={form.control} name="roomsToPaint" render={({ field }) => (
                                <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3 has-[:checked]:bg-primary/10 has-[:checked]:border-primary transition-colors bg-background">
                                  <FormControl><Checkbox checked={field.value?.includes(room)} onCheckedChange={(checked) => checked ? field.onChange([...(field.value || []), room]) : field.onChange(field.value?.filter((value) => value !== room))} /></FormControl>
                                  <FormLabel className="font-normal cursor-pointer text-xs">{room}</FormLabel>
                                </FormItem>
                              )} />
                            ))}
                          </div>
                        </div>

                        <AnimatePresence>
                          {watchRoomsToPaint.includes('Master Bedroom') && (
                            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="p-4 border rounded-lg bg-primary/5 border-primary/20">
                              <FormField control={form.control} name="paintAreas.ensuitePaint" render={({ field }) => (
                                <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                  <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                  <FormLabel className="font-bold text-primary cursor-pointer text-sm">Include Master Ensuite?</FormLabel>
                                </FormItem>
                              )} />
                            </motion.div>
                          )}
                        </AnimatePresence>

                        <div className="space-y-4">
                          <FormLabel>Paint Surfaces (Global)</FormLabel>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 rounded-md border p-4 bg-background">
                            <FormField control={form.control} name="paintAreas.ceilingPaint" render={({ field }) => (<FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md p-4 hover:bg-accent/50 transition-colors"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><div className="space-y-1 leading-none"><FormLabel className="flex items-center gap-2 cursor-pointer"><PaintRoller className="h-5 w-5" /> Ceiling</FormLabel></div></FormItem>)} />
                            <FormField control={form.control} name="paintAreas.wallPaint" render={({ field }) => (<FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md p-4 hover:bg-accent/50 transition-colors"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><div className="space-y-1 leading-none"><FormLabel className="flex items-center gap-2 cursor-pointer"><Paintbrush className="h-5 w-5" /> Walls</FormLabel></div></FormItem>)} />
                            <FormField control={form.control} name="paintAreas.trimPaint" render={({ field }) => (<FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md p-4 hover:bg-accent/50 transition-colors"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><div className="space-y-1 leading-none"><FormLabel className="flex items-center gap-2 cursor-pointer"><Palette className="h-5 w-5" /> Trim</FormLabel></div></FormItem>)} />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <div className="flex justify-between items-center">
                          <FormLabel className="text-base font-bold">Select Rooms & Detail Areas</FormLabel>
                          <Button variant="ghost" size="sm" type="button" onClick={() => form.setValue('interiorRooms', [])} className="text-primary text-xs">Deselect all</Button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {interiorRoomList.map((roomName) => {
                            const roomIndex = fields.findIndex(f => f.roomName === roomName);
                            const isSelected = roomIndex > -1;
                            const isMasterBedroom = roomName === 'Master Bedroom';
                            const isHandrail = roomName === 'Handrail';

                            return (
                              <Card key={roomName} className={cn("transition-all border-2", isSelected ? "border-primary bg-primary/[0.02] shadow-sm" : "border-border opacity-60")}>
                                <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
                                  <div className="flex items-center gap-2">
                                    <Checkbox checked={isSelected} onCheckedChange={() => handleToggleRoom(roomName)} />
                                    <span className="font-bold text-sm shrink-0">{roomName}</span>
                                    {roomName === 'Etc' && isSelected && (
                                      <Input 
                                        placeholder="Specify..." 
                                        className="h-7 text-xs ml-2 flex-1 min-w-[80px]"
                                        {...form.register(`interiorRooms.${roomIndex}.otherRoomName`)}
                                      />
                                    )}
                                  </div>
                                </CardHeader>
                                {isSelected && !isHandrail && (
                                  <CardContent className="p-4 pt-0 space-y-4">
                                    <div className="space-y-2">
                                      <div className="space-y-2">
                                        {isMasterBedroom && (
                                          <div className="flex items-center gap-3 pb-2 border-b mb-2">
                                            <Checkbox 
                                              checked={form.watch(`interiorRooms.${roomIndex}.paintAreas.ensuitePaint`)} 
                                              onCheckedChange={(checked) => form.setValue(`interiorRooms.${roomIndex}.paintAreas.ensuitePaint`, !!checked)} 
                                            />
                                            <span className="text-xs font-semibold text-primary">Include Ensuite</span>
                                          </div>
                                        )}
                                        <div className="flex items-center gap-3">
                                          <Checkbox 
                                            checked={form.watch(`interiorRooms.${roomIndex}.paintAreas.ceilingPaint`)} 
                                            onCheckedChange={(checked) => form.setValue(`interiorRooms.${roomIndex}.paintAreas.ceilingPaint`, !!checked)} 
                                          />
                                          <span className="text-xs">Ceiling</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                          <Checkbox 
                                            checked={form.watch(`interiorRooms.${roomIndex}.paintAreas.wallPaint`)} 
                                            onCheckedChange={(checked) => form.setValue(`interiorRooms.${roomIndex}.paintAreas.wallPaint`, !!checked)} 
                                          />
                                          <span className="text-xs">Walls</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                          <Checkbox 
                                            checked={form.watch(`interiorRooms.${roomIndex}.paintAreas.trimPaint`)} 
                                            onCheckedChange={(checked) => form.setValue(`interiorRooms.${roomIndex}.paintAreas.trimPaint`, !!checked)} 
                                          />
                                          <span className="text-xs">Trim</span>
                                        </div>
                                      </div>
                                    </div>
                                  </CardContent>
                                )}
                              </Card>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <AnimatePresence>
                      {showCeilingOptions && (
                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="p-6 border-2 border-primary/20 bg-primary/[0.03] rounded-xl space-y-4">
                          <FormLabel className="text-primary font-bold flex items-center gap-2"><PaintRoller className="h-4 w-4" /> Ceiling Style</FormLabel>
                          <FormField control={form.control} name="ceilingOptions.ceilingType" render={({ field }) => (
                            <FormItem className="space-y-3">
                              <FormControl>
                                <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col sm:flex-row gap-4">
                                  <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="Flat" /></FormControl><FormLabel className="font-normal cursor-pointer">Flat ceiling (standard)</FormLabel></FormItem>
                                  <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="Decorative" /></FormControl><FormLabel className="font-normal cursor-pointer">Decorative / patterned ceiling</FormLabel></FormItem>
                                </RadioGroup>
                              </FormControl>
                            </FormItem>
                          )} />
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <AnimatePresence>
                      {showTrimOptions && (
                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="p-6 border-2 border-primary/20 bg-primary/[0.03] rounded-xl space-y-6">
                          <div className="space-y-3">
                            <FormLabel className="text-primary font-bold flex items-center gap-2"><Sparkles className="h-4 w-4" /> Trim Options</FormLabel>
                            <FormField control={form.control} name="trimPaintOptions.paintType" render={({ field }) => (
                              <FormItem className="space-y-3">
                                <FormControl>
                                  <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col sm:flex-row gap-4">
                                    <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="Oil-based" /></FormControl><FormLabel className="font-normal cursor-pointer">Oil</FormLabel></FormItem>
                                    <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="Water-based" /></FormControl><FormLabel className="font-normal cursor-pointer">Water</FormLabel></FormItem>
                                  </RadioGroup>
                                </FormControl>
                              </FormItem>
                            )} />
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4">
                              {trimItems.map((item) => (
                                <FormField key={item.id} control={form.control} name="trimPaintOptions.trimItems" render={({ field }) => (
                                  <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border bg-background p-3 has-[:checked]:bg-primary/10 transition-colors">
                                    <FormControl><Checkbox checked={field.value?.includes(item.id)} onCheckedChange={(checked) => checked ? field.onChange([...(field.value || []), item.id]) : field.onChange(field.value?.filter((value) => value !== item.id))} /></FormControl>
                                    <FormLabel className="font-normal flex items-center gap-2 cursor-pointer text-xs"><item.icon className="h-3.5 w-3.5" /> {item.label}</FormLabel>
                                  </FormItem>
                                )} />
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {isExterior && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="sm:col-span-2 overflow-hidden pt-4">
                    <FormField control={form.control} name="exteriorAreas" render={() => (
                      <FormItem><FormLabel>Exterior Areas</FormLabel><div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                        {exteriorAreaOptions.map((item) => (
                          <FormField key={item.id} control={form.control} name="exteriorAreas" render={({ field }) => (
                            <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3 has-[:checked]:bg-primary/10 has-[:checked]:border-primary transition-colors">
                              <FormControl><Checkbox checked={field.value?.includes(item.id)} onCheckedChange={(checked) => checked ? field.onChange([...(field.value || []), item.id]) : field.onChange(field.value?.filter((value) => value !== item.id))} /></FormControl>
                              <FormLabel className="font-normal flex items-center gap-2 cursor-pointer text-xs"><item.icon className="h-4 w-4" /> {item.label}</FormLabel>
                            </FormItem>
                          )} />
                        ))}
                      </div><FormMessage /></FormItem>
                    )} />
                  </motion.div>
                )}
              </AnimatePresence>

              <FormField control={form.control} name="existingWallColour" render={({ field }) => (<FormItem><FormLabel>Existing Wall Colour</FormLabel><FormControl><Input placeholder="e.g. White" {...field} /></FormControl><FormMessage /></FormItem>)} />
            </CardContent>
          </Card>

          <Card className="shadow-md">
            <CardHeader><CardTitle className="flex items-center gap-2"><Layers className="h-6 w-6 text-primary" /><span>Conditions &amp; Difficulty</span></CardTitle></CardHeader>
            <CardContent className="space-y-8">
                <FormField control={form.control} name="timingPurpose" render={({ field }) => (
                  <FormItem className="space-y-3"><FormLabel>Why are you painting?</FormLabel><FormControl><RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col space-y-1">
                    <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="Maintenance or refresh" /></FormControl><FormLabel className="font-normal cursor-pointer">Maintenance or refresh</FormLabel></FormItem>
                    <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="Preparing for sale or rental" /></FormControl><FormLabel className="font-normal cursor-pointer">Preparing for sale or rental</FormLabel></FormItem>
                  </RadioGroup></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="paintCondition" render={({ field }) => (
                  <FormItem className="space-y-3"><FormLabel className="text-base flex items-center gap-2"><ShieldAlert className="h-5 w-5" /> Current condition</FormLabel><FormControl><RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col space-y-1">
                    {paintConditionOptions.map((option) => (
                      <FormItem key={option.id} className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value={option.id} /></FormControl><FormLabel className="font-normal cursor-pointer">{option.label}</FormLabel></FormItem>
                    ))}
                  </RadioGroup></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="jobDifficulty" render={() => (
                    <FormItem><div className="mb-4"><FormLabel className="text-base flex items-center gap-2"><TrendingUp className="h-5 w-5" /> Complexity Factors</FormLabel></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {jobDifficultyItems.map((item) => (
                      <FormField key={item.id} control={form.control} name="jobDifficulty" render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4 has-[:checked]:bg-primary/10 has-[:checked]:border-primary transition-colors">
                          <FormControl><Checkbox checked={field.value?.includes(item.id)} onCheckedChange={(checked) => checked ? field.onChange([...(field.value || []), item.id]) : field.onChange(field.value?.filter((value) => value !== item.id))} /></FormControl>
                          <FormLabel className="font-normal flex items-center gap-2 cursor-pointer"><item.icon className="h-5 w-5" /> {item.label}</FormLabel>
                        </FormItem>
                      )} />
                    ))}
                    </div><FormMessage /></FormItem>
                )} />
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Button type="submit" size="lg" className="w-full text-lg h-14" disabled={isPending || (isLimitReached && !isAdmin) || isCountLoading}>
              {isPending ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <WandSparkles className="mr-2 h-6 w-6" />}
              {isLimitReached && !isAdmin ? 'Limit Reached' : isCountLoading ? 'Syncing...' : 'Generate AI Estimate'}
            </Button>
            <div className="text-center p-6 rounded-xl border-2 border-primary/20 bg-primary/5 shadow-sm space-y-2">
              <p className="text-base font-medium flex items-center justify-center gap-2 flex-wrap"><Calendar className="h-5 w-5 text-primary" /><span>Need an on-site assessment?</span><a href={BOOKING_URL} target="_blank" rel="noopener noreferrer" className="text-primary font-bold underline hover:text-primary/80 transition-all inline-flex items-center gap-1 bg-white px-3 py-1 rounded-full border border-primary/20 shadow-sm">Book Free Quote <ExternalLink className="h-3 w-3" /></a></p>
            </div>
            {!isAdmin && !isCountLoading && (
              <div className="text-center text-xs font-medium text-muted-foreground">
                Remaining free estimates: <span className="text-primary font-bold">{Math.max(0, 2 - estimateCount)} / 2</span>
              </div>
            )}
          </div>
        </form>
      </Form>
      <AnimatePresence>
        {isPending && (
          <motion.div className="mt-8 text-center" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary mb-4"/>
            <p className="text-muted-foreground">Analysing your data...</p>
          </motion.div>
        )}
      </AnimatePresence>
      {state.data && <EstimateResult result={state.data} />}
    </>
  );
}
