'use server';

/**
 * @fileOverview An AI agent to estimate the painting price range and provide a short explanation.
 * 
 * This flow performs logic-based price calculation first, then uses AI to generate
 * a professional explanation for the customer.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// --- 로직 상수 정의 ---

const ANCHORS = {
  Interior: { min: 1500, max: 8000 },
  Exterior: { min: 2000, max: 10000 },
  InteriorExterior: { min: 3500, max: 18000 }
};

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

const BASE_ROOM_SCORE = 3.0;

const AREA_SHARE = {
  ceilingPaint: 0.25,
  wallPaint: 0.55,
  trimPaint: 0.20
};

const TRIM_TYPE_MULTIPLIER = {
  "Oil-based": { min: 1.00, max: 1.05 },
  "Water-based": { min: 1.10, max: 1.25 }
};

const TRIM_ITEM_RATES = {
  "Doors": { min: 120, max: 220 },
  "Window Frames": { min: 90, max: 180 },
  "Skirting Boards": { min: 6 * 16, max: 12 * 16 }
};

// --- Exterior 전용 로직 상수 ---
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

const EXTERIOR_FULL_PACKAGE_MIN_FLOOR = 6500;

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
  - Rooms: {{#if input.roomsToPaint}}{{#each input.roomsToPaint}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}{{else}}Not specified{{/if}}
  - Exterior Areas: {{#if input.exteriorAreas}}{{#each input.exteriorAreas}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}{{else}}N/A{{/if}}
  - Paint Areas: {{#if input.paintAreas.ceilingPaint}}Ceiling, {{/if}}{{#if input.paintAreas.wallPaint}}Walls, {{/if}}{{#if input.paintAreas.trimPaint}}Trim{{/if}}
  - Trim Details: {{#if input.trimPaintOptions}}{{input.trimPaintOptions.paintType}} on {{#each input.trimPaintOptions.trimItems}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}{{else}}N/A{{/if}}
  - Condition: {{#if input.paintCondition}}{{input.paintCondition}}{{else}}Fair{{/if}}
  - Difficulty: {{#if input.jobDifficulty}}{{#each input.jobDifficulty}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}{{else}}Standard access{{/if}}

  # GENERATED PRICE
  The calculated price range is {{priceMin}} - {{priceMax}} AUD.

  # INSTRUCTIONS
  1. **explanation**: Write a professional summary (3-5 sentences). 
     - Mention main cost drivers (property size, room count, paint condition, trim details, and access).
     - If exterior painting is included, mention weather windows, surface degradation, and height/access risks.
     - Use Australian English.
     - Do NOT mention internal formulas or algorithms.
     - Be transparent and build trust.
     - State clearly that this is an "indicative estimate" subject to site inspection.
  2. **priceRange**: Format as "$X,XXX - $X,XXX AUD".
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

    let totalMin = 0;
    let totalMax = 0;

    // --- 1) Interior 계산 ---
    if (isInt) {
      const anchor = ANCHORS.Interior;
      let intMin = anchor.min;
      let intMax = anchor.max;

      // Room 기반 세분화
      if (input.roomsToPaint && input.roomsToPaint.length > 0) {
        const roomScore = input.roomsToPaint.reduce((sum, room) => sum + (ROOM_WEIGHT[room] || 0.6), 0);
        const roomFactor = Math.max(0.6, Math.min(2.2, roomScore / BASE_ROOM_SCORE));
        intMin *= roomFactor;
        intMax *= roomFactor;
      }

      // Paint Areas 반영
      let areaFactor = 0;
      if (input.paintAreas.ceilingPaint) areaFactor += AREA_SHARE.ceilingPaint;
      if (input.paintAreas.wallPaint) areaFactor += AREA_SHARE.wallPaint;
      if (input.paintAreas.trimPaint) areaFactor += AREA_SHARE.trimPaint;
      areaFactor = areaFactor > 0 ? areaFactor : 1.0;
      
      intMin *= areaFactor;
      intMax *= areaFactor;

      totalMin += intMin;
      totalMax += intMax;
    }

    // --- 2) Exterior 계산 (모듈 합산 방식) ---
    if (isExt && input.exteriorAreas && input.exteriorAreas.length > 0) {
      let extSumMin = 0;
      let extSumMax = 0;

      // 항목별 베이스 합산
      input.exteriorAreas.forEach(area => {
        const base = EXTERIOR_ITEM_BASE[area];
        if (base) {
          extSumMin += base.min;
          extSumMax += base.max;
        }
      });

      // 리스크 가중치 적용
      let extRiskedMin = extSumMin * EXTERIOR_RISK_MULTIPLIER.min;
      let extRiskedMax = extSumMax * EXTERIOR_RISK_MULTIPLIER.max;

      // 사이즈 보정 (Soft Factor)
      if (input.approxSize) {
        const band = EXTERIOR_SIZE_BANDS.find(b => input.approxSize! >= b.minSqm && input.approxSize! <= b.maxSqm) 
                   || EXTERIOR_SIZE_BANDS[EXTERIOR_SIZE_BANDS.length - 1];
        extRiskedMin *= band.minMult;
        extRiskedMax *= band.maxMult;
      }

      // Full Package Floor 룰 적용
      const requiredItems = ["Wall", "Eaves", "Gutter", "Fascia", "Exterior Trim"];
      const isFullPackage = requiredItems.every(item => input.exteriorAreas!.includes(item));

      if (isFullPackage) {
        extRiskedMin = Math.max(extRiskedMin, EXTERIOR_FULL_PACKAGE_MIN_FLOOR);
        extRiskedMax = Math.max(extRiskedMax, EXTERIOR_FULL_PACKAGE_MIN_FLOOR * 1.25);
      }

      totalMin += extRiskedMin;
      totalMax += extRiskedMax;
    }

    // --- 3) 공통 추가 항목 (Trim, Condition, Difficulty) ---

    // Trim 세분화 (Interior 선택 시에만 적용하거나, 전체에 합산)
    if (input.paintAreas.trimPaint && input.trimPaintOptions) {
      const roomCount = input.roomsToPaint?.length || 1;
      const { paintType, trimItems } = input.trimPaintOptions;
      let itemsBaseMin = 0;
      let itemsBaseMax = 0;
      
      trimItems.forEach(item => {
        const rate = TRIM_ITEM_RATES[item];
        if (rate) {
          itemsBaseMin += rate.min * roomCount;
          itemsBaseMax += rate.max * roomCount;
        }
      });

      const multiplier = TRIM_TYPE_MULTIPLIER[paintType] || TRIM_TYPE_MULTIPLIER["Oil-based"];
      totalMin += itemsBaseMin * multiplier.min;
      totalMax += itemsBaseMax * multiplier.max;
    }

    // Condition 적용
    const cond = CONDITION_MULTIPLIER[input.paintCondition || 'Fair'];
    totalMin *= cond.min;
    totalMax *= cond.max;

    // Difficulty 추가
    if (input.jobDifficulty) {
      input.jobDifficulty.forEach(diff => {
        const addon = DIFFICULTY_ADDON[diff];
        if (addon) {
          totalMin += addon.min;
          totalMax += addon.max;
        }
      });
    }

    // Global Bounds 적용
    totalMin = Math.max(1500, Math.round(totalMin));
    totalMax = Math.round(totalMax);

    // 30,000 이상일 경우 처리
    if (totalMax > 30000) {
      return {
        priceRange: "Site inspection needed",
        explanation: "Based on the extensive scope and specific requirements, a manual site inspection is required to provide an accurate quote. The estimated value exceeds our standard online calculation range.",
        details: ["High complexity job", "Extensive surface area", "Requires specialized access and safety setup"]
      };
    }

    // AI에게 설명 생성을 위해 결과값 전달
    const { output } = await explanationPrompt({
      input,
      priceMin: totalMin,
      priceMax: totalMax
    });

    return output!;
  }
);
