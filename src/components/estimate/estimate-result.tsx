'use client';

import Image from 'next/image';
import type { GeneratePaintingEstimateOutput } from '@/ai/flows/generate-painting-estimate';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { motion } from 'framer-motion';
import { CheckCircle, DollarSign, Download, Home, Loader2, TreePine, Info, CalendarCheck, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';
import { useRef, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const BOOKING_URL = 'https://clienthub.getjobber.com/booking/3a242065-0473-4039-ac49-e0a471328f15/';

export interface EstimatePdfMeta {
  generatedAt?: string;
  recipientName?: string;
  recipientEmail?: string;
  location?: string;
  typeOfWork?: string[];
  referenceId?: string;
  verificationUrl?: string;
}

interface EstimateResultProps {
  result: GeneratePaintingEstimateOutput;
  pdfMeta?: EstimatePdfMeta;
}

function PriceBar({
  label,
  min,
  max,
  totalMax,
  icon: Icon,
  color,
  mode,
}: {
  label: string;
  min: number;
  max: number;
  totalMax: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  mode: 'screen' | 'pdf';
}) {
  const barWidthPct = Math.min(100, Math.round((max / (totalMax || 1)) * 100));
  const bgColor = color.replace('text-', 'bg-');

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5 font-medium text-foreground">
          <Icon className={cn('h-4 w-4', color)} />
          {label}
        </span>
        <span className="font-semibold text-foreground">
          AUD {min.toLocaleString('en-AU')} - {max.toLocaleString('en-AU')}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        {mode === 'pdf' ? (
          <div
            className={cn('h-full rounded-full', bgColor)}
            style={{ width: `${barWidthPct}%` }}
          />
        ) : (
          <motion.div
            className={cn('h-full rounded-full', bgColor)}
            initial={{ width: 0 }}
            animate={{ width: `${barWidthPct}%` }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          />
        )}
      </div>
    </div>
  );
}

function formatGeneratedAt(value?: string) {
  const date = value ? new Date(value) : new Date();

  if (Number.isNaN(date.getTime())) {
    return new Date().toLocaleString('en-AU', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return date.toLocaleString('en-AU', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function EstimateCard({
  result,
  mode,
  pdfMeta,
}: {
  result: GeneratePaintingEstimateOutput;
  mode: 'screen' | 'pdf';
  pdfMeta?: EstimatePdfMeta;
}) {
  const bd = result.breakdown;
  const hasBoth = !!bd?.interior && !!bd?.exterior;
  const visibleDetails = (result.details ?? []).filter(
    (detail) =>
      !detail.startsWith('Interior:') &&
      !detail.startsWith('Exterior:') &&
      !detail.startsWith('Total:')
  );
  const isPdf = mode === 'pdf';
  const generatedAt = formatGeneratedAt(pdfMeta?.generatedAt);

  return (
    <div
      className={cn(
        'space-y-4',
        isPdf && 'relative w-[794px] bg-white p-5 text-slate-900'
      )}
      style={isPdf ? { gap: 0 } : undefined}
    >
      {/* Watermark: logo image, opacity 5%, -15deg rotation */}
      {isPdf && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
          <img
            src="/logo-bg-remove.png"
            alt=""
            aria-hidden="true"
            className="w-[420px] object-contain"
            style={{ opacity: 0.05, transform: 'rotate(-15deg)' }}
            crossOrigin="anonymous"
          />
        </div>
      )}

      {/* PDF Header: dark slate background, logo left + QR right */}
      {isPdf && (
        <div
          className="relative z-10 mb-3 overflow-hidden rounded-xl"
          style={{ background: '#0f172a' }}
        >
          <div className="flex items-center justify-between gap-4 px-5 py-3">
            <div className="space-y-1">
              <img
                src="/PBCLOGO-Letter-removebg-preview.png"
                alt="PBC Painting"
                className="h-9 w-auto object-contain"
                style={{ filter: 'brightness(0) invert(1)' }}
                crossOrigin="anonymous"
              />
              <div>
                <p className="text-xs font-bold tracking-wide" style={{ color: '#f8fafc' }}>
                  AI Painting Estimate
                </p>
                <p className="text-[11px]" style={{ color: '#94a3b8' }}>
                  Indicative estimate prepared for the recipient below
                </p>
              </div>
            </div>
            <div className="flex flex-col items-center gap-1 rounded-lg bg-white p-2">
              <img
                src="/PBC-Booking QR Code.png"
                alt="PBC booking QR code"
                className="h-20 w-20 object-contain"
                crossOrigin="anonymous"
              />
              <p className="text-[9px] font-semibold" style={{ color: '#0f172a' }}>
                Scan to book free quote
              </p>
            </div>
          </div>
        </div>
      )}

      <Card className="relative z-10 border-primary/50 bg-primary/5 shadow-lg">
        <CardHeader className={isPdf ? 'pb-2 pt-3 px-4' : undefined}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <CardTitle className={cn('flex items-center gap-2 font-bold', isPdf ? 'text-lg' : 'text-2xl')}>
                <CheckCircle className={cn('text-primary', isPdf ? 'h-5 w-5' : 'h-6 w-6')} />
                Your Estimate is Ready!
              </CardTitle>
              {isPdf && pdfMeta?.referenceId && (
                <p className="mt-2 text-xs font-medium tracking-[0.18em] text-muted-foreground">
                  REF {pdfMeta.referenceId}
                </p>
              )}
            </div>

            {isPdf ? (
              <div className="grid min-w-[260px] grid-cols-2 gap-2 rounded-2xl border border-primary/10 bg-card p-3 text-xs shadow-sm">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Recipient</p>
                  <p className="mt-1 font-semibold text-foreground">{pdfMeta?.recipientName || 'Customer'}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Issued</p>
                  <p className="mt-1 font-semibold text-foreground">{generatedAt}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Email</p>
                  <p className="mt-1 break-all font-semibold text-foreground">
                    {pdfMeta?.recipientEmail || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Location</p>
                  <p className="mt-1 font-semibold text-foreground">{pdfMeta?.location || '-'}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <DollarSign className="h-6 w-6" />
                </div>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className={cn(isPdf ? 'space-y-3 px-4 pb-3' : 'space-y-6')}>
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              {result.pricingMeta?.mode === 'interior_itemized'
                ? 'Interior Trim Painting — Fixed Item Price'
                : hasBoth
                  ? 'Total Estimated Price Range'
                  : 'Estimated Price Range'}
            </p>
            <p className={cn('mt-1 font-bold text-primary', isPdf ? 'text-2xl' : 'text-3xl')}>
              {result.priceRange}{' '}
              <span className={cn('font-normal text-muted-foreground', isPdf ? 'text-base' : 'text-lg')}>(+GST)</span>
            </p>
            {isPdf && pdfMeta?.typeOfWork?.length ? (
              <p className="mt-2 text-sm font-medium text-muted-foreground">
                Scope: <span className="text-foreground">{pdfMeta.typeOfWork.join(' + ')}</span>
              </p>
            ) : null}
          </div>

          {hasBoth && bd?.interior && bd?.exterior && (
            <div className="space-y-3 border-t border-primary/10 pt-2">
              <p className="text-sm font-semibold text-foreground">Cost Breakdown</p>
              <PriceBar
                label="Interior Painting"
                min={bd.interior.min}
                max={bd.interior.max}
                totalMax={bd.total.max}
                icon={Home}
                color="text-primary"
                mode={mode}
              />
              <PriceBar
                label="Exterior Painting"
                min={bd.exterior.min}
                max={bd.exterior.max}
                totalMax={bd.total.max}
                icon={TreePine}
                color="text-primary"
                mode={mode}
              />
            </div>
          )}

          {!hasBoth && (bd?.interior || bd?.exterior) && (
            <div className="border-t border-primary/10 pt-2">
              {bd?.interior && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Home className="h-4 w-4 text-primary" />
                  <span>
                    Interior: <span className="font-semibold text-foreground">{bd.interior.priceRange}</span>
                  </span>
                </div>
              )}
              {bd?.exterior && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <TreePine className="h-4 w-4 text-primary" />
                  <span>
                    Exterior: <span className="font-semibold text-foreground">{bd.exterior.priceRange}</span>
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="border-t border-primary/10 pt-2">
            <p className="mb-1 text-sm font-medium text-muted-foreground">Explanation</p>
            <p className="text-sm leading-relaxed text-foreground">{result.explanation}</p>
          </div>

          {visibleDetails.length > 0 && (
            <div className="border-t border-primary/10 pt-2">
              <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                <Info className="h-4 w-4 text-primary" />
                Key Factors:
              </p>
              <ul className="space-y-1.5">
                {visibleDetails.map((detail, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary/60" />
                    {detail}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {isPdf && (
            <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <p className="font-semibold">Restricted use notice</p>
              <p className="mt-1 leading-relaxed">
                This document is an indicative AI estimate only for the named recipient and reference.
                It is not a final quote, invoice, or transferable approval document.
              </p>
              {pdfMeta?.verificationUrl ? (
                <p className="mt-1 text-xs text-destructive/80">Verification: {pdfMeta.verificationUrl}</p>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="relative z-10 px-4 text-center text-xs text-muted-foreground">
        This is an indicative estimate only. Final price is subject to site inspection. Prices are
        calibrated for the Northern Beaches / Sydney premium market.
      </p>

      {/* PDF Footer: small logo + ref ID + date */}
      {isPdf && (
        <div className="relative z-10 flex items-center justify-between border-t border-slate-200 pt-3 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-2">
            <img
              src="/logo-bg-remove.png"
              alt=""
              className="h-5 w-auto object-contain opacity-40"
              crossOrigin="anonymous"
            />
            <span>{pdfMeta?.referenceId ? `Ref: ${pdfMeta.referenceId}` : 'PBC Estimate'}</span>
          </div>
          <span>{generatedAt}</span>
        </div>
      )}
    </div>
  );
}

export function EstimateResult({ result, pdfMeta }: EstimateResultProps) {
  const exportRef = useRef<HTMLDivElement>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const { toast } = useToast();

  const handleDownloadPdf = async () => {
    if (!exportRef.current) return;

    setIsExportingPdf(true);

    try {
      const canvas = await html2canvas(exportRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: exportRef.current.scrollWidth,
        windowHeight: exportRef.current.scrollHeight,
      });

      const imageData = canvas.toDataURL('image/png', 1.0);
      const pdfDoc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdfDoc.internal.pageSize.getWidth();
      const pageHeight = pdfDoc.internal.pageSize.getHeight();

      const naturalWidth = pageWidth;
      const naturalHeight = (canvas.height * naturalWidth) / canvas.width;

      if (naturalHeight <= pageHeight) {
        // 한 페이지에 들어오면 그대로
        pdfDoc.addImage(imageData, 'PNG', 0, 0, naturalWidth, naturalHeight);
      } else {
        // 페이지 높이에 맞게 스케일다운 (여백 없이 꽉 채움)
        const scale = pageHeight / naturalHeight;
        const scaledWidth = naturalWidth * scale;
        const xOffset = (pageWidth - scaledWidth) / 2;
        pdfDoc.addImage(imageData, 'PNG', xOffset, 0, scaledWidth, pageHeight);
      }

      const dateSuffix = (pdfMeta?.generatedAt ?? new Date().toISOString()).slice(0, 10);
      const fileReference = (pdfMeta?.referenceId ?? 'estimate').toLowerCase();
      pdfDoc.save(`pbc-${fileReference}-${dateSuffix}.pdf`);
    } catch (error) {
      console.error('Failed to export estimate PDF:', error);
      toast({
        variant: 'destructive',
        title: 'PDF export failed',
        description: 'Failed to create the PDF file. Please try again.',
      });
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="mt-8 space-y-4"
      >
        <EstimateCard result={result} mode="screen" pdfMeta={pdfMeta} />

        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDownloadPdf}
            disabled={isExportingPdf}
            className="w-full sm:w-auto"
          >
            {isExportingPdf ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Download PDF
          </Button>
        </div>

        {/* Booking CTA — screen only */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.35, ease: 'easeOut' }}
          className="overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary/80 shadow-lg"
        >
          <div className="flex flex-col items-start justify-between gap-6 p-6 sm:flex-row sm:items-center sm:p-8">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <CalendarCheck className="h-6 w-6 text-white" />
                <h3 className="text-xl font-extrabold text-white">
                  Ready for an accurate final quote?
                </h3>
              </div>
              <p className="max-w-md text-sm text-white/80">
                Your AI estimate is a great starting point. Lock in the best price with a FREE
                on-site assessment — our painter comes to you, measures up, and gives you a firm
                written quote.
              </p>
              <Button
                asChild
                className="mt-4 w-full bg-white text-primary shadow-md hover:bg-white/90 hover:shadow-lg sm:w-auto"
              >
                <a
                  href={BOOKING_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3.5 text-sm font-bold sm:py-4"
                >
                  Book Free On-Site Quote
                  <ArrowRight className="h-4 w-4" />
                </a>
              </Button>
              <p className="pt-1 text-xs text-white/60">
                Takes less than 60 seconds to book &bull; No obligation
              </p>
            </div>

            {/* QR code — desktop only */}
            <div className="hidden shrink-0 sm:block">
              <div className="rounded-xl bg-white p-3 shadow-inner">
                <Image
                  src="/PBC-Booking QR Code.png"
                  alt="Scan to book a free on-site quote"
                  width={120}
                  height={120}
                  className="rounded-lg"
                />
                <p className="mt-2 text-center text-xs font-medium text-gray-500">
                  Scan to book
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>

      <div className="pointer-events-none fixed left-[-99999px] top-0">
        <div ref={exportRef}>
          <EstimateCard result={result} mode="pdf" pdfMeta={pdfMeta} />
        </div>
      </div>
    </>
  );
}
