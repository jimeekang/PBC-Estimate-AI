'use server';

/**
 * @fileOverview Data-driven AI agent to estimate the painting price range.
 * 
 * Based on historical quote data analysis:
 * - Interior only: $2,500 - $8,000
 * - Exterior only: $6,500 - $16,000
 * - Combined: $12,000 - $30,000
 * - Hard Cap: $35,000
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// --- 데이터 기반 기준가 (Anchors) ---
const ANCHORS = {
  Interior: { min: 2500, max: 8000, median: 3000 },
  Exterior: { min: 6500, max: 16000, median: 10650 },
  InteriorExterior: { min: 12000, max: 30000, median: 19000 }
};

const MAX_PRICE_CAP = 35000;

// --- Interior 로직 상수 ---
const ROOM_WEIGHT: Record<string, number> = {
  "Bedroom 1": 1.0,
  "Bedroom 2": 1.0,
  "Bedroom 3": 1.0,
  "Bathroom": 1.1,
  "Kitchen": 1.3,
  "Livingroom": 1.4,
  "Lounge": 1.2,
  "Laundry": 0.7,
  "Etc": 0.6
};

const BASE_ROOM_SCORE = 3.0; // Standard 2-3 room baseline

const AREA_SHARE = {
  ceilingPaint: 0.25,
  wallPaint: 0.55,
  trimPaint: 0.20
};

const TRIM_TYPE_MULTIPLIER = {
  "Oil-based": { min: 1.00, max: 1.05 },
  "Water-based": { min: 1.10, max: 1.25 } // Water-based is more expensive as per requirements
};

const TRIM_ITEM_RATES = {
  "Doors": { min: 120, max: 220 },
  "Window Frames": { min: 90, max: 180 },
  "Skirting Boards": { min: 6 * 16, max: 12 * 16 }
};

// --- Exterior 로직 상수 ---
const EXTERIOR_ITEM_BASE: Record<string, { min: number, max: number }> = {
  "Wall": { min: 2500, max: 9000 },
  "Eaves": { min: 1200, max: 3500 },
  "Gutter": { min: 600, max: 1800 },
  "Fascia": { min: 900, max: 2600 },
  "Exterior Trim": { min: 700, max: 2400 }
};

const EXTERIOR_RISK_MULTIPLIER = { min: 1.10, max: 1.30 };

const EXTERIOR_SIZE_BANDS = [
  { minSqm: 0, maxSqm: 120, minMult: 0.95, maxMult: 1.05 },
  { minSqm: 121, maxSqm: 200, minMult: 1.00, maxMult: 1.15 },
  { minSqm: 201, maxSqm: 1000, minMult: 1.10, maxMult: 1.30 }
];

// --- 공통 보정 상수 ---
const CONDITION_MULTIPLIER = {
  "Excellent": { min: 0.95, max: 1.05 },
  "Fair": { min: 1.10, max: 1.25 },
  "Poor": { min: 1.25, max: 1.60 }
};

const DIFFICULTY_ADDON = {
  "Stairs": { min: 300, max: 900 },
  "High ceilings": { min: 300, max: 1200 },
  "Extensive mouldings or trims": { min: 250, max: 900 },
  "Difficult access areas": { min: 400, max: 1500 }
};

// --- Schema 정의 ---

const GeneratePaintingEstimateInputSchema = z.object({
  name: z.string(),
  email: z.string(),
  phone: z.string().optional(),
  typeOfWork: z.array(z.enum(['Interior Painting', 'Exterior Painting'])),
  scopeOfPainting: z.enum(['Entire property', 'Specific areas only']),
  propertyType: z.string(),
  roomsToPaint: z.array(z.string()).optional(),
  exteriorAreas: z.array(z.string()).optional(),
  approxSize: z.number().optional(),
  location: z.string().optional(),
  timingPurpose: z.enum(['Maintenance or refresh', 'Preparing for sale or rental']),
  paintCondition: z.enum(['Excellent', 'Fair', 'Poor']).optional(),
  jobDifficulty: z.array(z.enum(['Stairs', 'High ceilings', 'Extensive mouldings or trims', 'Difficult access areas'])).optional(),
  paintAreas: z.object({
    ceilingPaint: z.boolean(),
    wallPaint: z.boolean(),
    trimPaint: z.boolean(),
  }),
  trimPaintOptions: z.optional(z.object({
    paintType: z.enum(['Oil-based', 'Water-based']),
    trimItems: z.array(z.enum(['Doors', 'Window Frames', 'Skirting Boards'])),
  })),
});

const GeneratePaintingEstimateOutputSchema = z.object({
  priceRange: z.string(),
  explanation: z.string(),
  details: z.array(z.string()).optional(),
});

export type GeneratePaintingEstimateInput = z.infer<typeof GeneratePaintingEstimateInputSchema>;
export type GeneratePaintingEstimateOutput = z.infer<typeof GeneratePaintingEstimateOutputSchema>;

// --- AI 프롬프트 정의 ---

const explanationPrompt = ai.definePrompt({
  name: 'explanationPrompt',
  input: { 
    schema: z.object({
      input: GeneratePaintingEstimateInputSchema,
      priceMin: z.number(),
      priceMax: z.number()
    })
  },
  output: { schema: GeneratePaintingEstimateOutputSchema },
  prompt: `
  You are a professional painting estimator in Australia for "Paint Buddy & Co".
  Your role is to clearly explain why a specific price range was generated, based strictly on the calculation inputs provided.

  # CONTEXT
  - Property type: {{input.propertyType}}
  - Scope: {{input.scopeOfPainting}}
  - Work type: {{#each input.typeOfWork}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}
  - Approx Size: {{#if input.approxSize}}{{input.approxSize}} sqm{{else}}Not specified{{/if}}
  - Paint Condition: {{#if input.paintCondition}}{{input.paintCondition}}{{else}}Fair{{/if}}

  # GENERATED PRICE DATA (AUD)
  Min: {{priceMin}}
  Max: {{priceMax}}

  # INSTRUCTIONS
  1. **explanation**: Write a professional summary (3-5 sentences). 
     - Mention main cost drivers (scope, size, condition, trim detail, and access complexity).
     - If priceMax is at the cap of 35,000, emphasize that this is a large-scale project requiring a detailed site inspection for a final quote.
     - Use Australian English.
     - Do NOT mention internal formulas, weights, or algorithms.
     - Be transparent and build trust.
     - Clearly state that this is an "indicative estimate" subject to site inspection.
  2. **priceRange**: 
     - If priceMax >= 35,000, format as "From AUD {{priceMin}}+ (Site Inspection Required)".
     - Otherwise, format as "AUD {{priceMin}} - {{priceMax}}".
  3. **details**: Provide a bulleted list of 3-5 key factors specific to this job.
  `
});

// --- Flow 정의 ---

export const generatePaintingEstimate = ai.defineFlow(
  {
    name: 'generatePaintingEstimateFlow',
    inputSchema: GeneratePaintingEstimateInputSchema,
    outputSchema: GeneratePaintingEstimateOutputSchema,
  },
  async (input) => {
    const isInt = input.typeOfWork.includes('Interior Painting');
    const isExt = input.typeOfWork.includes('Exterior Painting');
    const isBoth = isInt && isExt;

    let intMin = 0;
    let intMax = 0;
    let extMin = 0;
    let extMax = 0;

    // --- 1) Interior 계산 모듈 ---
    if (isInt) {
      const anchor = ANCHORS.Interior;
      let baseMin = anchor.min;
      let baseMax = anchor.max;

      // Room Score 보정
      const roomScore = (input.roomsToPaint || []).reduce((sum, room) => sum + (ROOM_WEIGHT[room] || 0.6), 0);
      const roomFactor = Math.max(0.6, Math.min(2.5, roomScore / BASE_ROOM_SCORE));
      
      baseMin *= roomFactor;
      baseMax *= roomFactor;

      // Area Share 보정
      let areaFactor = 0;
      if (input.paintAreas.ceilingPaint) areaFactor += AREA_SHARE.ceilingPaint;
      if (input.paintAreas.wallPaint) areaFactor += AREA_SHARE.wallPaint;
      if (input.paintAreas.trimPaint) areaFactor += AREA_SHARE.trimPaint;
      areaFactor = areaFactor > 0 ? areaFactor : 1.0;
      
      intMin = baseMin * areaFactor;
      intMax = baseMax * areaFactor;
    }

    // --- 2) Exterior 계산 모듈 ---
    if (isExt) {
      let extSumMin = 0;
      let extSumMax = 0;

      // 항목별 합산
      (input.exteriorAreas || []).forEach(area => {
        const base = EXTERIOR_ITEM_BASE[area];
        if (base) {
          extSumMin += base.min;
          extSumMax += base.max;
        }
      });

      // 리스크 및 사이즈 가중치
      let extRiskedMin = extSumMin * EXTERIOR_RISK_MULTIPLIER.min;
      let extRiskedMax = extSumMax * EXTERIOR_RISK_MULTIPLIER.max;

      if (input.approxSize) {
        const band = EXTERIOR_SIZE_BANDS.find(b => input.approxSize! >= b.minSqm && input.approxSize! <= b.maxSqm) 
                   || EXTERIOR_SIZE_BANDS[EXTERIOR_SIZE_BANDS.length - 1];
        extRiskedMin *= band.minMult;
        extRiskedMax *= band.maxMult;
      }

      // Full Exterior Package 룰 ($6.5k floor)
      const requiredItems = ["Wall", "Eaves", "Gutter", "Fascia", "Exterior Trim"];
      const isFullExt = requiredItems.every(item => (input.exteriorAreas || []).includes(item));

      if (isFullExt) {
        extRiskedMin = Math.max(extRiskedMin, ANCHORS.Exterior.min);
        extRiskedMax = Math.max(extRiskedMax, ANCHORS.Exterior.min * 1.3);
      }

      extMin = extRiskedMin;
      extMax = extRiskedMax;
    }

    // --- 3) 최종 합산 및 결합 보정 ---
    let totalMin = intMin + extMin;
    let totalMax = intMax + extMax;

    // Interior + Exterior 결합 시 데이터 기반 최소/최대 보정
    if (isBoth) {
      totalMin = Math.max(totalMin, ANCHORS.InteriorExterior.min);
      if (totalMax < ANCHORS.InteriorExterior.median) {
        totalMax = ANCHORS.InteriorExterior.median * 1.2;
      }
    }

    // --- 4) 추가 항목 (Trim, Condition, Difficulty) ---

    // Trim 세부 할증 (Interior 선택 시)
    if (input.paintAreas.trimPaint && input.trimPaintOptions) {
      const roomCount = input.roomsToPaint?.length || 1;
      const { paintType, trimItems } = input.trimPaintOptions;
      let itemsBaseMin = 0;
      let itemsBaseMax = 0;
      
      trimItems.forEach(item => {
        const rate = TRIM_ITEM_RATES[item as keyof typeof TRIM_ITEM_RATES];
        if (rate) {
          itemsBaseMin += rate.min * roomCount;
          itemsBaseMax += rate.max * roomCount;
        }
      });

      const multiplier = TRIM_TYPE_MULTIPLIER[paintType as keyof typeof TRIM_TYPE_MULTIPLIER];
      totalMin += itemsBaseMin * (multiplier?.min || 1.0);
      totalMax += itemsBaseMax * (multiplier?.max || 1.1);
    }

    // Condition 적용
    const cond = CONDITION_MULTIPLIER[input.paintCondition || 'Fair'];
    totalMin *= cond.min;
    totalMax *= cond.max;

    // Difficulty 추가
    if (input.jobDifficulty) {
      input.jobDifficulty.forEach(diff => {
        const addon = DIFFICULTY_ADDON[diff as keyof typeof DIFFICULTY_ADDON];
        if (addon) {
          totalMin += addon.min;
          totalMax += addon.max;
        }
      });
    }

    // --- 5) 최종 라운딩 및 하드 캡(Hard Cap) 적용 ---
    totalMin = Math.round(totalMin);
    totalMax = Math.round(totalMax);

    // 모든 견적 결과가 $35,000을 넘지 않도록 제한
    if (totalMax > MAX_PRICE_CAP) {
      totalMax = MAX_PRICE_CAP;
    }
    if (totalMin > MAX_PRICE_CAP - 1000) {
      totalMin = MAX_PRICE_CAP - 5000; // 큰 규모 공사임을 시각적으로 보여주기 위한 최소가 조정
    }

    // AI에게 전문적인 설명 생성 요청
    const { output } = await explanationPrompt({
      input,
      priceMin: totalMin,
      priceMax: totalMax
    });

    return output!;
  }
);
