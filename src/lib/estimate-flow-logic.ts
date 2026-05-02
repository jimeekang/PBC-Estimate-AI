export type InteriorTrimItemOnlyInput = {
  typeOfWork: string[];
  scopeOfPainting?: string;
  specificInteriorTrimOnly?: boolean;
  trimPaintOptions?: {
    paintType?: string;
    trimItems?: string[];
  };
  interiorDoorItems?: unknown[];
  interiorWindowItems?: unknown[];
  interiorRooms?: unknown[];
};

export type InteriorPaintAreas = {
  ceilingPaint?: boolean;
  wallPaint?: boolean;
  trimPaint?: boolean;
  ensuitePaint?: boolean;
};

export type InteriorRoomWithPaintAreas = {
  roomName?: string;
  paintAreas?: InteriorPaintAreas;
};

export const EMPTY_INTERIOR_PAINT_AREAS: Required<InteriorPaintAreas> = {
  ceilingPaint: false,
  wallPaint: false,
  trimPaint: false,
  ensuitePaint: false,
};

function hasPositiveQuantity(items?: unknown[]): boolean {
  return (items ?? []).some((item) => {
    if (!item || typeof item !== 'object') return false;
    const quantity = (item as { quantity?: unknown }).quantity;
    return typeof quantity === 'number' && quantity > 0;
  });
}

export function clearGlobalPaintAreasForSpecificScope(
  _paintAreas?: InteriorPaintAreas
): Required<InteriorPaintAreas> {
  return { ...EMPTY_INTERIOR_PAINT_AREAS };
}

export function canSelectSpecificRoomTrimItem(input: {
  specificInteriorTrimOnly?: boolean;
  interiorRooms?: InteriorRoomWithPaintAreas[];
}): boolean {
  if (input.specificInteriorTrimOnly) return true;

  const rooms = input.interiorRooms ?? [];
  return rooms.some((room) => room.roomName !== 'Handrail' && !!room.paintAreas?.trimPaint);
}

// Door/window-only trim quotes can bypass room-based estimation.
// As soon as skirting or any room-linked selection exists, the range model must stay active.
export function isInteriorTrimItemOnly(input: InteriorTrimItemOnlyInput): boolean {
  if (!input.typeOfWork.includes('Interior Painting')) return false;
  if (input.typeOfWork.includes('Exterior Painting')) return false;
  if (input.scopeOfPainting !== 'Specific areas only') return false;
  if (!input.specificInteriorTrimOnly) return false;

  const trimItems = input.trimPaintOptions?.trimItems ?? [];
  if (trimItems.includes('Skirting Boards')) return false;
  if (!hasPositiveQuantity(input.interiorDoorItems) && !hasPositiveQuantity(input.interiorWindowItems)) return false;

  const rooms = input.interiorRooms ?? [];
  return rooms.length === 0;
}
