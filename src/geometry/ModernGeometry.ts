/**
 * Modern Pocket Geometry System
 *
 * This module defines a physical measurement-based parametrization for pocket geometry
 * that is more intuitive and easier to configure than the legacy tangent-derivation system.
 *
 * Key differences from legacy system:
 * - Direct width control (mouth and throat) instead of derived positions
 * - Physical measurements (mouth width, throat width, depths) instead of mathematical parameters
 * - Jaw angle emerges naturally from geometry instead of being an input
 * - Template-based quick setup with fine-tuning capability
 */

/**
 * Pocket configuration using physical measurements
 *
 * Pockets have two widths (mouth and throat) and two depths
 * (rail depth and jaw depth).
 */
export interface PocketConfig {
  /** Width at cushion nose / mouth (where straight rail ends), in inches */
  mouthWidth: number;

  /** Width at throat (narrowest point, deeper in pocket), in inches */
  throatWidth: number;

  /** Distance from play area edge to straight rail end, in inches */
  railDepth: number;

  /** Distance from straight rail to throat (jaw section), in inches */
  jawDepth: number;

  /** Depth of shelf (flat area inside pocket), in inches */
  shelfDepth: number;

  /** Blend factor for rail curvature: 0=straight, 1=curved */
  railCurve?: number;
}

/**
 * Complete modern pocket geometry specification
 */
export interface ModernPocketGeometry {
  /** Template name (if using a template) */
  template?: PocketTemplate;

  /** Side pocket configuration */
  side: PocketConfig;

  /** Corner pocket configuration */
  corner: PocketConfig;

  /** Global geometry settings */
  global?: {
    /** Adjustment to cut angle in degrees */
    cutAngleAdjust?: number;

    /** Vertical pocket angle in degrees (12-15° typical) */
    verticalAngle?: number;
  };
}

/**
 * Available geometry templates
 */
export enum PocketTemplate {
  CUSTOM = 'custom',
  CURRENT_DEFAULT = 'current_default',
  BCA_TOURNAMENT_TIGHT = 'bca_tournament_tight',
  BCA_TOURNAMENT_MEDIUM = 'bca_tournament_medium',
  BCA_TOURNAMENT_LOOSE = 'bca_tournament_loose',
  BRUNSWICK_GOLD_CROWN = 'brunswick_gold_crown',
  VALLEY_BAR_TABLE = 'valley_bar_table',
  DIAMOND_PRO_AM = 'diamond_pro_am',
}

/**
 * Template configurations based on real table specifications
 */
export const GEOMETRY_TEMPLATES: Record<PocketTemplate, ModernPocketGeometry> = {
  [PocketTemplate.CUSTOM]: {
    template: PocketTemplate.CUSTOM,
    side: {
      mouthWidth: 5.5,
      throatWidth: 4.625,
      railDepth: 1.5,
      jawDepth: 1.1,
      shelfDepth: 0.3,
      railCurve: 0.0,
    },
    corner: {
      mouthWidth: 5.0,
      throatWidth: 4.125,
      railDepth: 1.75,
      jawDepth: 1.0,
      shelfDepth: 1.75,
      railCurve: 0.0,
    },
    global: {
      cutAngleAdjust: 0,
      verticalAngle: 13.5,
    },
  },

  [PocketTemplate.CURRENT_DEFAULT]: {
    template: PocketTemplate.CURRENT_DEFAULT,
    side: {
      mouthWidth: 10.97,    // Extremely wide (legacy default)
      throatWidth: 9.70,    // Extremely wide
      railDepth: 1.5,
      jawDepth: 1.1,
      shelfDepth: 0.3,
      railCurve: 0.0,
    },
    corner: {
      mouthWidth: 5.0,      // Reasonable
      throatWidth: 4.5,
      railDepth: 1.75,
      jawDepth: 1.0,
      shelfDepth: 1.75,
      railCurve: 0.0,
    },
    global: {
      cutAngleAdjust: 0,
      verticalAngle: 13.5,
    },
  },

  [PocketTemplate.BCA_TOURNAMENT_TIGHT]: {
    template: PocketTemplate.BCA_TOURNAMENT_TIGHT,
    side: {
      mouthWidth: 5.375,    // BCA minimum
      throatWidth: 4.375,   // BCA minimum
      railDepth: 1.4,       // Tighter play area
      jawDepth: 1.1,
      shelfDepth: 0.25,
      railCurve: 0.0,
    },
    corner: {
      mouthWidth: 4.875,    // BCA minimum
      throatWidth: 4.0,     // BCA minimum
      railDepth: 1.625,
      jawDepth: 1.0,
      shelfDepth: 1.625,
      railCurve: 0.0,
    },
    global: {
      cutAngleAdjust: 0,
      verticalAngle: 13.5,
    },
  },

  [PocketTemplate.BCA_TOURNAMENT_MEDIUM]: {
    template: PocketTemplate.BCA_TOURNAMENT_MEDIUM,
    side: {
      mouthWidth: 5.5,      // BCA mid-range
      throatWidth: 4.625,   // BCA mid-range
      railDepth: 1.5,
      jawDepth: 1.1,
      shelfDepth: 0.3,
      railCurve: 0.0,
    },
    corner: {
      mouthWidth: 5.0,      // BCA mid-range
      throatWidth: 4.125,   // BCA mid-range
      railDepth: 1.75,
      jawDepth: 1.0,
      shelfDepth: 1.75,
      railCurve: 0.0,
    },
    global: {
      cutAngleAdjust: 0,
      verticalAngle: 13.5,
    },
  },

  [PocketTemplate.BCA_TOURNAMENT_LOOSE]: {
    template: PocketTemplate.BCA_TOURNAMENT_LOOSE,
    side: {
      mouthWidth: 5.625,    // BCA maximum
      throatWidth: 4.875,   // BCA maximum
      railDepth: 1.6,       // Looser play area
      jawDepth: 1.1,
      shelfDepth: 0.375,
      railCurve: 0.0,
    },
    corner: {
      mouthWidth: 5.125,    // BCA maximum
      throatWidth: 4.25,    // BCA maximum
      railDepth: 1.875,
      jawDepth: 1.0,
      shelfDepth: 1.875,
      railCurve: 0.0,
    },
    global: {
      cutAngleAdjust: 0,
      verticalAngle: 13.5,
    },
  },

  [PocketTemplate.BRUNSWICK_GOLD_CROWN]: {
    template: PocketTemplate.BRUNSWICK_GOLD_CROWN,
    side: {
      mouthWidth: 5.5,
      throatWidth: 4.5,
      railDepth: 1.5,
      jawDepth: 1.1,
      shelfDepth: 0.25,
      railCurve: 0.0,
    },
    corner: {
      mouthWidth: 4.9,
      throatWidth: 4.0,
      railDepth: 1.7,
      jawDepth: 1.0,
      shelfDepth: 1.7,
      railCurve: 0.0,
    },
    global: {
      cutAngleAdjust: 0,
      verticalAngle: 13.5,
    },
  },

  [PocketTemplate.VALLEY_BAR_TABLE]: {
    template: PocketTemplate.VALLEY_BAR_TABLE,
    side: {
      mouthWidth: 6.0,      // Generous for bar play
      throatWidth: 5.0,
      railDepth: 1.6,
      jawDepth: 1.2,
      shelfDepth: 0.375,
      railCurve: 0.0,
    },
    corner: {
      mouthWidth: 5.25,
      throatWidth: 4.5,
      railDepth: 2.0,
      jawDepth: 1.0,
      shelfDepth: 2.0,
      railCurve: 0.0,
    },
    global: {
      cutAngleAdjust: 0,
      verticalAngle: 14.0,
    },
  },

  [PocketTemplate.DIAMOND_PRO_AM]: {
    template: PocketTemplate.DIAMOND_PRO_AM,
    side: {
      mouthWidth: 4.5,      // Extremely tight
      throatWidth: 3.5,     // Extremely tight
      railDepth: 1.3,
      jawDepth: 1.0,
      shelfDepth: 0.25,
      railCurve: 0.0,
    },
    corner: {
      mouthWidth: 4.5,
      throatWidth: 3.5,
      railDepth: 1.5,
      jawDepth: 1.0,
      shelfDepth: 1.5,
      railCurve: 0.0,
    },
    global: {
      cutAngleAdjust: 0,
      verticalAngle: 12.0,
    },
  },
};

/**
 * Valid ranges for geometry parameters
 */
export const GEOMETRY_RANGES = {
  side: {
    mouthWidth: { min: 4.0, max: 12.0, typical: 5.5 },
    throatWidth: { min: 3.0, max: 11.0, typical: 4.625 },
    railDepth: { min: 0.5, max: 2.5, typical: 1.5 },
    jawDepth: { min: 0.5, max: 2.0, typical: 1.1 },
    shelfDepth: { min: 0.0, max: 0.5, typical: 0.25 },
    railCurve: { min: 0.0, max: 1.0, typical: 0.0 },
  },
  corner: {
    mouthWidth: { min: 4.0, max: 6.0, typical: 5.0 },
    throatWidth: { min: 3.0, max: 5.0, typical: 4.125 },
    railDepth: { min: 1.0, max: 2.5, typical: 1.75 },
    jawDepth: { min: 0.5, max: 1.5, typical: 1.0 },
    shelfDepth: { min: 1.0, max: 2.5, typical: 1.75 },
    railCurve: { min: 0.0, max: 1.0, typical: 0.0 },
  },
  global: {
    cutAngleAdjust: { min: -5.0, max: 5.0, typical: 0.0 },
    verticalAngle: { min: 12.0, max: 15.0, typical: 13.5 },
  },
} as const;

/**
 * Get human-readable name for a template
 */
export function getTemplateName(template: PocketTemplate): string {
  const names: Record<PocketTemplate, string> = {
    [PocketTemplate.CUSTOM]: 'Custom',
    [PocketTemplate.CURRENT_DEFAULT]: 'Current Default',
    [PocketTemplate.BCA_TOURNAMENT_TIGHT]: 'BCA Tournament - Tight',
    [PocketTemplate.BCA_TOURNAMENT_MEDIUM]: 'BCA Tournament - Medium',
    [PocketTemplate.BCA_TOURNAMENT_LOOSE]: 'BCA Tournament - Loose',
    [PocketTemplate.BRUNSWICK_GOLD_CROWN]: 'Brunswick Gold Crown VI',
    [PocketTemplate.VALLEY_BAR_TABLE]: 'Valley Bar Table',
    [PocketTemplate.DIAMOND_PRO_AM]: 'Diamond Pro-Am 9\'',
  };
  return names[template];
}

/**
 * Get description for a template
 */
export function getTemplateDescription(template: PocketTemplate): string {
  const descriptions: Record<PocketTemplate, string> = {
    [PocketTemplate.CUSTOM]: 'User-defined custom geometry',
    [PocketTemplate.CURRENT_DEFAULT]: 'Legacy default (extremely wide side pockets)',
    [PocketTemplate.BCA_TOURNAMENT_TIGHT]: 'Challenging tournament specification',
    [PocketTemplate.BCA_TOURNAMENT_MEDIUM]: 'Standard tournament specification',
    [PocketTemplate.BCA_TOURNAMENT_LOOSE]: 'Forgiving tournament specification',
    [PocketTemplate.BRUNSWICK_GOLD_CROWN]: 'Professional tournament table',
    [PocketTemplate.VALLEY_BAR_TABLE]: 'Typical coin-op bar table',
    [PocketTemplate.DIAMOND_PRO_AM]: 'Professional 9-ball specification',
  };
  return descriptions[template];
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate a modern geometry configuration
 */
export function validateModernGeometry(geometry: ModernPocketGeometry): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate side pocket
  if (geometry.side.mouthWidth < GEOMETRY_RANGES.side.mouthWidth.min ||
      geometry.side.mouthWidth > GEOMETRY_RANGES.side.mouthWidth.max) {
    errors.push(
      `Side mouth width ${geometry.side.mouthWidth}" is out of range ` +
      `(${GEOMETRY_RANGES.side.mouthWidth.min}-${GEOMETRY_RANGES.side.mouthWidth.max})`
    );
  }

  if (geometry.side.throatWidth < GEOMETRY_RANGES.side.throatWidth.min ||
      geometry.side.throatWidth > GEOMETRY_RANGES.side.throatWidth.max) {
    errors.push(
      `Side throat width ${geometry.side.throatWidth}" is out of range ` +
      `(${GEOMETRY_RANGES.side.throatWidth.min}-${GEOMETRY_RANGES.side.throatWidth.max})`
    );
  }

  if (geometry.side.railDepth < GEOMETRY_RANGES.side.railDepth.min ||
      geometry.side.railDepth > GEOMETRY_RANGES.side.railDepth.max) {
    errors.push(
      `Side rail depth ${geometry.side.railDepth}" is out of range ` +
      `(${GEOMETRY_RANGES.side.railDepth.min}-${GEOMETRY_RANGES.side.railDepth.max})`
    );
  }

  if (geometry.side.jawDepth < GEOMETRY_RANGES.side.jawDepth.min ||
      geometry.side.jawDepth > GEOMETRY_RANGES.side.jawDepth.max) {
    errors.push(
      `Side jaw depth ${geometry.side.jawDepth}" is out of range ` +
      `(${GEOMETRY_RANGES.side.jawDepth.min}-${GEOMETRY_RANGES.side.jawDepth.max})`
    );
  }

  // Validate corner pocket
  if (geometry.corner.mouthWidth < GEOMETRY_RANGES.corner.mouthWidth.min ||
      geometry.corner.mouthWidth > GEOMETRY_RANGES.corner.mouthWidth.max) {
    errors.push(
      `Corner mouth width ${geometry.corner.mouthWidth}" is out of range ` +
      `(${GEOMETRY_RANGES.corner.mouthWidth.min}-${GEOMETRY_RANGES.corner.mouthWidth.max})`
    );
  }

  if (geometry.corner.throatWidth < GEOMETRY_RANGES.corner.throatWidth.min ||
      geometry.corner.throatWidth > GEOMETRY_RANGES.corner.throatWidth.max) {
    errors.push(
      `Corner throat width ${geometry.corner.throatWidth}" is out of range ` +
      `(${GEOMETRY_RANGES.corner.throatWidth.min}-${GEOMETRY_RANGES.corner.throatWidth.max})`
    );
  }

  if (geometry.corner.railDepth < GEOMETRY_RANGES.corner.railDepth.min ||
      geometry.corner.railDepth > GEOMETRY_RANGES.corner.railDepth.max) {
    errors.push(
      `Corner rail depth ${geometry.corner.railDepth}" is out of range ` +
      `(${GEOMETRY_RANGES.corner.railDepth.min}-${GEOMETRY_RANGES.corner.railDepth.max})`
    );
  }

  if (geometry.corner.jawDepth < GEOMETRY_RANGES.corner.jawDepth.min ||
      geometry.corner.jawDepth > GEOMETRY_RANGES.corner.jawDepth.max) {
    errors.push(
      `Corner jaw depth ${geometry.corner.jawDepth}" is out of range ` +
      `(${GEOMETRY_RANGES.corner.jawDepth.min}-${GEOMETRY_RANGES.corner.jawDepth.max})`
    );
  }

  // Validation rules: throat must be narrower than mouth
  if (geometry.side.throatWidth >= geometry.side.mouthWidth) {
    errors.push('Side throat must be narrower than mouth');
  }

  if (geometry.corner.throatWidth >= geometry.corner.mouthWidth) {
    errors.push('Corner throat must be narrower than mouth');
  }

  // Warnings for unusual configurations
  if (geometry.corner.mouthWidth >= geometry.side.mouthWidth) {
    warnings.push('Corner pockets are as wide or wider than side pockets (unusual)');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
