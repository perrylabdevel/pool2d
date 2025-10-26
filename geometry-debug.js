// Debug script to calculate side pocket geometry
const PLAY_HALF_H_IN = 25;
const SIDE_FRAME_OFFSET_IN = 2;
const JAW_REF_RADIUS_IN = 4;
const SIDE_STRAIGHT_Y_IN = 23.5;
const SIDE_INNER_Y_IN = 24.6;
const SIDE_POCKET_OUTWARD_OFFSET_IN = 0.25;
const RAIL_THICKNESS_INNER = 1;
const BALL_RADIUS = 1.125;

// Calculate JAW_X_INNER
const f = SIDE_FRAME_OFFSET_IN;
const r = JAW_REF_RADIUS_IN;
const yTop = PLAY_HALF_H_IN + f;
const under = r * r - f * f;
const xi = Math.sqrt(under);
const tInner = (yTop - SIDE_INNER_Y_IN) / xi;
const JAW_X_INNER = xi + f * tInner;

console.log('=== SIDE POCKET GEOMETRY ===');
console.log(`Ball diameter: ${BALL_RADIUS * 2}" (radius: ${BALL_RADIUS}")`);
console.log(`\nPocket center: (0, ${PLAY_HALF_H_IN + SIDE_POCKET_OUTWARD_OFFSET_IN})`);
console.log(`Throat inner Y: ${SIDE_INNER_Y_IN}"`);
console.log(`JAW_X_INNER: ${JAW_X_INNER.toFixed(3)}"`);
console.log(`Throat width: ${(JAW_X_INNER * 2).toFixed(3)}" (wide enough: ${JAW_X_INNER * 2 > BALL_RADIUS * 2 ? 'YES' : 'NO'})`);
console.log(`\nRail thickness (inward): ${RAIL_THICKNESS_INNER}"`);
console.log(`\nEffective throat opening after rail thickness:`);
console.log(`  Inner width: ${(JAW_X_INNER * 2 - RAIL_THICKNESS_INNER * 2).toFixed(3)}"`);
console.log(`  Can ball fit? ${(JAW_X_INNER * 2 - RAIL_THICKNESS_INNER * 2) > BALL_RADIUS * 2 ? 'YES' : 'NO'}`);

if ((JAW_X_INNER * 2 - RAIL_THICKNESS_INNER * 2) <= BALL_RADIUS * 2) {
  console.log(`\n❌ PROBLEM: Rail thickness ${RAIL_THICKNESS_INNER}" blocks the throat!`);
  console.log(`   Throat opening: ${(JAW_X_INNER * 2 - RAIL_THICKNESS_INNER * 2).toFixed(3)}"`);
  console.log(`   Ball needs: ${BALL_RADIUS * 2}"`);
  console.log(`   Deficit: ${(BALL_RADIUS * 2 - (JAW_X_INNER * 2 - RAIL_THICKNESS_INNER * 2)).toFixed(3)}"`);
}
