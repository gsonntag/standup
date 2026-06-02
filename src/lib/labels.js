export function labelPillStyle(color) {
  const fallback = '#718096';
  return {
    '--label-color': color || fallback,
  };
}
