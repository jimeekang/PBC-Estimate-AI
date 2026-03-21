import { z } from 'zod';
import { HANDRAIL_SYSTEM_OPTIONS } from '@/lib/estimate-constants';

export const InteriorHandrailDetailsSchema = z.object({
  lengthLm: z.number().positive().optional(),
  widthMm: z.number().positive().optional(),
  system: z.enum(HANDRAIL_SYSTEM_OPTIONS).optional(),
});

export const InteriorRoomItemSchema = z.object({
  roomName: z.string(),
  otherRoomName: z.string().optional(),
  paintAreas: z.object({
    ceilingPaint: z.boolean(),
    wallPaint: z.boolean(),
    trimPaint: z.boolean(),
    ensuitePaint: z.boolean().optional(),
  }),
  approxRoomSize: z.number().optional(),
  handrailDetails: InteriorHandrailDetailsSchema.optional(),
}).superRefine((room, ctx) => {
  if (room.roomName === 'Handrail') {
    if (!(typeof room.handrailDetails?.lengthLm === 'number' && room.handrailDetails.lengthLm > 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['handrailDetails', 'lengthLm'],
        message: 'Enter the total handrail length in linear metres.',
      });
    }

    if (!(typeof room.handrailDetails?.widthMm === 'number' && room.handrailDetails.widthMm > 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['handrailDetails', 'widthMm'],
        message: 'Enter the handrail width in millimetres.',
      });
    }

    if (!room.handrailDetails?.system) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['handrailDetails', 'system'],
        message: 'Select a handrail coating system.',
      });
    }
    return;
  }

  const paintAreas = room.paintAreas ?? {};
  if (!paintAreas.ceilingPaint && !paintAreas.wallPaint && !paintAreas.trimPaint && !paintAreas.ensuitePaint) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['paintAreas'],
      message: 'At least one surface must be selected per room.',
    });
  }
});

export const SkirtingCalculatorRoomSchema = z.object({
  label: z.string().optional(),
  length: z.number().positive().optional(),
  width: z.number().positive().optional(),
});

export type InteriorHandrailDetails = z.infer<typeof InteriorHandrailDetailsSchema>;
export type InteriorRoomItem = z.infer<typeof InteriorRoomItemSchema>;
export type SkirtingCalculatorRoom = z.infer<typeof SkirtingCalculatorRoomSchema>;
