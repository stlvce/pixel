export const zoomAtPoint = (
  oldScale: number,
  newScale: number,
  pointX: number,
  pointY: number,
  offset: { x: number; y: number },
) => {
  const scaleFactor = newScale / oldScale;

  return {
    x: pointX - (pointX - offset.x) * scaleFactor,
    y: pointY - (pointY - offset.y) * scaleFactor,
  };
};
