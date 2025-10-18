export const RENDER_LAYER_BOOLEAN_KEYS = [
  'showTable',
  'showFrame',
  'showRails',
  'showPockets',
  'showBalls',
  'showUIOverlay',
  'showMeasurementOverlay',
  'showReferenceOverlay',
] as const;

export const RENDER_LAYER_ORDER_KEYS = [
  'orderTable',
  'orderFrame',
  'orderRails',
  'orderPockets',
  'orderBalls',
  'orderUI',
] as const;

export type RenderLayerBooleanKey = typeof RENDER_LAYER_BOOLEAN_KEYS[number];
export type RenderLayerOrderKey = typeof RENDER_LAYER_ORDER_KEYS[number];

export interface RenderLayerSettings {
  showTable: boolean;
  showFrame: boolean;
  showRails: boolean;
  showPockets: boolean;
  showBalls: boolean;
  showUIOverlay: boolean;
  showMeasurementOverlay: boolean;
  showReferenceOverlay: boolean;
  orderTable: number;
  orderFrame: number;
  orderRails: number;
  orderPockets: number;
  orderBalls: number;
  orderUI: number;
}

export const defaultRenderLayerSettings: RenderLayerSettings = {
  showTable: true,
  showFrame: true,
  showRails: true,
  showPockets: true,
  showBalls: true,
  showUIOverlay: true,
  showMeasurementOverlay: false,
  showReferenceOverlay: false,
  orderTable: 0,
  orderFrame: 5,
  orderRails: 10,
  orderPockets: 20,
  orderBalls: 30,
  orderUI: 40,
};
