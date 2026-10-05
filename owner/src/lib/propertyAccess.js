export const managementLabel = property => property?.managementMode === 'BOOKMYVILLA_MANAGED' ? 'Managed by BookMyVilla' : 'Self Managed';
export const isManagedProperty = property => property?.managementMode === 'BOOKMYVILLA_MANAGED';
// Operational permissions come from the authenticated backend response.
export const canOperateProperty = property => property?.canOperate === true;

export function canOperateLegacyRecord(properties, record) {
  const matches = record?.propertyId ? properties.filter(property => property._id === String(record.propertyId?._id || record.propertyId))
    : properties.filter(property => property.name === record?.propertyName);
  if (matches.length === 1) return canOperateProperty(matches[0]);
  return properties.length > 0 && properties.every(canOperateProperty);
}
