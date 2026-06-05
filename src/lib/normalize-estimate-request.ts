import { clearGlobalPaintAreasForSpecificScope } from '@/lib/estimate-flow-logic';
import type { EstimateRequest } from '@/schemas/estimate-request';

const INTERIOR_ONLY_FIELDS = [
  'roomsToPaint',
  'interiorRooms',
  'specificInteriorTrimOnly',
  'trimPaintOptions',
  'skirtingPricingMode',
  'skirtingLinearMetres',
  'skirtingCalculatorRooms',
  'ceilingOptions',
  'ceilingType',
  'interiorWallHeight',
  'interiorDoorItems',
  'interiorWindowItems',
  'otherInteriorArea',
  'paintAreas',
] as const;

const EXTERIOR_ONLY_FIELDS = [
  'exteriorAreas',
  'otherExteriorArea',
  'exteriorTrimItems',
  'exteriorFrontDoor',
  'exteriorDoors',
  'exteriorWindows',
  'exteriorArchitraves',
  'wallType',
  'wallFinishes',
  'wallHeight',
  'deckArea',
  'deckServiceType',
  'deckProductType',
  'deckCondition',
  'pavingArea',
  'pavingCondition',
] as const;

function clearFields<T extends Record<string, unknown>, K extends readonly (keyof T)[]>(
  target: T,
  fields: K
) {
  fields.forEach((field) => {
    delete target[field];
  });
}

export function normalizeEstimateRequest(data: EstimateRequest): EstimateRequest {
  const normalized: EstimateRequest = { ...data };
  const hasInterior = normalized.typeOfWork.includes('Interior Painting');
  const hasExterior = normalized.typeOfWork.includes('Exterior Painting');

  if (!hasInterior) {
    clearFields(normalized, INTERIOR_ONLY_FIELDS);
  } else if (normalized.scopeOfPainting === 'Specific areas only') {
    normalized.paintAreas = clearGlobalPaintAreasForSpecificScope(normalized.paintAreas);
  }

  if (!hasExterior) {
    clearFields(normalized, EXTERIOR_ONLY_FIELDS);
  }

  if (normalized.propertyType !== 'Apartment') {
    delete normalized.apartmentStructure;
  }

  return normalized;
}
