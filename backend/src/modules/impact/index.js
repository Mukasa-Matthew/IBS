export function potentiallyAffectedCount(areas) {
  return areas.reduce((sum, area) => sum + Number(area.customer_count || 0), 0);
}

export function impactStatement(count) {
  return `${count} customer${count === 1 ? '' : 's'} potentially affected.`;
}
