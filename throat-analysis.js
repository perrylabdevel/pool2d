// Analyze throat rail collision geometry
const PLAY_HALF_H_IN = 25;
const SIDE_INNER_Y_IN = 24.6;
const SIDE_POCKET_OUTWARD_OFFSET_IN = 0.25;
const JAW_CURVE_BLEND = 0;
const RAIL_THICKNESS_INNER = 1;
const RAIL_THICKNESS_OUTER = 1;
const BALL_RADIUS = 1.125;
const POCKET_CAPTURE_RADIUS = 2.5;

// From geometry calculations
const JAW_X_INNER = 4.850; // Calculated earlier
const throatJoinX = JAW_X_INNER * (1 - 0.35 * JAW_CURVE_BLEND);
const mouthYNorth = PLAY_HALF_H_IN;
const throatMaxYNorth = Math.max(SIDE_INNER_Y_IN, mouthYNorth - 0.05);
const throatJoinYNorth = SIDE_INNER_Y_IN + (mouthYNorth - SIDE_INNER_Y_IN) * (0.5 * JAW_CURVE_BLEND);

const pocketCenter = {x: 0, y: PLAY_HALF_H_IN + SIDE_POCKET_OUTWARD_OFFSET_IN};

console.log('=== THROAT RAIL ANALYSIS ===');
console.log(`\nThroat rail points:`);
console.log(`  Left joint: (-${throatJoinX.toFixed(3)}, ${throatJoinYNorth.toFixed(3)})`);
console.log(`  Mouth: (0, ${mouthYNorth})`);
console.log(`  Right joint: (${throatJoinX.toFixed(3)}, ${throatJoinYNorth.toFixed(3)})`);
console.log(`\nPocket center: (${pocketCenter.x}, ${pocketCenter.y})`);
console.log(`Pocket capture radius: ${POCKET_CAPTURE_RADIUS}"`);

// Check left throat inner rail
const leftThroatFrom = {x: -throatJoinX, y: throatJoinYNorth};
const leftThroatTo = {x: 0, y: mouthYNorth};
const dx = leftThroatTo.x - leftThroatFrom.x;
const dy = leftThroatTo.y - leftThroatFrom.y;
const railLength = Math.sqrt(dx*dx + dy*dy);

// Rail normal (perpendicular, pointing inward)
let nx = -dy / railLength;
let ny = dx / railLength;

console.log(`\nLeft throat inner rail:`);
console.log(`  From: (${leftThroatFrom.x.toFixed(3)}, ${leftThroatFrom.y.toFixed(3)})`);
console.log(`  To: (${leftThroatTo.x.toFixed(3)}, ${leftThroatTo.y.toFixed(3)})`);
console.log(`  Normal: (${nx.toFixed(3)}, ${ny.toFixed(3)})`);

// The rail collision surface extends RAIL_THICKNESS_INNER in the normal direction
// Calculate the closest point on the rail (including thickness) to pocket center
const railMidX = (leftThroatFrom.x + leftThroatTo.x) / 2;
const railMidY = (leftThroatFrom.y + leftThroatTo.y) / 2;

// Point on rail surface (extended by thickness toward play area)
const surfaceX = railMidX + nx * RAIL_THICKNESS_INNER;
const surfaceY = railMidY + ny * RAIL_THICKNESS_INNER;

console.log(`\nRail surface point (with ${RAIL_THICKNESS_INNER}" inward thickness):`);
console.log(`  (${surfaceX.toFixed(3)}, ${surfaceY.toFixed(3)})`);

// Distance from rail surface to pocket center
const distToPocket = Math.sqrt(
  Math.pow(pocketCenter.x - surfaceX, 2) + 
  Math.pow(pocketCenter.y - surfaceY, 2)
);

console.log(`\nDistance from rail surface to pocket center: ${distToPocket.toFixed(3)}"`);
console.log(`Ball needs to get within: ${POCKET_CAPTURE_RADIUS}" of pocket center`);
console.log(`Ball radius: ${BALL_RADIUS}"`);
console.log(`Minimum clearance needed: ${(BALL_RADIUS + POCKET_CAPTURE_RADIUS).toFixed(3)}"`);

if (distToPocket < BALL_RADIUS) {
  console.log(`\n❌ CRITICAL: Rail surface is INSIDE the ball's path to pocket!`);
  console.log(`   Rail blocks access by: ${(BALL_RADIUS - distToPocket).toFixed(3)}"`);
} else if (distToPocket < (POCKET_CAPTURE_RADIUS + BALL_RADIUS)) {
  console.log(`\n⚠️  WARNING: Rail is close to blocking path`);
} else {
  console.log(`\n✓ Rails should not block pocket access`);
}
