'use client';

import type { GeneratePaintingEstimateOutput } from '@/ai/flows/generate-painting-estimate';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { motion } from 'framer-motion';
import { CheckCircle, DollarSign, Home, TreePine, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EstimateResultProps {
  result: GeneratePaintingEstimateOutput;
}

function PriceBar({ label, min, max, totalMax, icon: Icon, color }: {
  label: string;
  min: number;
  max: number;
  totalMax: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  const barWidthPct = Math.min(100, Math.round((max / (totalMax || 1)) * 100));
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5 font-medium text-foreground">
          <Icon className={cn('h-4 w-4', color)} />
          {label}
        </span>
        <span className="font-semibold text-foreground">
          AUD {min.toLocaleString('en-AU')} – {max.toLocaleString('en-AU')}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', color.replace('text-', 'bg-'))}
          initial={{ width: 0 }}
          animate={{ width: `${barWidthPct}%` }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

export function EstimateResult({ result }: EstimateResultProps) {
  const bd = result.breakdown;
  const hasBoth = !!bd?.interior && !!bd?.exterior;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="mt-8 space-y-4"
    >
      {/* Main price card */}
      <Card className="shadow-lg border-primary/50 bg-primary/5">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl font-bold flex items-center gap-2">
              <CheckCircle className="h-8 w-8 text-primary" />
              Your Estimate is Ready!
            </CardTitle>
            <div className="flex items-center justify-center h-12 w-12 rounded-full bg-primary text-primary-foreground">
              <DollarSign className="h-6 w-6" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Total price */}
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              {hasBoth ? 'Total Estimated Price Range' : 'Estimated Price Range'}
            </p>
            <p className="text-3xl font-bold text-primary mt-1">{result.priceRange}</p>
          </div>

          {/* Interior + Exterior breakdown bars */}
          {hasBoth && bd?.interior && bd?.exterior && (
            <div className="pt-2 border-t border-primary/10 space-y-3">
              <p className="text-sm font-semibold text-foreground">Cost Breakdown</p>
              <PriceBar
                label="Interior Painting"
                min={bd.interior.min}
                max={bd.interior.max}
                totalMax={bd.total.max}
                icon={Home}
                color="text-blue-500"
              />
              <PriceBar
                label="Exterior Painting"
                min={bd.exterior.min}
                max={bd.exterior.max}
                totalMax={bd.total.max}
                icon={TreePine}
                color="text-emerald-500"
              />
            </div>
          )}

          {/* Single type breakdown (interior or exterior only) */}
          {!hasBoth && (bd?.interior || bd?.exterior) && (
            <div className="pt-2 border-t border-primary/10">
              {bd?.interior && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Home className="h-4 w-4 text-blue-500" />
                  <span>Interior: <span className="font-semibold text-foreground">{bd.interior.priceRange}</span></span>
                </div>
              )}
              {bd?.exterior && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <TreePine className="h-4 w-4 text-emerald-500" />
                  <span>Exterior: <span className="font-semibold text-foreground">{bd.exterior.priceRange}</span></span>
                </div>
              )}
            </div>
          )}

          {/* Explanation */}
          <div className="pt-2 border-t border-primary/10">
            <p className="text-sm font-medium text-muted-foreground mb-1">Explanation</p>
            <p className="text-foreground text-sm leading-relaxed">{result.explanation}</p>
          </div>

          {/* Key factors */}
          {result.details && result.details.length > 0 && (
            <div className="pt-2 border-t border-primary/10">
              <p className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <Info className="h-4 w-4 text-primary" />
                Key Factors:
              </p>
              <ul className="space-y-1.5">
                {result.details
                  .filter(d => !d.startsWith('Interior:') && !d.startsWith('Exterior:') && !d.startsWith('Total:'))
                  .map((detail, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary/60 flex-shrink-0" />
                      {detail}
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Disclaimer */}
      <p className="text-xs text-muted-foreground text-center px-4">
        This is an indicative estimate only. Final price is subject to site inspection.
        Prices are calibrated for the Northern Beaches / Sydney premium market.
      </p>
    </motion.div>
  );
}
