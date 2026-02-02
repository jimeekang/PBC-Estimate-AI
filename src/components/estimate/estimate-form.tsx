'use client';

import { useForm, Controller } from 'react-hook-form';
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
} from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Baseline,
  DoorOpen,
  Loader2,
  PaintRoller,
  Paintbrush,
  Palette,
  RectangleHorizontal,
  WandSparkles,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { submitEstimate } from '@/app/estimate/actions';
import { useState } from 'react';
import { EstimateResult } from './estimate-result';
import type { GeneratePaintingEstimateOutput } from '@/ai/flows/generate-painting-estimate';
import { useToast } from '@/hooks/use-toast';

const trimItems = [
  { id: 'Doors', label: 'Doors', icon: DoorOpen },
  { id: 'Window Frames', label: 'Window Frames', icon: RectangleHorizontal },
  { id: 'Skirting Boards', label: 'Skirting Boards', icon: Baseline },
] as const;

const estimateFormSchema = z.object({
  paintAreas: z.object({
    ceilingPaint: z.boolean().default(false),
    wallPaint: z.boolean().default(false),
    trimPaint: z.boolean().default(false),
  }).default({}),
  trimPaintOptions: z.object({
    paintType: z.enum(['Oil-based', 'Water-based']),
    trimItems: z.array(z.enum(['Doors', 'Window Frames', 'Skirting Boards'])).min(1, 'Please select at least one trim item.'),
  }).optional(),
}).refine(data => {
    return !data.paintAreas.trimPaint || (data.paintAreas.trimPaint && data.trimPaintOptions);
}, {
    message: 'Please select trim paint options',
    path: ['trimPaintOptions'],
}).refine(data => data.paintAreas.ceilingPaint || data.paintAreas.wallPaint || data.paintAreas.trimPaint, {
    message: 'Please select at least one area to paint.',
    path: ['paintAreas'],
});

type EstimateFormValues = z.infer<typeof estimateFormSchema>;

export function EstimateForm() {
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
    },
  });

  const watchTrimPaint = form.watch('paintAreas.trimPaint');

  async function onSubmit(values: EstimateFormValues) {
    setIsPending(true);
    const result = await submitEstimate({}, values);
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
                <Paintbrush className="h-6 w-6 text-primary" />
                <span>Paint Areas</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="paintAreas.ceilingPaint"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4 hover:bg-accent/50 transition-colors">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="flex items-center gap-2 cursor-pointer">
                        <PaintRoller className="h-5 w-5" /> Ceiling Paint
                      </FormLabel>
                    </div>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="paintAreas.wallPaint"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4 hover:bg-accent/50 transition-colors">
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
                  <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4 hover:bg-accent/50 transition-colors">
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
              {form.formState.errors.paintAreas && <p className="text-sm text-destructive">{form.formState.errors.paintAreas.message}</p>}
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
                             {form.formState.errors.trimPaintOptions?.trimItems && <p className="text-sm text-destructive mt-2">{form.formState.errors.trimPaintOptions?.trimItems.message}</p>}
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
