'use server';

/**
 * @fileOverview An AI agent to estimate the painting price range and provide a short explanation.
 * 
 * This flow performs logic-based price calculation first, then uses AI to generate
 * a professional explanation for the customer.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// --- 로직 상수 정의 (제공된 데이터 기반) ---

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
  "Skirting Boards": { min: 6 * 16, max: 12 * 16 } // lmRate * 16lm 가정
};

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
  - Paint Areas: {{#if input.paintAreas.ceilingPaint}}Ceiling, {{/if}}{{#if input.paintAreas.wallPaint}}Walls, {{/if}}{{#if input.paintAreas.trimPaint}}Trim{{/if}}
  - Trim Details: {{#if input.trimPaintOptions}}{{input.trimPaintOptions.paintType}} on {{#each input.trimPaintOptions.trimItems}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}{{else}}N/A{{/if}}
  - Condition: {{#if input.paintCondition}}{{input.paintCondition}}{{else}}Fair{{/if}}
  - Difficulty: {{#if input.jobDifficulty}}{{#each input.jobDifficulty}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}{{else}}Standard access{{/if}}

  # GENERATED PRICE
  The calculated price range is {{priceMin}} - {{priceMax}} AUD.

  # INSTRUCTIONS
  1. **explanation**: Write a professional summary (3-5 sentences). 
     - Mention main cost drivers (property size, room count, paint condition, trim details, and access).
     - Use Australian English.
     - Do NOT mention internal formulas or algorithms.
     - Be transparent and build trust.
     - State clearly that this is an "indicative estimate" subject to site inspection.
  2. **priceRange**: Format as "$X,XXX - $X,XXX AUD".
  3. **details**: Provide a bulleted list of 3-5 key factors specific to this job.
  `
});

// --- Flow 정의 (계산 로직 포함) ---

export const generatePaintingEstimate = ai.defineFlow(
  {
    name: 'generatePaintingEstimateFlow',
    inputSchema: GeneratePaintingEstimateInputSchema,
    outputSchema: GeneratePaintingEstimateOutputSchema,
  },
  async (input) => {
    // 0) Anchor 선택
    const isInt = input.typeOfWork.includes('Interior Painting');
    const isExt = input.typeOfWork.includes('Exterior Painting');
    let anchor = ANCHORS.Interior;
    if (isExt && !isInt) anchor = ANCHORS.Exterior;
    if (isExt && isInt) anchor = ANCHORS.InteriorExterior;

    let priceMin = anchor.min;
    let priceMax = anchor.max;

    // 1) Room 기반 세분화 (Interior)
    if (isInt && input.roomsToPaint && input.roomsToPaint.length > 0) {
      const roomScore = input.roomsToPaint.reduce((sum, room) => sum + (ROOM_WEIGHT[room] || 0.6), 0);
      const roomFactor = Math.max(0.6, Math.min(2.2, roomScore / BASE_ROOM_SCORE));
      priceMin *= roomFactor;
      priceMax *= roomFactor;
    }

    // 2) Paint Areas 반영
    let areaFactor = 0;
    if (input.paintAreas.ceilingPaint) areaFactor += AREA_SHARE.ceilingPaint;
    if (input.paintAreas.wallPaint) areaFactor += AREA_SHARE.wallPaint;
    if (input.paintAreas.trimPaint) areaFactor += AREA_SHARE.trimPaint;
    
    // 최소 기준 (하나도 선택 안했을 경우를 대비해 기본값 1.0 또는 최소값 보정)
    areaFactor = areaFactor > 0 ? areaFactor : 1.0;
    priceMin *= areaFactor;
    priceMax *= areaFactor;

    // 3) Trim 세분화
    let trimAddMin = 0;
    let trimAddMax = 0;
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
      trimAddMin = itemsBaseMin * multiplier.min;
      trimAddMax = itemsBaseMax * multiplier.max;
    }

    // 4) Condition 적용
    const cond = CONDITION_MULTIPLIER[input.paintCondition || 'Fair'];
    let finalMin = (priceMin + trimAddMin) * cond.min;
    let finalMax = (priceMax + trimAddMax) * cond.max;

    // 5) Difficulty 추가
    if (input.jobDifficulty) {
      input.jobDifficulty.forEach(diff => {
        const addon = DIFFICULTY_ADDON[diff];
        if (addon) {
          finalMin += addon.min;
          finalMax += addon.max;
        }
      });
    }

    // Global Bounds 적용
    finalMin = Math.max(1500, Math.round(finalMin));
    finalMax = Math.round(finalMax);

    // AI에게 설명 생성을 위해 결과값 전달
    const { output } = await explanationPrompt({
      input,
      priceMin: finalMin,
      priceMax: finalMax
    });

    // 30,000 이상일 경우 처리
    if (finalMax > 30000) {
      return {
        priceRange: "Site inspection needed",
        explanation: "Based on the extensive scope and specific requirements, a manual site inspection is required to provide an accurate quote. The estimated value exceeds our standard online calculation range.",
        details: output?.details || ["High complexity job", "Extensive surface area", "Requires specialized access"]
      };
    }

    return output!;
  }
);
