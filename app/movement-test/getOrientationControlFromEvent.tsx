export function getOrientationControlFromEvent(alpha: number, beta: number) {
  // Calculate frontToBack based on beta
  // beta: 0 = on back, 90 = upright, 180 = facing down, -90 = upside down
  // frontToBack: 100 = on back/facing down/upside down, 0 = upright
  let frontToBack = 0;
  if (beta >= 0 && beta <= 90) {
    // From on back (0) to upright (90): 100 to 0
    frontToBack = Math.round(100 - (beta / 90) * 100);
  } else if (beta > 90 && beta <= 180) {
    // From upright (90) to facing down (180): 0 to 100
    frontToBack = Math.round(100 - ((180 - beta) / 90) * 100);
  } else {
    // Negative values (upside down) map to 100
    frontToBack = Math.round(100);
  }

  // Calculate around based on alpha
  // alpha: 0 = front, 90 = left, 180 = back, 270 = right, 360 = front
  // around: 0 = front/back, 100 = left/right
  let around = 0;

  // Normalize alpha to 0-360 range
  const normalizedAlpha = ((alpha % 360) + 360) % 360;

  if (normalizedAlpha >= 0 && normalizedAlpha < 90) {
    // 0 to 90: 0 to 100 (front to left)
    around = Math.round((normalizedAlpha / 90) * 100);
  } else if (normalizedAlpha >= 90 && normalizedAlpha < 180) {
    // 90 to 180: 100 to 0 (left to back)
    around = Math.round(((180 - normalizedAlpha) / 90) * 100);
  } else if (normalizedAlpha >= 180 && normalizedAlpha < 270) {
    // 180 to 270: 0 to 100 (back to right)
    around = Math.round(((normalizedAlpha - 180) / 90) * 100);
  } else {
    // 270 to 360: 100 to 0 (right to front)
    around = Math.round(((360 - normalizedAlpha) / 90) * 100);
  }

  return { frontToBack, around };
}
