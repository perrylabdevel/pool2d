/**
 * Test script for corner pocket geometry conversions
 *
 * This validates that:
 * 1. Modern → Legacy conversion produces correct jaw positions
 * 2. Jaw depth affects jaw positions correctly
 * 3. Throat width constraints are respected
 * 4. Round-trip conversions preserve values
 */

import { modernToLegacy, legacyToModern } from './src/geometry/GeometryConversion.js';
import { ModernPocketGeometry, PocketTemplate } from './src/geometry/ModernGeometry.js';

const PLAY_HALF_W_IN = 50.0;
const PLAY_HALF_H_IN = 25.0;

interface TestCase {
  name: string;
  corner: {
    mouthWidth: number;
    throatWidth: number;
    railDepth: number;
    jawDepth: number;
    shelfDepth: number;
  };
  expectedJawOffset?: number; // Expected offset from straight rail
}

const testCases: TestCase[] = [
  {
    name: 'Standard BCA Medium',
    corner: {
      mouthWidth: 5.0,
      throatWidth: 4.125,
      railDepth: 1.75,
      jawDepth: 1.0,
      shelfDepth: 1.75,
    },
    expectedJawOffset: 2.0625, // max(throatWidth/2, jawDepth) = max(2.0625, 1.0) = 2.0625
  },
  {
    name: 'Tight throat, shallow jaw',
    corner: {
      mouthWidth: 4.5,
      throatWidth: 3.5,
      railDepth: 1.5,
      jawDepth: 0.8,
      shelfDepth: 1.5,
    },
    expectedJawOffset: 1.75, // max(3.5/2, 0.8) = max(1.75, 0.8) = 1.75
  },
  {
    name: 'Wide throat, deep jaw',
    corner: {
      mouthWidth: 6.0,
      throatWidth: 5.0,
      railDepth: 2.0,
      jawDepth: 3.0,
      shelfDepth: 2.0,
    },
    expectedJawOffset: 3.0, // max(5.0/2, 3.0) = max(2.5, 3.0) = 3.0 (jaw depth wins)
  },
  {
    name: 'Minimal geometry',
    corner: {
      mouthWidth: 4.0,
      throatWidth: 3.0,
      railDepth: 1.0,
      jawDepth: 0.5,
      shelfDepth: 1.0,
    },
    expectedJawOffset: 1.5, // max(3.0/2, 0.5) = max(1.5, 0.5) = 1.5
  },
  {
    name: 'Jaw depth exceeds throat requirement',
    corner: {
      mouthWidth: 5.5,
      throatWidth: 4.0,
      railDepth: 1.8,
      jawDepth: 2.5,
      shelfDepth: 1.8,
    },
    expectedJawOffset: 2.5, // max(4.0/2, 2.5) = max(2.0, 2.5) = 2.5 (jaw depth wins)
  },
];

function testCornerConversion() {
  console.log('='.repeat(80));
  console.log('CORNER POCKET GEOMETRY CONVERSION TEST');
  console.log('='.repeat(80));
  console.log();

  let passCount = 0;
  let failCount = 0;

  for (const testCase of testCases) {
    console.log(`\n${'─'.repeat(80)}`);
    console.log(`Test: ${testCase.name}`);
    console.log(`${'─'.repeat(80)}`);

    // Create modern geometry
    const modernGeometry: ModernPocketGeometry = {
      template: PocketTemplate.CUSTOM,
      side: {
        mouthWidth: 5.5,
        throatWidth: 4.625,
        railDepth: 1.5,
        jawDepth: 1.1,
        shelfDepth: 0.3,
        railCurve: 0.0,
      },
      corner: testCase.corner,
    };

    console.log('\nInput (Modern):');
    console.log(`  mouthWidth: ${testCase.corner.mouthWidth}"`);
    console.log(`  throatWidth: ${testCase.corner.throatWidth}"`);
    console.log(`  railDepth: ${testCase.corner.railDepth}"`);
    console.log(`  jawDepth: ${testCase.corner.jawDepth}"`);
    console.log(`  shelfDepth: ${testCase.corner.shelfDepth}"`);

    // Convert to legacy
    const legacy = modernToLegacy(modernGeometry);

    const straightX = PLAY_HALF_W_IN - testCase.corner.railDepth;
    const targetY = PLAY_HALF_H_IN - testCase.corner.railDepth;
    const actualJawOffset = straightX - (legacy.CORNER_JAW_X_OVERRIDE_IN ?? 0);

    console.log('\nOutput (Legacy):');
    console.log(`  CORNER_STRAIGHT_X_IN: ${legacy.CORNER_STRAIGHT_X_IN}"`);
    console.log(`  CORNER_TARGET_Y_IN: ${legacy.CORNER_TARGET_Y_IN}"`);
    console.log(`  CORNER_JAW_X_OVERRIDE_IN: ${legacy.CORNER_JAW_X_OVERRIDE_IN}"`);
    console.log(`  CORNER_JAW_Y_OVERRIDE_IN: ${legacy.CORNER_JAW_Y_OVERRIDE_IN}"`);
    console.log(`  CORNER_THROAT_WIDTH_IN: ${legacy.CORNER_THROAT_WIDTH_IN}"`);

    console.log('\nCalculated Values:');
    console.log(`  straightX (50 - railDepth): ${straightX.toFixed(3)}"`);
    console.log(`  targetY (25 - railDepth): ${targetY.toFixed(3)}"`);
    console.log(`  throatHalf: ${(testCase.corner.throatWidth / 2).toFixed(3)}"`);
    console.log(`  Actual jaw offset: ${actualJawOffset.toFixed(3)}"`);
    if (testCase.expectedJawOffset !== undefined) {
      console.log(`  Expected jaw offset: ${testCase.expectedJawOffset.toFixed(3)}"`);
    }

    // Test 1: Jaw offset calculation
    let test1Pass = true;
    if (testCase.expectedJawOffset !== undefined) {
      const tolerance = 0.001;
      const diff = Math.abs(actualJawOffset - testCase.expectedJawOffset);
      if (diff > tolerance) {
        console.log(`\n❌ FAIL: Jaw offset mismatch!`);
        console.log(`   Expected: ${testCase.expectedJawOffset.toFixed(3)}"`);
        console.log(`   Actual: ${actualJawOffset.toFixed(3)}"`);
        console.log(`   Diff: ${diff.toFixed(3)}"`);
        test1Pass = false;
      } else {
        console.log(`\n✅ PASS: Jaw offset correct (${actualJawOffset.toFixed(3)}")`);
      }
    }

    // Test 2: Throat width preservation
    const test2Pass = Math.abs((legacy.CORNER_THROAT_WIDTH_IN ?? 0) - testCase.corner.throatWidth) < 0.001;
    if (test2Pass) {
      console.log(`✅ PASS: Throat width preserved (${testCase.corner.throatWidth}")`);
    } else {
      console.log(`❌ FAIL: Throat width not preserved!`);
      console.log(`   Expected: ${testCase.corner.throatWidth}"`);
      console.log(`   Actual: ${legacy.CORNER_THROAT_WIDTH_IN}"`);
    }

    // Test 3: Jaw positions respect throat constraint
    const throatHalf = testCase.corner.throatWidth / 2;
    const jawXFromCenter = PLAY_HALF_W_IN - (legacy.CORNER_JAW_X_OVERRIDE_IN ?? 0);
    const jawYFromCenter = PLAY_HALF_H_IN - (legacy.CORNER_JAW_Y_OVERRIDE_IN ?? 0);
    const minOffset = Math.min(jawXFromCenter, jawYFromCenter);
    const test3Pass = minOffset >= throatHalf - 0.001;
    if (test3Pass) {
      console.log(`✅ PASS: Jaw offset (${minOffset.toFixed(3)}") >= throatHalf (${throatHalf.toFixed(3)}")`);
    } else {
      console.log(`❌ FAIL: Jaw offset too small for throat!`);
      console.log(`   Jaw offset: ${minOffset.toFixed(3)}"`);
      console.log(`   Required (throatHalf): ${throatHalf.toFixed(3)}"`);
    }

    // Test 4: Round-trip conversion
    const roundTrip = legacyToModern(legacy);
    const throatDiff = Math.abs(roundTrip.corner.throatWidth - testCase.corner.throatWidth);
    const railDepthDiff = Math.abs(roundTrip.corner.railDepth - testCase.corner.railDepth);
    const test4Pass = throatDiff < 0.1 && railDepthDiff < 0.1;

    console.log('\nRound-trip conversion (Legacy → Modern):');
    console.log(`  Original throatWidth: ${testCase.corner.throatWidth}"`);
    console.log(`  Round-trip throatWidth: ${roundTrip.corner.throatWidth.toFixed(3)}"`);
    console.log(`  Diff: ${throatDiff.toFixed(3)}"`);
    console.log(`  Original railDepth: ${testCase.corner.railDepth}"`);
    console.log(`  Round-trip railDepth: ${roundTrip.corner.railDepth.toFixed(3)}"`);
    console.log(`  Diff: ${railDepthDiff.toFixed(3)}"`);

    if (test4Pass) {
      console.log(`✅ PASS: Round-trip conversion preserves key values`);
    } else {
      console.log(`❌ FAIL: Round-trip conversion loses precision`);
    }

    const allPassed = test1Pass && test2Pass && test3Pass && test4Pass;
    if (allPassed) {
      passCount++;
      console.log(`\n✅ All tests passed for "${testCase.name}"`);
    } else {
      failCount++;
      console.log(`\n❌ Some tests failed for "${testCase.name}"`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total test cases: ${testCases.length}`);
  console.log(`Passed: ${passCount}`);
  console.log(`Failed: ${failCount}`);
  console.log('='.repeat(80));

  return failCount === 0;
}

// Run the tests
const success = testCornerConversion();
process.exit(success ? 0 : 1);
