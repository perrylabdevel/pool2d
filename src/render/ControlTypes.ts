export type MicroDialRenderState = {
  value: number;
  degrees: number;
  isActive: boolean;
};

export type PocketAnimationEvent = {
  ballId: number;
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  pocket: { id: string | null; x: number; y: number };
  radius: number;
  timestamp: number;
  icon?: string;
};
