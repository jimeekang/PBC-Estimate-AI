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

// Door/window-only trim quotes can bypass room-based estimation.
// As soon as skirting or any room-linked selection exists, the range model must stay active.
export function isInteriorTrimItemOnly(input: InteriorTrimItemOnlyInput): boolean {
  if (!input.typeOfWork.includes('Interior Painting')) return false;
  if (input.typeOfWork.includes('Exterior Painting')) return false;
  if (input.scopeOfPainting !== 'Specific areas only') return false;
  if (!input.specificInteriorTrimOnly) return false;

  const trimItems = input.trimPaintOptions?.trimItems ?? [];
  if (trimItems.includes('Skirting Boards')) return false;
  if (!input.interiorDoorItems?.length && !input.interiorWindowItems?.length) return false;

  const rooms = input.interiorRooms ?? [];
  return rooms.length === 0;
}
