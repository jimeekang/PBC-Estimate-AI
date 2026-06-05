/**
 * Shared constants used across the estimate schema, server actions, and UI form.
 * Single source of truth — do NOT redefine these in other files.
 */

export const EXTERIOR_RESTRICTED_PROPERTY_TYPES = ['Apartment', 'Office'] as const;

export const HANDRAIL_SYSTEM_OPTIONS = [
  'paint_to_paint_oil_2coat',
  'paint_to_paint_water_3coat',
  'varnish_to_paint_oil_3coat_min',
  'varnish_to_paint_water_4coat_min',
  'varnish_to_varnish_stain',
  'varnish_to_varnish_clear',
] as const;

export type HandrailSystemOption = (typeof HANDRAIL_SYSTEM_OPTIONS)[number];
export type ExteriorRestrictedPropertyType = (typeof EXTERIOR_RESTRICTED_PROPERTY_TYPES)[number];
