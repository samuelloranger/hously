/**
 * Helper for building partial update objects from request bodies.
 *
 * Takes a mapping of { dbField: bodyValue } entries and returns a Record
 * containing only the entries where the value is not undefined.
 *
 * Usage:
 *   const updateData = buildUpdateData({
 *     itemName: body.item_name,
 *     notes: body.notes,
 *   });
 */
const buildUpdateData = (
  fields: Record<string, unknown>,
): Record<string, any> => {
  const data: Record<string, any> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) {
      data[key] = value;
    }
  }
  return data;
};

/**
 * Returns true if the update data object has at least one field to update.
 */
export const hasUpdates = (data: Record<string, any>): boolean => {
  return Object.keys(data).length > 0;
};
