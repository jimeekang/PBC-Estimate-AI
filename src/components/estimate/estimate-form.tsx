'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
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
  MapPin,
  Calendar,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { submitEstimate } from '@/app/estimate/actions';
import { useEffect, useState, useCallback } from 'react';
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

const roomOptions = [
  'Bedroom 1', 'Bedroom 2', 'Bedroom 3', 'Bathroom', 'Livingroom', 'Lounge', 'Kitchen', 'Laundry', 'Etc'
];

const exteriorAreaOptions = [
  { id: 'Wall', label: 'Wall', icon: Home },
  { id: 'Eaves', label: 'Eaves', icon: ArrowUpToLine },
  { id: 'Gutter', label: 'Gutter', icon: Droplets },
  { id: 'Fascia', label: 'Fascia', icon: Sparkles },
  { id: 'Exterior Trim', label: 'Exterior Trim', icon: Hammer },
];

const propertyTypes = ['Apartment', 'House', 'Townhouse', 'Office', 'Other'];

const typeOfWorkItems = [
  { id: 'Interior Painting', label: 'Interior Painting' },
  { id: 'Exterior Painting', label: 'Exterior Painting' },
] as const;

const estimateFormSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  email: z.string().email('Invalid email address.'),
  phone: z.string().min(1, 'Phone number is required.'),
  typeOfWork: z.array(z.enum(['Interior Painting', 'Exterior Painting'])).min(1, 'Please select at least one type of work.'),
  scopeOfPainting: z.enum(['Entire property', 'Specific areas only']),
  propertyType: z.string().min(1, 'Property type is required.'),
  roomsToPaint: z.array(z.string()).optional(),
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
  }).default({}),
  trimPaintOptions: z.object({
    paintType: z.enum(['Oil-based', 'Water-based']),
    trimItems: z.array(z.enum(['Doors', 'Window Frames', 'Skirting Boards'])),
  }).optional(),
});

type EstimateFormValues = z.infer<typeof estimateFormSchema>;

const BOOKING_URL = "https://clienthub.getjobber.com/booking/3a242065-0473-4039-ac49-e0a471328f15/?hl=en-AU&gei=ToaeaOX_Aemd4-EP8PLo4QQ&rwg_token=ACgRB3dTJDWOYboojrle3rI8gtbZw-AyOUJf57Jz7Mw9Y_ENGZMD4tsX753nFQ_jl26ENKc9X6ikq_w46rgHpuel-qj-sqpr8A%3D%3D";

export function EstimateForm() {
  const { user, isAdmin } = useAuth();
  const [state, setState] = useState<{data?: GeneratePaintingEstimateOutput, error?: string}>({});
  const [isPending, setIsPending] = useState(false);
  const [estimateCount, setEstimateCount] = useState(0);
  const [isCountLoading, setIsCountLoading] = useState(true);
  const [isLimitReached, setIsLimitReached] = useState(false);
  const { toast } = useToast();

  // Address Suggestion State
  const [addressSuggestions, setAddressSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);

  const form = useForm<EstimateFormValues>({
    resolver: zodResolver(estimateFormSchema),
    defaultValues: {
      paintAreas: {
        ceilingPaint: false,
        wallPaint: false,
        trimPaint: false,
      },
      name: '',
      email: user?.email || '',
      phone: '',
      typeOfWork: [],
      scopeOfPainting: 'Entire property',
      propertyType: '',
      roomsToPaint: [],
      exteriorAreas: [],
      existingWallColour: '',
      location: '',
      timingPurpose: 'Maintenance or refresh',
      paintCondition: undefined,
      jobDifficulty: [],
    },
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
      } else {
        setIsLimitReached(false);
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

  const watchTypeOfWork = form.watch('typeOfWork') || [];
  const isInterior = watchTypeOfWork.includes('Interior Painting');
  const isExterior = watchTypeOfWork.includes('Exterior Painting');
  const watchTrimPaint = form.watch('paintAreas.trimPaint');

  // Debounced address search focusing on detailed Australian addresses
  const searchAddress = useCallback(async (queryStr: string) => {
    if (!queryStr || queryStr.length < 3) {
      setAddressSuggestions([]);
      return;
    }

    setIsSearchingAddress(true);
    try {
      const searchQuery = queryStr.toLowerCase().includes('australia') ? queryStr : `${queryStr}, Australia`;
      const response = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(searchQuery)}&limit=8&lang=en`);
      const data = await response.json();
      
      const suggestions = data.features.map((f: any) => {
        const p = f.properties;
        const isAustralia = p.countrycode === 'AU' || p.country === 'Australia';
        if (!isAustralia) return null;

        const parts = [];
        if (p.housenumber && p.street) parts.push(`${p.housenumber} ${p.street}`);
        else if (p.street) parts.push(p.street);
        else if (p.name && p.name !== p.city && p.name !== p.state) parts.push(p.name);

        if (p.city || p.district) parts.push(p.city || p.district);
        if (p.state) parts.push(p.state);
        if (p.postcode) parts.push(p.postcode);

        return parts.filter(Boolean).join(', ');
      }).filter(Boolean);

      setAddressSuggestions(Array.from(new Set(suggestions as string[])));
    } catch (error) {
      console.error('Address search error:', error);
    } finally {
      setIsSearchingAddress(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const location = form.getValues('location');
      if (location && showSuggestions) searchAddress(location);
    }, 400);
    return () => clearTimeout(timeoutId);
  }, [form.watch('location'), searchAddress, showSuggestions]);

  async function onSubmit(values: EstimateFormValues) {
    if (!user) return;
    
    if (!isAdmin) {
      const currentCount = await fetchEstimateCount(user.uid);
      if (currentCount >= 2) {
          setIsLimitReached(true);
          toast({
              variant: "destructive",
              title: "Limit Reached",
              description: "You have already used your 2 free estimates.",
          });
          return;
      }
    }

    setIsPending(true);
    const result = await submitEstimate(values);
    
    if(result.error) {
        toast({
            variant: "destructive",
            title: "Error",
            description: result.error,
        });
    } else if (result.data) {
        try {
            await addDoc(collection(db, 'estimates'), {
                userId: user.uid,
                options: values,
                estimate: result.data,
                createdAt: serverTimestamp(),
            });
            
            if (!isAdmin) {
              const currentCount = await fetchEstimateCount(user.uid);
              setEstimateCount(currentCount);
              setIsLimitReached(currentCount >= 2);
              
              toast({
                title: "Success",
                description: `Estimate generated! (${currentCount}/2 used)`,
              });
            } else {
              toast({
                title: "Success (Admin)",
                description: `Estimate generated! (Unlimited access)`,
              });
              await fetchEstimateCount(user.uid);
            }
            
            setState(result);
        } catch (dbError: any) {
            console.error("Firestore Save Error:", dbError);
            toast({
                variant: "destructive",
                title: "Storage Error",
                description: "Failed to save estimate to database.",
            });
        }
    }
    
    setIsPending(false);
  }

  return (
    <>
      <AnimatePresence>
        {isLimitReached && !isCountLoading && !isAdmin && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Alert variant="default" className="mb-6 border-primary bg-primary/5">
              <Info className="h-4 w-4 text-primary" />
              <AlertTitle className="text-primary">Free Limit Reached</AlertTitle>
              <AlertDescription>
                You have already used your 2 free AI estimates. For a more accurate quote, please contact us for an on-site inspection.
              </AlertDescription>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
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
                      <Input placeholder="e.g. John Doe" {...field} />
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
                      <Input type="email" placeholder="e.g. john.doe@email.com" {...field} />
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
                      <Input placeholder="e.g. 0412 345 678" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem className="relative">
                    <FormLabel>Location</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input 
                          placeholder="Search your Australian address..." 
                          {...field} 
                          onFocus={() => setShowSuggestions(true)}
                          onBlur={() => setTimeout(() => setShowSuggestions(false), 250)}
                          autoComplete="off"
                        />
                        {isSearchingAddress && (
                          <div className="absolute right-3 top-2.5">
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    </FormControl>
                    <AnimatePresence>
                      {showSuggestions && addressSuggestions.length > 0 && (
                        <motion.ul
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-72 overflow-auto"
                        >
                          {addressSuggestions.map((suggestion, index) => (
                            <li
                              key={index}
                              className="px-4 py-3 hover:bg-accent hover:text-accent-foreground cursor-pointer text-sm flex items-start gap-2 border-b last:border-0"
                              onMouseDown={() => {
                                field.onChange(suggestion);
                                setAddressSuggestions([]);
                                setShowSuggestions(false);
                              }}
                            >
                              <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                              <span className="leading-snug">{suggestion}</span>
                            </li>
                          ))}
                        </motion.ul>
                      )}
                    </AnimatePresence>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

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
                name="scopeOfPainting"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2 space-y-3">
                    <FormLabel>What needs to be painted?</FormLabel>
                    <FormControl>
                      <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col sm:flex-row gap-4 sm:gap-8">
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl><RadioGroupItem value="Entire property" /></FormControl>
                          <FormLabel className="font-normal cursor-pointer">Entire property</FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl><RadioGroupItem value="Specific areas only" /></FormControl>
                          <FormLabel className="font-normal cursor-pointer">Specific areas only</FormLabel>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="typeOfWork"
                render={() => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Type of Work</FormLabel>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                      {typeOfWorkItems.map((item) => (
                        <FormField
                          key={item.id}
                          control={form.control}
                          name="typeOfWork"
                          render={({ field }) => {
                            return (
                              <FormItem key={item.id} className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4 has-[:checked]:bg-primary/10 has-[:checked]:border-primary transition-colors">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(item.id)}
                                    onCheckedChange={(checked) => {
                                      return checked
                                        ? field.onChange([...(field.value || []), item.id])
                                        : field.onChange(field.value?.filter((value) => value !== item.id))
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal flex items-center gap-2 cursor-pointer">{item.label}</FormLabel>
                              </FormItem>
                            )
                          }}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <AnimatePresence>
                {isInterior && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="sm:col-span-2 overflow-hidden space-y-8 pt-4"
                  >
                    <div className="space-y-4">
                      <FormLabel>Rooms to Paint (Interior)</FormLabel>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                        {roomOptions.map((room) => (
                          <FormField
                            key={room}
                            control={form.control}
                            name="roomsToPaint"
                            render={({ field }) => {
                              return (
                                <FormItem key={room} className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3 has-[:checked]:bg-primary/10 has-[:checked]:border-primary transition-colors bg-background">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value?.includes(room)}
                                      onCheckedChange={(checked) => {
                                        return checked
                                          ? field.onChange([...(field.value || []), room])
                                          : field.onChange(field.value?.filter((value) => value !== room))
                                      }}
                                    />
                                  </FormControl>
                                  <FormLabel className="font-normal cursor-pointer text-xs">{room}</FormLabel>
                                </FormItem>
                              )
                            }}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <FormLabel>Paint Areas (Interior)</FormLabel>
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

                    <AnimatePresence>
                      {watchTrimPaint && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.3 }}
                          className="overflow-hidden"
                        >
                          <div className="space-y-6 rounded-md border p-6 bg-accent/5">
                            <div className="flex items-center gap-2 text-lg font-semibold border-b pb-2">
                              <Palette className="h-5 w-5 text-primary" />
                              <span>Trim Paint Options</span>
                            </div>
                            <FormField
                              control={form.control}
                              name="trimPaintOptions.paintType"
                              render={({ field }) => (
                                <FormItem className="space-y-3">
                                  <FormLabel>Paint Type</FormLabel>
                                  <FormControl>
                                    <RadioGroup
                                      onValueChange={field.onChange}
                                      defaultValue={field.value}
                                      className="flex flex-col space-y-1"
                                    >
                                      <FormItem className="flex items-center space-x-3 space-y-0">
                                        <FormControl>
                                          <RadioGroupItem value="Oil-based" />
                                        </FormControl>
                                        <FormLabel className="font-normal cursor-pointer">Oil-based</FormLabel>
                                      </FormItem>
                                      <FormItem className="flex items-center space-x-3 space-y-0">
                                        <FormControl>
                                          <RadioGroupItem value="Water-based" />
                                        </FormControl>
                                        <FormLabel className="font-normal cursor-pointer">Water-based</FormLabel>
                                      </FormItem>
                                    </RadioGroup>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="trimPaintOptions.trimItems"
                              render={() => (
                                <FormItem>
                                  <div className="mb-4">
                                    <FormLabel className="text-base">Trim Items</FormLabel>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    {trimItems.map((item) => (
                                      <FormField
                                        key={item.id}
                                        control={form.control}
                                        name="trimPaintOptions.trimItems"
                                        render={({ field }) => {
                                          return (
                                            <FormItem
                                              key={item.id}
                                              className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4 has-[:checked]:bg-primary/10 has-[:checked]:border-primary transition-colors bg-background"
                                            >
                                              <FormControl>
                                                <Checkbox
                                                  checked={field.value?.includes(item.id)}
                                                  onCheckedChange={(checked) => {
                                                    return checked
                                                      ? field.onChange([...(field.value || []), item.id])
                                                      : field.onChange(
                                                          field.value?.filter(
                                                            (value) => value !== item.id
                                                          )
                                                        )
                                                  }}
                                                />
                                              </FormControl>
                                              <FormLabel className="font-normal flex items-center gap-2 cursor-pointer">
                                                <item.icon className="h-5 w-5" /> {item.label}
                                              </FormLabel>
                                            </FormItem>
                                          )
                                        }}
                                      />
                                    ))}
                                  </div>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {isExterior && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="sm:col-span-2 overflow-hidden pt-4"
                  >
                    <FormField
                      control={form.control}
                      name="exteriorAreas"
                      render={() => (
                        <FormItem>
                          <FormLabel>Exterior Areas</FormLabel>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                            {exteriorAreaOptions.map((item) => (
                              <FormField
                                key={item.id}
                                control={form.control}
                                name="exteriorAreas"
                                render={({ field }) => {
                                  return (
                                    <FormItem key={item.id} className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3 has-[:checked]:bg-primary/10 has-[:checked]:border-primary transition-colors">
                                      <FormControl>
                                        <Checkbox
                                          checked={field.value?.includes(item.id)}
                                          onCheckedChange={(checked) => {
                                            return checked
                                              ? field.onChange([...(field.value || []), item.id])
                                              : field.onChange(field.value?.filter((value) => value !== item.id))
                                          }}
                                        />
                                      </FormControl>
                                      <FormLabel className="font-normal flex items-center gap-2 cursor-pointer text-xs">
                                        <item.icon className="h-4 w-4" /> {item.label}
                                      </FormLabel>
                                    </FormItem>
                                  )
                                }}
                              />
                            ))}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <FormField
                  control={form.control}
                  name="propertyType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Property Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a property type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {propertyTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              <FormField
                control={form.control}
                name="approxSize"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Approx. size (sqm)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g. 100" {...field} value={field.value ?? ''} onChange={event => field.onChange(event.target.value === '' ? undefined : +event.target.value)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="existingWallColour"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Existing Wall Colour</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. White, Dark Blue" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

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
                            <FormControl><RadioGroupItem value="Maintenance or refresh" /></FormControl>
                            <FormLabel className="font-normal cursor-pointer">Maintenance or refresh</FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl><RadioGroupItem value="Preparing for sale or rental" /></FormControl>
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
                          <ShieldAlert className="h-5 w-5" /> Current paint condition
                        </FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="flex flex-col space-y-1"
                          >
                            {paintConditionOptions.map((option) => (
                              <FormItem key={option.id} className="flex items-center space-x-3 space-y-0">
                                <FormControl>
                                  <RadioGroupItem value={option.id} />
                                </FormControl>
                                <FormLabel className="font-normal cursor-pointer">
                                  {option.label}
                                </FormLabel>
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
                            <FormLabel className="text-base flex items-center gap-2"><TrendingUp className="h-5 w-5" /> Job Difficulty</FormLabel>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {jobDifficultyItems.map((item) => (
                            <FormField
                            key={item.id}
                            control={form.control}
                            name="jobDifficulty"
                            render={({ field }) => {
                                return (
                                <FormItem key={item.id} className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4 has-[:checked]:bg-primary/10 has-[:checked]:border-primary transition-colors">
                                    <FormControl>
                                    <Checkbox
                                        checked={field.value?.includes(item.id)}
                                        onCheckedChange={(checked) => {
                                        return checked
                                            ? field.onChange([...(field.value || []), item.id])
                                            : field.onChange(field.value?.filter((value) => value !== item.id))
                                        }}
                                    />
                                    </FormControl>
                                    <FormLabel className="font-normal flex items-center gap-2 cursor-pointer">
                                      <item.icon className="h-5 w-5" /> {item.label}
                                    </FormLabel>
                                </FormItem>
                                )
                            }}
                            />
                        ))}
                        </div>
                        <FormMessage />
                        </FormItem>
                    )}
                />

            </CardContent>
          </Card>

          <div className="space-y-4">
            <Button 
              type="submit" 
              size="lg" 
              className="w-full text-lg h-14" 
              disabled={isPending || (isLimitReached && !isAdmin) || isCountLoading}
            >
              {isPending ? (
                <Loader2 className="mr-2 h-6 w-6 animate-spin" />
              ) : (
                <WandSparkles className="mr-2 h-6 w-6" />
              )}
              {isLimitReached && !isAdmin ? 'Free Limit Reached' : isCountLoading ? 'Checking limits...' : 'Generate Estimate'}
            </Button>

            <div className="text-center p-4 rounded-xl border-2 border-primary/20 bg-primary/5 shadow-sm">
              <p className="text-sm font-medium flex items-center justify-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                <span>If you want to book Quote? Click</span>
                <a 
                  href={BOOKING_URL}
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary font-bold underline hover:text-primary/80 transition-colors inline-flex items-center gap-1"
                >
                  here
                </a>
              </p>
            </div>
            
            <div className="text-center text-sm font-medium p-2 rounded-lg bg-accent/10 border border-accent/20">
              {isCountLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" /> Syncing with database...
                </span>
              ) : isAdmin ? (
                <span className="text-primary font-bold">Unlimited access (Admin Dashboard Mode)</span>
              ) : (
                <>Remaining free estimates: <span className="text-primary font-bold">{Math.max(0, 2 - estimateCount)} / 2</span></>
              )}
            </div>
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
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary mb-4"/>
                <p className="text-muted-foreground">Our AI is crunching the numbers... This may take a few seconds.</p>
            </motion.div>
        )}
      </AnimatePresence>
      
      {state.data && <EstimateResult result={state.data} />}
    </>
  );
}
