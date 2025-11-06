/**
 * Modern Pocket Geometry System
 *
 * This module defines a new angle-based parametrization for pocket geometry
 * that is more intuitive and easier to configure than the legacy tangent-derivation system.
 *
 * Key differences from legacy system:
 * - Direct angle control instead of derived positions
 * - Physical measurements (opening width, jaw angle) instead of mathematical parameters
 * - Template-based quick setup with fine-tuning capability
 */

/**
 * Pocket configuration for a single pocket type (side or corner)
 */
export interface PocketConfig {
  /** Width of pocket opening at the throat (narrowest point) in inches */
  opening: number;

  /** Angle between the jaw rail and straight rail in degrees (typically 3-7°) */
  jawAngle: number;

  /** How far the pocket extends into the table in inches */
  depth: number;

  /** Depth of the shelf (flat area) inside pocket in inches */
  shelfDepth: number;

  /** Blend factor for rail curvature: 0=straight transition, 1=fully curved */
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
      opening: 5.25,
      jawAngle: 6.0,
      depth: 1.5,        // Distance from play edge to straight rail end
      shelfDepth: 0.3,
      railCurve: 0.0,
    },
    corner: {
      opening: 4.75,
      jawAngle: 5.0,
      depth: 1.75,
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
      opening: 5.0,
      jawAngle: 5.5,
      depth: 1.4,        // Tight - straight rail closer to center
      shelfDepth: 0.25,
      railCurve: 0.0,
    },
    corner: {
      opening: 4.5,
      jawAngle: 4.5,
      depth: 1.625,
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
      opening: 5.25,
      jawAngle: 6.0,
      depth: 1.5,        // Medium depth
      shelfDepth: 0.3,
      railCurve: 0.0,
    },
    corner: {
      opening: 4.75,
      jawAngle: 5.0,
      depth: 1.75,
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
      opening: 5.5,
      jawAngle: 6.5,
      depth: 1.6,        // Loose - straight rail farther from center
      shelfDepth: 0.375,
      railCurve: 0.0,
    },
    corner: {
      opening: 5.0,
      jawAngle: 5.5,
      depth: 1.875,
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
      opening: 5.0625,  // 5 1/16"
      jawAngle: 5.5,
      depth: 1.5,
      shelfDepth: 0.25,
      railCurve: 0.0,
    },
    corner: {
      opening: 4.5625,  // 4 9/16"
      jawAngle: 4.5,
      depth: 1.7,
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
      opening: 5.375,  // 5 3/8"
      jawAngle: 6.5,
      depth: 1.6,        // Looser pockets
      shelfDepth: 0.375,
      railCurve: 0.0,
    },
    corner: {
      opening: 4.6875, // 4 11/16"
      jawAngle: 5.5,
      depth: 2.0,
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
      opening: 4.0,     // Extremely tight for professional play
      jawAngle: 5.0,
      depth: 1.3,        // Very tight - straight rail very close to center
      shelfDepth: 0.25,
      railCurve: 0.0,
    },
    corner: {
      opening: 4.5,
      jawAngle: 4.0,    // Very tight
      depth: 1.5,
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
  corner: {
    opening: { min: 4.0, max: 5.5, typical: 4.75 },
    jawAngle: { min: 3.0, max: 7.0, typical: 5.0 },
    depth: { min: 1.0, max: 2.5, typical: 1.75 },
    shelfDepth: { min: 1.0, max: 2.5, typical: 1.75 },
    railCurve: { min: 0.0, max: 1.0, typical: 0.0 },
  },
  side: {
    opening: { min: 4.0, max: 6.0, typical: 5.25 },
    jawAngle: { min: 4.0, max: 8.0, typical: 6.0 },
    depth: { min: 0.5, max: 2.5, typical: 1.5 },  // Distance from play edge to straight rail
    shelfDepth: { min: 0.0, max: 0.5, typical: 0.25 },
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

  // Validate corner pocket
  if (geometry.corner.opening < GEOMETRY_RANGES.corner.opening.min ||
      geometry.corner.opening > GEOMETRY_RANGES.corner.opening.max) {
    errors.push(
      `Corner opening ${geometry.corner.opening}" is out of range ` +
      `(${GEOMETRY_RANGES.corner.opening.min}-${GEOMETRY_RANGES.corner.opening.max})`
    );
  }

  if (geometry.corner.jawAngle < GEOMETRY_RANGES.corner.jawAngle.min ||
      geometry.corner.jawAngle > GEOMETRY_RANGES.corner.jawAngle.max) {
    errors.push(
      `Corner jaw angle ${geometry.corner.jawAngle}° is out of range ` +
      `(${GEOMETRY_RANGES.corner.jawAngle.min}-${GEOMETRY_RANGES.corner.jawAngle.max})`
    );
  }

  if (geometry.corner.depth < GEOMETRY_RANGES.corner.depth.min ||
      geometry.corner.depth > GEOMETRY_RANGES.corner.depth.max) {
    errors.push(
      `Corner depth ${geometry.corner.depth}" is out of range ` +
      `(${GEOMETRY_RANGES.corner.depth.min}-${GEOMETRY_RANGES.corner.depth.max})`
    );
  }

  // Validate side pocket
  if (geometry.side.opening < GEOMETRY_RANGES.side.opening.min ||
      geometry.side.opening > GEOMETRY_RANGES.side.opening.max) {
    errors.push(
      `Side opening ${geometry.side.opening}" is out of range ` +
      `(${GEOMETRY_RANGES.side.opening.min}-${GEOMETRY_RANGES.side.opening.max})`
    );
  }

  if (geometry.side.jawAngle < GEOMETRY_RANGES.side.jawAngle.min ||
      geometry.side.jawAngle > GEOMETRY_RANGES.side.jawAngle.max) {
    errors.push(
      `Side jaw angle ${geometry.side.jawAngle}° is out of range ` +
      `(${GEOMETRY_RANGES.side.jawAngle.min}-${GEOMETRY_RANGES.side.jawAngle.max})`
    );
  }

  if (geometry.side.depth < GEOMETRY_RANGES.side.depth.min ||
      geometry.side.depth > GEOMETRY_RANGES.side.depth.max) {
    errors.push(
      `Side depth ${geometry.side.depth}" is out of range ` +
      `(${GEOMETRY_RANGES.side.depth.min}-${GEOMETRY_RANGES.side.depth.max})`
    );
  }

  // Warnings for unusual configurations
  if (geometry.corner.opening >= geometry.side.opening) {
    warnings.push('Corner pockets are as wide or wider than side pockets (unusual)');
  }

  if (geometry.corner.jawAngle >= geometry.side.jawAngle) {
    warnings.push('Corner jaw angle is as steep or steeper than side jaw angle (unusual)');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
