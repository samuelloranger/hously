export const COOKING_UNITS = [
  // Volume
  { key: 'tsp', category: 'volume' },
  { key: 'tbsp', category: 'volume' },
  { key: 'cup', category: 'volume' },
  { key: 'ml', category: 'volume' },
  { key: 'l', category: 'volume' },
  // Weight
  { key: 'g', category: 'weight' },
  { key: 'kg', category: 'weight' },
  { key: 'oz', category: 'weight' },
  { key: 'lb', category: 'weight' },
  // Count / Other
  { key: 'unit', category: 'other' },
  { key: 'packet', category: 'other' },
  { key: 'pinch', category: 'other' },
  { key: 'clove', category: 'other' },
  { key: 'can', category: 'other' },
  { key: 'slice', category: 'other' },
  { key: 'bunch', category: 'other' },
] as const;

export type CookingUnitKey = (typeof COOKING_UNITS)[number]['key'];
export type CookingUnitCategory = (typeof COOKING_UNITS)[number]['category'];
