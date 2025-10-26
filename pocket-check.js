// Check pocket capture geometry with RAIL_THICKNESS_INNER = 0.05
const PLAY_HALF_H_IN = 25;
const SIDE_INNER_Y_IN = 24.6;
const SIDE_POCKET_OUTWARD_OFFSET_IN = 0.25;
const JAW_CURVE_BLEND = 0;
const RAIL_THICKNESS_INNER = 0.05; // User says it's 0.05
const BALL_RADIUS = 1.125;
const BALL_SCALE = 1.0; // Check if this is the issue
const POCKET_CAPTURE_RADIUS_SIDE = 2.5;

// Calculate actual ball radius with scale
const actualBallRadius = BALL_RADIUS * BALL_SCALE;

// From geometry calculations
const JAW_X_INNER = 4.850;
const throatJoinX = JAW_X_INNER * (1 - 0.35 * JAW_CURVE_BLEND);
const mouthYNorth = PLAY_HALF_H_IN;
const throatJoinYNorth = SIDE_INNER_Y_IN + (mouthYNorth - SIDE_INNER_Y_IN) * (0.5 * JAW_CURVE_BLEND);

const pocketCenter = {x: 0, y: PLAY_HALF_H_IN + SIDE_POCKET_OUTWARD_OFFSET_IN};

console.log('=== SIDE POCKET CAPTURE ANALYSIS ===');
console.log(`\nBall:`);
console.log(`  Base radius: ${BALL_RADIUS}"`);
console.log(`  Scale: ${BALL_SCALE}`);
console.log(`  Actual radius: ${actualBallRadius}"`);
console.log(`  Diameter: ${actualBallRadius * 2}"`);

console.log(`\nPocket:`);
console.log(`  Center: (${pocketCenter.x}, ${pocketCenter.y})`);
console.log(`  Capture radius: ${POCKET_CAPTURE_RADIUS_SIDE}"`);

// Left throat inner rail
const leftThroatFrom = {x: -throatJoinX, y: throatJoinYNorth};
const leftThroatTo = {x: 0, y: mouthYNorth};
const dx = leftThroatTo.x - leftThroatFrom.x;
const dy = leftThroatTo.y - leftThroatFrom.y;
const railLength = Math.sqrt(dx*dx + dy*dy);

let nx = -dy / railLength;
let ny = dx / railLength;

console.log(`\nLeft throat rail (with ${RAIL_THICKNESS_INNER}" thickness):`);
console.log(`  From: (${leftThroatFrom.x.toFixed(3)}, ${leftThroatFrom.y.toFixed(3)})`);
console.log(`  To: (${leftThroatTo.x.toFixed(3)}, ${leftThroatTo.y.toFixed(3)})`);

// Rail collision surface
const railMidX = (leftThroatFrom.x + leftThroatTo.x) / 2;
const railMidY = (leftThroatFrom.y + leftThroatTo.y) / 2;
const surfaceX = railMidX + nx * RAIL_THICKNESS_INNER;
const surfaceY = railMidY + ny * RAIL_THICKNESS_INNER;

const distRailToPocket = Math.sqrt(
  Math.pow(pocketCenter.x - surfaceX, 2) + 
  Math.pow(pocketCenter.y - surfaceY, 2)
);

console.log(`  Rail surface point: (${surfaceX.toFixed(3)}, ${surfaceY.toFixed(3)})`);
console.log(`  Distance to pocket center: ${distRailToPocket.toFixed(3)}"`);

// Calculate minimum distance a ball center can get to pocket
const minDistToPocket = distRailToPocket + actualBallRadius;

console.log(`\nCapture Analysis:`);
console.log(`  Pocket capture radius: ${POCKET_CAPTURE_RADIUS_SIDE}"`);
console.log(`  Closest ball center can get: ${minDistToPocket.toFixed(3)}"`);
console.log(`  Can ball be captured? ${minDistToPocket <= POCKET_CAPTURE_RADIUS_SIDE ? 'YES ✓' : 'NO ❌'}`);

if (minDistToPocket > POCKET_CAPTURE_RADIUS_SIDE) {
  console.log(`\n❌ PROBLEM: Ball cannot reach capture zone!`);
  console.log(`   Gap: ${(minDistToPocket - POCKET_CAPTURE_RADIUS_SIDE).toFixed(3)}"`);
  console.log(`\nSOLUTION: Increase POCKET_CAPTURE_RADIUS_SIDE to at least ${Math.ceil(minDistToPocket * 10) / 10}"`);
}

// Also check throat width
const throatWidth = throatJoinX * 2 - RAIL_THICKNESS_INNER * 2;
console.log(`\nThroat opening: ${throatWidth.toFixed(3)}" (ball diameter: ${actualBallRadius * 2}")`);
if (throatWidth < actualBallRadius * 2) {
  console.log(`❌ Throat too narrow!`);
}
