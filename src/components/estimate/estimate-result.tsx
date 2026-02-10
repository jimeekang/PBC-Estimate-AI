'use client';

import type { GeneratePaintingEstimateOutput } from '@/ai/flows/generate-painting-estimate';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { motion } from 'framer-motion';
import { CheckCircle, DollarSign } from 'lucide-react';

interface EstimateResultProps {
  result: GeneratePaintingEstimateOutput;
}

export function EstimateResult({ result }: EstimateResultProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="mt-8"
    >
      <Card className="shadow-lg border-primary/50 bg-primary/5">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl font-bold flex items-center gap-2">
                <CheckCircle className="h-8 w-8 text-primary"/>
                Your Estimate is Ready!
            </CardTitle>
            <div className="flex items-center justify-center h-12 w-12 rounded-full bg-primary text-primary-foreground">
              <DollarSign className="h-6 w-6" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Estimated Price Range</p>
            <p className="text-3xl font-bold text-primary">{result.priceRange}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Explanation</p>
            <p className="text-foreground">{result.explanation}</p>
          </div>
          {result.details && result.details.length > 0 && (
            <div className="pt-4 border-t border-primary/10">
                <p className="text-sm font-semibold mb-2">Key Factors:</p>
                <ul className="list-disc pl-5 space-y-1">
                    {result.details.map((detail, index) => (
                        <li key={index} className="text-sm text-muted-foreground">{detail}</li>
                    ))}
                </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
