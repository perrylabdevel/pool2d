import { CONFIG } from '../config';

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

// When using JSON geometry, default certain procedural layers to off (skin overlay replaces them)
const useJsonDefaults = CONFIG.USE_JSON_GEOMETRY ?? false;

export const defaultRenderLayerSettings: RenderLayerSettings = {
  showTable: !useJsonDefaults,
  showFrame: !useJsonDefaults,
  showSkin: true,
  showRails: !useJsonDefaults,
  showPockets: true,
  showCaps: !useJsonDefaults,
  showBalls: true,
  showUIOverlay: true,
  showMeasurementOverlay: false,
  showReferenceOverlay: false,
  showTextures: !useJsonDefaults,
  orderTable: 0,
  orderFrame: 5,
  orderRails: 10,
  orderPockets: 20,
  orderCaps: 25,
  orderBalls: 30,
  orderUI: 40,
};
