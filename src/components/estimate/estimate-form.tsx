'use client';

import { useForm } from 'react-hook-form';
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
  Baseline,
  DoorOpen,
  Layers,
  Loader2,
  PaintRoller,
  Paintbrush,
  Palette,
  RectangleHorizontal,
  ShieldAlert,
  TrendingUp,
  User,
  WandSparkles,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { submitEstimate } from '@/app/estimate/actions';
import { useState } from 'react';
import { EstimateResult } from './estimate-result';
import type { GeneratePaintingEstimateOutput } from '@/ai/flows/generate-painting-estimate';
import { useToast } from '@/hooks/use-toast';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useAuth } from '@/providers/auth-provider';

const trimItems = [
  { id: 'Doors', label: 'Doors', icon: DoorOpen },
  { id: 'Window Frames', label: 'Window Frames', icon: RectangleHorizontal },
  { id: 'Skirting Boards', label: 'Skirting Boards', icon: Baseline },
] as const;

const wallConditionItems = [
  { id: 'Cracks', label: 'Cracks' },
  { id: 'Mould', label: 'Mould' },
  { id: 'Stains or contamination', label: 'Stains or contamination' },
] as const;

const jobDifficultyItems = [
  { id: 'Stairs', label: 'Stairs' },
  { id: 'High ceilings', label: 'High ceilings' },
  { id: 'Extensive mouldings or trims', label: 'Extensive mouldings or trims' },
  { id: 'Difficult access areas', label: 'Difficult access areas' },
] as const;

const propertyTypes = ['Apartment', 'House', 'Townhouse', 'Office', 'Other'];

const typeOfWorkItems = [
  { id: 'Interior Painting', label: 'Interior Painting' },
  { id: 'Exterior Painting', label: 'Exterior Painting' },
] as const;

const estimateFormSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  email: z.string().email('Invalid email address.'),
  phone: z.string().optional(),
  typeOfWork: z.array(z.enum(['Interior Painting', 'Exterior Painting'])).min(1, 'Please select at least one type of work.'),
  scopeOfPainting: z.enum(['Full painting', 'Partial painting']),
  propertyType: z.string().min(1, 'Property type is required.'),
  numberOfRooms: z.coerce.number().positive().optional(),
  approxSize: z.coerce.number().positive().optional(),
  existingWallColour: z.string().optional(),
  location: z.string().optional(),
  timingPurpose: z.enum(['Ready to proceed', 'Budget only']),
  wallCondition: z.array(z.enum(['Cracks', 'Mould', 'Stains or contamination'])).optional(),
  jobDifficulty: z.array(z.enum(['Stairs', 'High ceilings', 'Extensive mouldings or trims', 'Difficult access areas'])).optional(),

  paintAreas: z.object({
    ceilingPaint: z.boolean().default(false),
    wallPaint: z.boolean().default(false),
    trimPaint: z.boolean().default(false),
  }).default({}),
  trimPaintOptions: z.object({
    paintType: z.enum(['Oil-based', 'Water-based']),
    trimItems: z.array(z.enum(['Doors', 'Window Frames', 'Skirting Boards'])).min(1, 'Please select at least one trim item.'),
  }).optional(),
});

type EstimateFormValues = z.infer<typeof estimateFormSchema>;

export function EstimateForm() {
  const { user } = useAuth();
  const [state, setState] = useState<{data?: GeneratePaintingEstimateOutput, error?: string}>({});
  const [isPending, setIsPending] = useState(false);
  const { toast } = useToast();

  const form = useForm<EstimateFormValues>({
    resolver: zodResolver(estimateFormSchema),
    defaultValues: {
      paintAreas: {
        ceilingPaint: false,
        wallPaint: false,
        trimPaint: false,
      },
      name: '',
      email: '',
      phone: '',
      typeOfWork: [],
      scopeOfPainting: 'Full painting',
      propertyType: '',
      existingWallColour: '',
      location: '',
      timingPurpose: 'Ready to proceed',
      wallCondition: [],
      jobDifficulty: [],
    },
  });

  const watchTrimPaint = form.watch('paintAreas.trimPaint');

  async function onSubmit(values: EstimateFormValues) {
    setIsPending(true);
    const result = await submitEstimate(values, user?.uid);
    if(result.error) {
        toast({
            variant: "destructive",
            title: "Error",
            description: result.error,
        })
    }
    setState(result);
    setIsPending(false);
  }

  return (
    <>
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
                    <FormLabel>Phone Number (Optional)</FormLabel>
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
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Sydney Northern Beaches" {...field} />
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
                    <Paintbrush className="h-6 w-6 text-primary" />
                    <span>Job Details</span>
                </CardTitle>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-x-6 gap-y-8">
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
              <FormField
                control={form.control}
                name="scopeOfPainting"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>Scope of Painting</FormLabel>
                    <FormControl>
                      <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col space-y-1">
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl><RadioGroupItem value="Full painting" /></FormControl>
                          <FormLabel className="font-normal">Full painting</FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl><RadioGroupItem value="Partial painting" /></FormControl>
                          <FormLabel className="font-normal">Partial painting</FormLabel>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
                  </FormItem>
                )}
              />
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
                    name="timingPurpose"
                    render={({ field }) => (
                    <FormItem className="space-y-3">
                        <FormLabel>Timing / Purpose</FormLabel>
                        <FormControl>
                        <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col space-y-1">
                            <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl><RadioGroupItem value="Ready to proceed" /></FormControl>
                            <FormLabel className="font-normal">Ready to proceed</FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl><RadioGroupItem value="Budget only" /></FormControl>
                            <FormLabel className="font-normal">Budget only</FormLabel>
                            </FormItem>
                        </RadioGroup>
                        </FormControl>
                    </FormItem>
                    )}
              />
              <FormField
                control={form.control}
                name="numberOfRooms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Number of rooms</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g. 3" {...field} value={field.value ?? ''} onChange={event => field.onChange(event.target.value === '' ? undefined : +event.target.value)} />
                    </FormControl>
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
                  <FormItem className="sm:col-span-2">
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
                <span>Areas & Conditions</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-4">
                    <FormLabel>Paint Areas</FormLabel>
                    <div className="space-y-2 rounded-md border p-4">
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
                                    <PaintRoller className="h-5 w-5" /> Ceiling Painting
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
                                    <Paintbrush className="h-5 w-5" /> Wall Paint
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
                                    <Palette className="h-5 w-5" /> Trim Paint
                                </FormLabel>
                                </div>
                            </FormItem>
                            )}
                        />
                    </div>
                </div>

                <FormField
                    control={form.control}
                    name="wallCondition"
                    render={() => (
                        <FormItem>
                        <div className="mb-4">
                            <FormLabel className="text-base flex items-center gap-2"><ShieldAlert /> Wall Condition</FormLabel>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {wallConditionItems.map((item) => (
                            <FormField
                            key={item.id}
                            control={form.control}
                            name="wallCondition"
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
                <FormField
                    control={form.control}
                    name="jobDifficulty"
                    render={() => (
                        <FormItem>
                        <div className="mb-4">
                            <FormLabel className="text-base flex items-center gap-2"><TrendingUp /> Job Difficulty</FormLabel>
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

            </CardContent>
          </Card>

          <AnimatePresence>
            {watchTrimPaint && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="shadow-md">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Palette className="h-6 w-6 text-primary" />
                        <span>Trim Paint Options</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
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
                                <FormLabel className="font-normal">Oil-based</FormLabel>
                              </FormItem>
                              <FormItem className="flex items-center space-x-3 space-y-0">
                                <FormControl>
                                  <RadioGroupItem value="Water-based" />
                                </FormControl>
                                <FormLabel className="font-normal">Water-based</FormLabel>
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
                                <FormDescription>
                                Select which trim items you want to be painted.
                                </FormDescription>
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
                                        className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4 has-[:checked]:bg-primary/10 has-[:checked]:border-primary transition-colors"
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
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          <Button type="submit" size="lg" className="w-full text-lg" disabled={isPending}>
            {isPending ? (
              <Loader2 className="mr-2 h-6 w-6 animate-spin" />
            ) : (
              <WandSparkles className="mr-2 h-6 w-6" />
            )}
            Generate Estimate
          </Button>
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
                <p className="text-muted-foreground">Our AI is crunching the numbers... Please wait.</p>
            </motion.div>
        )}
      </AnimatePresence>
      
      {state.data && <EstimateResult result={state.data} />}
    </>
  );
}
