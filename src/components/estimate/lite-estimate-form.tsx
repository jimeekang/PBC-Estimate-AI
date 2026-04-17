'use client';

import { useEffect, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  liteEstimateSchema,
  type LiteEstimateRequest,
} from '@/schemas/estimate-lite';
import { submitLiteEstimate } from '@/app/lite-estimate/actions';
import type { GeneratePaintingEstimateOutput } from '@/ai/flows/generate-painting-estimate';
import { EstimateResult } from '@/components/estimate/estimate-result';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Toaster } from '@/components/ui/toaster';
import { AlertCircle, Loader2, Sparkles } from 'lucide-react';

const workTypeOptions = [
  { value: 'Interior Painting', label: 'Interior' },
  { value: 'Exterior Painting', label: 'Exterior' },
  { value: 'Interior + Exterior', label: 'Interior + Exterior' },
] as const;

const propertyTypeOptions = [
  { value: 'House / Townhouse', label: 'House / Townhouse' },
  { value: 'Apartment', label: 'Apartment' },
] as const;

const apartmentOptions = [
  { value: 'Studio', label: 'Studio' },
  { value: '1Bed', label: '1 bed apartment' },
  { value: '2Bed2Bath', label: '2 bed / 2 bath apartment' },
  { value: '3Bed2Bath', label: '3 bed / 2 bath apartment' },
] as const;

const storyOptions = ['1 storey', '2 storey', '3 storey'] as const;
const wallTypeOptions = ['cladding', 'rendered', 'brick'] as const;
const conditionOptions = ['Excellent', 'Fair', 'Poor'] as const;

export function LiteEstimateForm() {
  const [result, setResult] = useState<GeneratePaintingEstimateOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const form = useForm<LiteEstimateRequest>({
    resolver: zodResolver(liteEstimateSchema),
    defaultValues: {
      workType: 'Interior Painting',
      propertyType: 'House / Townhouse',
      approxSize: 140,
      bedroomCount: 3,
      bathroomCount: 2,
      houseStories: '1 storey',
      wallType: 'cladding',
      paintCondition: 'Fair',
      location: '',
    },
  });

  const workType = form.watch('workType');
  const propertyType = form.watch('propertyType');
  const hasExterior =
    workType === 'Exterior Painting' || workType === 'Interior + Exterior';
  const isApartment = propertyType === 'Apartment';

  useEffect(() => {
    if (hasExterior && propertyType === 'Apartment') {
      form.setValue('propertyType', 'House / Townhouse', { shouldValidate: true });
    }
  }, [form, hasExterior, propertyType]);

  const onSubmit = (values: LiteEstimateRequest) => {
    setError(null);

    startTransition(async () => {
      const response = await submitLiteEstimate(values);
      if (response.error) {
        setResult(null);
        setError(response.error);
        return;
      }

      setResult(response.data ?? null);
    });
  };

  return (
    <>
      <Card className="border-primary/15 shadow-lg">
        <CardHeader className="space-y-3">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl">Quick Price Guide</CardTitle>
            <p className="text-sm text-muted-foreground">
              Answer a few questions to get a fast whole-property guide. If you already want the
              real number, booking online is still the fastest path to a firm written quote.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="workType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Work type</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select work type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {workTypeOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="propertyType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Property type</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={hasExterior}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select property type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {propertyTypeOptions
                            .filter((option) => !hasExterior || option.value === 'House / Townhouse')
                            .map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
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
                      <FormLabel>Approx size (sqm)</FormLabel>
                      <FormControl>
                        <Input type="number" min={30} max={1200} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="paintCondition"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current paint condition</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select condition" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {conditionOptions.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {isApartment ? (
                  <FormField
                    control={form.control}
                    name="apartmentStructure"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Apartment layout</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Optional layout hint" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {apartmentOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : (
                  <>
                    <FormField
                      control={form.control}
                      name="bedroomCount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bedrooms</FormLabel>
                          <FormControl>
                            <Input type="number" min={1} max={8} {...field} />
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
                          <FormLabel>Bathrooms</FormLabel>
                          <FormControl>
                            <Input type="number" min={1} max={6} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}

                {hasExterior ? (
                  <>
                    <FormField
                      control={form.control}
                      name="houseStories"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Storeys</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select storeys" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {storyOptions.map((option) => (
                                <SelectItem key={option} value={option}>
                                  {option}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="wallType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Main wall finish</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select wall finish" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {wallTypeOptions.map((option) => (
                                <SelectItem key={option} value={option}>
                                  {option.charAt(0).toUpperCase() + option.slice(1)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                ) : null}

                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Suburb or area</FormLabel>
                      <FormControl>
                        <Input placeholder="Optional, e.g. Manly NSW" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {error ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Quick estimate failed</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Calculating...
                  </>
                ) : (
                  'Generate Quick Price Guide'
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {result ? <EstimateResult result={result} /> : null}
      <Toaster />
    </>
  );
}
