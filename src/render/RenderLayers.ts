export const RENDER_LAYER_BOOLEAN_KEYS = [
  'showTable',
  'showFrame',
  'showSkin',
  'showRails',
  'showPockets',
  'showCaps',
  'showBalls',
  'showUIOverlay',
  'showMeasurementOverlay',
  'showReferenceOverlay',
  'showTextures',
] as const;

export const RENDER_LAYER_ORDER_KEYS = [
  'orderTable',
  'orderFrame',
  'orderRails',
  'orderPockets',
  'orderCaps',
  'orderBalls',
  'orderUI',
] as const;

export type RenderLayerBooleanKey = typeof RENDER_LAYER_BOOLEAN_KEYS[number];
export type RenderLayerOrderKey = typeof RENDER_LAYER_ORDER_KEYS[number];

export interface RenderLayerSettings {
  showTable: boolean;
  showFrame: boolean;
  showSkin: boolean;
  showRails: boolean;
  showPockets: boolean;
  showCaps: boolean;
  showBalls: boolean;
  showUIOverlay: boolean;
  showMeasurementOverlay: boolean;
  showReferenceOverlay: boolean;
  showTextures: boolean;
  orderTable: number;
  orderFrame: number;
  orderRails: number;
  orderPockets: number;
  orderCaps: number;
  orderBalls: number;
  orderUI: number;
}

export const defaultRenderLayerSettings: RenderLayerSettings = {
  showTable: true,
  showFrame: true,
  showSkin: true,
  showRails: true,
  showPockets: true,
  showCaps: true,
  showBalls: true,
  showUIOverlay: true,
  showMeasurementOverlay: false,
  showReferenceOverlay: false,
  showTextures: true,
  orderTable: 0,
  orderFrame: 5,
  orderRails: 10,
  orderPockets: 20,
  orderCaps: 25,
  orderBalls: 30,
  orderUI: 40,
};
