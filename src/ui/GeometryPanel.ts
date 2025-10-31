import { SettingsManager, GeometrySettings } from './SettingsManager';
import { makePanelDraggable } from './drag';
import { UIPanel } from './panels/UIPanel';

const formatNumber = (value: number, digits: number = 2): string =>
  value.toFixed(digits).replace(/\.0+$|\.([0-9]*[1-9])0+$/, '.$1').replace(/\.$/, '');

export class GeometryPanel {
  private panel: HTMLElement;
  private panelController: UIPanel;
  private settingsManager: SettingsManager;
  private onGeometryChange: () => void;

  constructor(settingsManager: SettingsManager, onGeometryChange: () => void) {
    this.settingsManager = settingsManager;
    this.onGeometryChange = onGeometryChange;
    
    this.panel = document.getElementById('geometry-panel')!;
    const header = this.panel.querySelector('.panel-header') as HTMLElement | null;
    if (header && !this.panel.closest('#panel-dock')) {
      makePanelDraggable(this.panel, header);
    }

    const focusTarget = this.panel.querySelector<HTMLElement>('input, button');
    this.panelController = new UIPanel({
      id: 'geometry-panel',
      element: this.panel,
      focusTarget,
    });
    this.panelController.addEventListener('panel:open', () => this.loadCurrentValues());

    this.setupControls();
    this.loadCurrentValues();
  }

  private setupControls() {
    // Close button
    const closeBtn = document.getElementById('geometry-panel-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }

    const notify = (settings: Partial<GeometrySettings>) => {
      this.settingsManager.saveGeometrySettings(settings);
      this.onGeometryChange();
    };

    const initNullableSlider = (
      sliderId: string,
      labelId: string,
      autoBtnId: string,
      key: keyof GeometrySettings,
      clamp: (value: number) => number,
      formatDigits: number = 2
    ) => {
      const slider = document.getElementById(sliderId) as HTMLInputElement | null;
      const label = document.getElementById(labelId);
      const autoBtn = document.getElementById(autoBtnId);
      if (!slider || !label || !autoBtn) return;

      const defaultValue = slider.dataset.default ? parseFloat(slider.dataset.default) : parseFloat(slider.value);

      const updateLabel = (value: number | null) => {
        if (value == null) {
          label.textContent = 'Auto';
        } else {
          label.textContent = formatNumber(value, formatDigits);
        }
      };

      slider.addEventListener('input', (e) => {
        const raw = parseFloat((e.target as HTMLInputElement).value);
        const clamped = clamp(raw);
        slider.value = clamped.toFixed(formatDigits);
        updateLabel(clamped);
        notify({ [key]: clamped } as Partial<GeometrySettings>);
      });

      autoBtn.addEventListener('click', () => {
        slider.value = (defaultValue ?? 0).toFixed(formatDigits);
        updateLabel(null);
        notify({ [key]: null } as Partial<GeometrySettings>);
      });

      return { updateLabel };
    };

    const sideRadiusSlider = document.getElementById('live-side-radius') as HTMLInputElement;
    const sideRadiusVal = document.getElementById('live-side-radius-val');
    if (sideRadiusSlider && sideRadiusVal) {
      sideRadiusSlider.addEventListener('input', (e) => {
        const value = parseFloat((e.target as HTMLInputElement).value);
        sideRadiusVal.textContent = formatNumber(value, 1);
        notify({ JAW_REF_RADIUS_IN: value });
      });
    }

    const sideSteepnessSlider = document.getElementById('live-side-steepness') as HTMLInputElement;
    const sideSteepnessVal = document.getElementById('live-side-steepness-val');
    if (sideSteepnessSlider && sideSteepnessVal) {
      sideSteepnessSlider.addEventListener('input', (e) => {
        const value = parseFloat((e.target as HTMLInputElement).value);
        sideSteepnessVal.textContent = formatNumber(value, 1);
        notify({ SIDE_FRAME_OFFSET_IN: value });
      });
    }

    const sideOffsetSlider = document.getElementById('live-side-offset') as HTMLInputElement;
    const sideOffsetVal = document.getElementById('live-side-offset-val');
    if (sideOffsetSlider && sideOffsetVal) {
      sideOffsetSlider.addEventListener('input', (e) => {
        const value = parseFloat((e.target as HTMLInputElement).value);
        sideOffsetVal.textContent = formatNumber(value);
        notify({ SIDE_POCKET_OUTWARD_OFFSET_IN: value });
      });
    }

    const sideStraightSlider = document.getElementById('live-side-straight') as HTMLInputElement;
    const sideStraightVal = document.getElementById('live-side-straight-val');
    const sideInnerSlider = document.getElementById('live-side-inner') as HTMLInputElement;
    const sideInnerVal = document.getElementById('live-side-inner-val');

    const updateSideStraight = (value: number, shouldPersistInner: boolean = true) => {
      if (sideStraightVal) {
        sideStraightVal.textContent = formatNumber(value);
      }
      if (sideInnerSlider) {
        const minInner = value + 0.05;
        sideInnerSlider.min = minInner.toFixed(2);
        let innerValue = parseFloat(sideInnerSlider.value || '0');
        if (!Number.isFinite(innerValue) || innerValue < minInner) {
          innerValue = minInner;
          sideInnerSlider.value = minInner.toFixed(2);
        }
        if (sideInnerVal) {
          sideInnerVal.textContent = formatNumber(innerValue);
        }
        const payload: Partial<GeometrySettings> = { SIDE_STRAIGHT_Y_IN: value };
        if (shouldPersistInner) {
          payload.SIDE_INNER_Y_IN = innerValue;
        }
        notify(payload);
      } else {
        notify({ SIDE_STRAIGHT_Y_IN: value });
      }
    };

    if (sideStraightSlider) {
      sideStraightSlider.addEventListener('input', (e) => {
        const value = parseFloat((e.target as HTMLInputElement).value);
        updateSideStraight(value);
      });
    }

    if (sideInnerSlider && sideInnerVal) {
      sideInnerSlider.addEventListener('input', (e) => {
        const valueRaw = parseFloat((e.target as HTMLInputElement).value);
        const straightValue = sideStraightSlider ? parseFloat(sideStraightSlider.value) : this.settingsManager.getGeometrySettings().SIDE_STRAIGHT_Y_IN;
        const minInner = straightValue + 0.05;
        const value = Math.max(minInner, valueRaw);
        sideInnerSlider.value = value.toFixed(2);
        sideInnerVal.textContent = formatNumber(value);
        notify({ SIDE_INNER_Y_IN: value });
      });
    }

    const initOverrideSlider = (
      sliderId: string,
      labelId: string,
      autoBtnId: string,
      key: 'SIDE_JAW_OUTER_OVERRIDE_IN' | 'SIDE_JAW_INNER_OVERRIDE_IN' | 'CORNER_JAW_X_OVERRIDE_IN' | 'CORNER_JAW_Y_OVERRIDE_IN',
      clamp: (value: number) => number,
      formatDigits: number = 2
    ) => {
      const slider = document.getElementById(sliderId) as HTMLInputElement | null;
      const label = document.getElementById(labelId);
      const autoBtn = document.getElementById(autoBtnId);
      if (!slider || !label || !autoBtn) return;

      const updateLabel = (value: number, isAuto: boolean) => {
        label.textContent = isAuto ? 'Auto' : formatNumber(value, formatDigits);
      };

      slider.addEventListener('input', (e) => {
        const raw = parseFloat((e.target as HTMLInputElement).value);
        const clamped = clamp(raw);
        slider.value = clamped.toFixed(formatDigits);
        updateLabel(clamped, false);
        notify({ [key]: clamped } as Partial<GeometrySettings>);
      });

      autoBtn.addEventListener('click', () => {
        const settings = this.settingsManager.getGeometrySettings();
        updateLabel(0, true);
        notify({ [key]: null } as Partial<GeometrySettings>);
        if (key === 'SIDE_JAW_OUTER_OVERRIDE_IN') {
          const maxOuter = settings.CORNER_STRAIGHT_X_IN - 0.25;
          slider.value = maxOuter.toFixed(formatDigits);
        } else if (key === 'SIDE_JAW_INNER_OVERRIDE_IN') {
          const outer = settings.SIDE_JAW_OUTER_OVERRIDE_IN ?? settings.CORNER_STRAIGHT_X_IN - 0.25;
          slider.value = Math.max(0.5, outer - 0.25).toFixed(formatDigits);
        } else if (key === 'CORNER_JAW_X_OVERRIDE_IN') {
          slider.value = Math.min(settings.CORNER_STRAIGHT_X_IN - 0.25, settings.CORNER_STRAIGHT_X_IN).toFixed(formatDigits);
        } else {
          slider.value = Math.max(1, settings.CORNER_TARGET_Y_IN).toFixed(formatDigits);
        }
      });

      return { slider, label, updateLabel };
    };

    const getCurrentSettings = () => this.settingsManager.getGeometrySettings();

    initOverrideSlider(
      'live-side-jaw-outer',
      'live-side-jaw-outer-val',
      'live-side-jaw-outer-auto',
      'SIDE_JAW_OUTER_OVERRIDE_IN',
      (value) => {
        const { CORNER_STRAIGHT_X_IN } = getCurrentSettings();
        const maxOuter = CORNER_STRAIGHT_X_IN - 0.25;
        return Math.max(1, Math.min(maxOuter, value));
      }
    );

    initOverrideSlider(
      'live-side-jaw-inner',
      'live-side-jaw-inner-val',
      'live-side-jaw-inner-auto',
      'SIDE_JAW_INNER_OVERRIDE_IN',
      (value) => {
        const settings = getCurrentSettings();
        const maxOuter = settings.SIDE_JAW_OUTER_OVERRIDE_IN ?? settings.CORNER_STRAIGHT_X_IN - 0.25;
        return Math.max(0.5, Math.min(maxOuter - 0.25, value));
      }
    );

    const cornerRadiusSlider = document.getElementById('live-corner-radius') as HTMLInputElement;
    const cornerRadiusVal = document.getElementById('live-corner-radius-val');
    if (cornerRadiusSlider && cornerRadiusVal) {
      cornerRadiusSlider.addEventListener('input', (e) => {
        const value = parseFloat((e.target as HTMLInputElement).value);
        cornerRadiusVal.textContent = formatNumber(value, 1);
        notify({ CORNER_JAW_REF_RADIUS_IN: value });
      });
    }

    initOverrideSlider(
      'live-corner-jaw-x',
      'live-corner-jaw-x-val',
      'live-corner-jaw-x-auto',
      'CORNER_JAW_X_OVERRIDE_IN',
      (value) => {
        const { CORNER_STRAIGHT_X_IN } = getCurrentSettings();
        return Math.max(30, Math.min(CORNER_STRAIGHT_X_IN - 0.25, value));
      }
    );

    initOverrideSlider(
      'live-corner-jaw-y',
      'live-corner-jaw-y-val',
      'live-corner-jaw-y-auto',
      'CORNER_JAW_Y_OVERRIDE_IN',
      (value) => {
        const { SIDE_STRAIGHT_Y_IN } = getCurrentSettings();
        return Math.max(10, Math.min(SIDE_STRAIGHT_Y_IN - 0.25, value));
      }
    );

    initNullableSlider(
      'live-side-throat-width',
      'live-side-throat-width-val',
      'live-side-throat-width-auto',
      'SIDE_THROAT_WIDTH_IN',
      (value) => Math.max(1, Math.min(30, value))
    );

    initNullableSlider(
      'live-corner-throat-width',
      'live-corner-throat-width-val',
      'live-corner-throat-width-auto',
      'CORNER_THROAT_WIDTH_IN',
      (value) => Math.max(2, Math.min(50, value))
    );

    const initSimpleSlider = (
      sliderId: string,
      labelId: string,
      key: keyof GeometrySettings,
      formatDigits: number = 2,
      clamp?: (value: number) => number
    ) => {
      const slider = document.getElementById(sliderId) as HTMLInputElement | null;
      const label = document.getElementById(labelId);
      if (!slider || !label) return;

      slider.addEventListener('input', (e) => {
        const raw = parseFloat((e.target as HTMLInputElement).value);
        const value = clamp ? clamp(raw) : raw;
        slider.value = value.toFixed(formatDigits);
        label.textContent = formatNumber(value, formatDigits);
        notify({ [key]: value } as Partial<GeometrySettings>);
      });
    };

    initSimpleSlider('live-corner-pocket-capture', 'live-corner-pocket-capture-val', 'CORNER_POCKET_CAPTURE_RADIUS_IN');
    initSimpleSlider('live-side-pocket-capture', 'live-side-pocket-capture-val', 'SIDE_POCKET_CAPTURE_RADIUS_IN');
    initSimpleSlider('live-corner-pocket-visual', 'live-corner-pocket-visual-val', 'CORNER_POCKET_VISUAL_RADIUS_IN');
    initSimpleSlider('live-side-pocket-visual', 'live-side-pocket-visual-val', 'SIDE_POCKET_VISUAL_RADIUS_IN');
    initSimpleSlider('live-pocket-shelf-depth', 'live-pocket-shelf-depth-val', 'POCKET_SHELF_DEPTH_IN');
    initSimpleSlider('live-jaw-curve-blend', 'live-jaw-curve-blend-val', 'JAW_CURVE_BLEND', 2, (v) => Math.max(0, Math.min(1, v)));
    initSimpleSlider('live-corner-cut-angle', 'live-corner-cut-angle-val', 'CORNER_CUT_ANGLE_DEG', 1);
    initSimpleSlider('live-side-cut-angle', 'live-side-cut-angle-val', 'SIDE_CUT_ANGLE_DEG', 1);

    const cornerFrameSlider = document.getElementById('live-corner-frame') as HTMLInputElement;
    const cornerFrameVal = document.getElementById('live-corner-frame-val');
    if (cornerFrameSlider && cornerFrameVal) {
      cornerFrameSlider.addEventListener('input', (e) => {
        const value = parseFloat((e.target as HTMLInputElement).value);
        cornerFrameVal.textContent = formatNumber(value, 1);
        notify({ CORNER_FRAME_OFFSET_IN: value });
      });
    }

    const cornerStraightSlider = document.getElementById('live-corner-straight') as HTMLInputElement;
    const cornerStraightVal = document.getElementById('live-corner-straight-val');
    if (cornerStraightSlider && cornerStraightVal) {
      cornerStraightSlider.addEventListener('input', (e) => {
        const value = parseFloat((e.target as HTMLInputElement).value);
        cornerStraightVal.textContent = formatNumber(value);
        notify({ CORNER_STRAIGHT_X_IN: value });
      });
    }

    const cornerTargetSlider = document.getElementById('live-corner-target') as HTMLInputElement;
    const cornerTargetVal = document.getElementById('live-corner-target-val');
    if (cornerTargetSlider && cornerTargetVal) {
      cornerTargetSlider.addEventListener('input', (e) => {
        const value = parseFloat((e.target as HTMLInputElement).value);
        cornerTargetVal.textContent = formatNumber(value);
        notify({ CORNER_TARGET_Y_IN: value });
      });
    }

    const frameWidthSlider = document.getElementById('live-frame-width') as HTMLInputElement;
    const frameWidthVal = document.getElementById('live-frame-width-val');
    if (frameWidthSlider && frameWidthVal) {
      frameWidthSlider.addEventListener('input', (e) => {
        const value = parseFloat((e.target as HTMLInputElement).value);
        frameWidthVal.textContent = formatNumber(value, 1);
        notify({ FRAME_OFFSET_IN: value });
      });
    }

    const frameCornerRadiusSlider = document.getElementById(
      'live-frame-corner-radius'
    ) as HTMLInputElement;
    const frameCornerRadiusVal = document.getElementById('live-frame-corner-radius-val');
    if (frameCornerRadiusSlider && frameCornerRadiusVal) {
      frameCornerRadiusSlider.addEventListener('input', (e) => {
        const value = parseFloat((e.target as HTMLInputElement).value);
        frameCornerRadiusVal.textContent = formatNumber(value, 1);
        notify({ FRAME_CORNER_RADIUS_IN: value });
      });
    }

    const railThicknessInnerSlider = document.getElementById('live-rail-thickness-inner') as HTMLInputElement;
    const railThicknessInnerVal = document.getElementById('live-rail-thickness-inner-val');
    if (railThicknessInnerSlider && railThicknessInnerVal) {
      railThicknessInnerSlider.addEventListener('input', (e) => {
        const value = parseFloat((e.target as HTMLInputElement).value);
        railThicknessInnerVal.textContent = formatNumber(value);
        notify({ RAIL_THICKNESS_INNER: value });
      });
    }

    const railThicknessOuterSlider = document.getElementById('live-rail-thickness-outer') as HTMLInputElement;
    const railThicknessOuterVal = document.getElementById('live-rail-thickness-outer-val');
    if (railThicknessOuterSlider && railThicknessOuterVal) {
      railThicknessOuterSlider.addEventListener('input', (e) => {
        const value = parseFloat((e.target as HTMLInputElement).value);
        railThicknessOuterVal.textContent = formatNumber(value);
        notify({ RAIL_THICKNESS_OUTER: value });
      });
    }

    const resetBtn = document.getElementById('geometry-reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.settingsManager.resetGeometrySettings();
        this.loadCurrentValues();
        this.onGeometryChange();
      });
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.panelController.isOpen()) {
        this.close();
      }
    });
  }

  private loadCurrentValues() {
    const settings = this.settingsManager.getGeometrySettings();

    const setSlider = (id: string, value: number, formatter = (v: number) => formatNumber(v), digits = 2) => {
      const slider = document.getElementById(id) as HTMLInputElement | null;
      const valueSpan = document.getElementById(`${id}-val`);
      if (slider) {
        slider.value = value.toFixed(digits);
      }
      if (valueSpan) {
        valueSpan.textContent = formatter(value);
      }
      return slider;
    };

    setSlider('live-side-radius', settings.JAW_REF_RADIUS_IN, (v) => formatNumber(v, 1), 1);
    setSlider('live-side-steepness', settings.SIDE_FRAME_OFFSET_IN, (v) => formatNumber(v, 1), 1);
    const sideOffsetSlider = setSlider('live-side-offset', settings.SIDE_POCKET_OUTWARD_OFFSET_IN);

    const sideStraightSlider = setSlider('live-side-straight', settings.SIDE_STRAIGHT_Y_IN);
    const sideInnerSlider = document.getElementById('live-side-inner') as HTMLInputElement | null;
    const sideInnerVal = document.getElementById('live-side-inner-val');
    if (sideInnerSlider && sideInnerVal) {
      const minInner = settings.SIDE_STRAIGHT_Y_IN + 0.05;
      sideInnerSlider.min = minInner.toFixed(2);
      const innerValue = Math.max(minInner, settings.SIDE_INNER_Y_IN);
      sideInnerSlider.value = innerValue.toFixed(2);
      sideInnerVal.textContent = formatNumber(innerValue);
    }
    if (sideStraightSlider instanceof HTMLInputElement) {
      sideStraightSlider.value = settings.SIDE_STRAIGHT_Y_IN.toFixed(2);
    }

    const setOverrideSlider = (
      id: string,
      value: number | null,
      clamp: (value: number) => number,
      digits: number = 2
    ) => {
      const slider = document.getElementById(id) as HTMLInputElement | null;
      const valSpan = document.getElementById(`${id}-val`);
      if (!slider || !valSpan) return;
      if (value == null) {
        valSpan.textContent = 'Auto';
      } else {
        const clamped = clamp(value);
        slider.value = clamped.toFixed(digits);
        valSpan.textContent = formatNumber(clamped, digits);
      }
    };

    setOverrideSlider(
      'live-side-jaw-outer',
      settings.SIDE_JAW_OUTER_OVERRIDE_IN,
      (v) => {
        const maxOuter = settings.CORNER_STRAIGHT_X_IN - 0.25;
        return Math.max(1, Math.min(maxOuter, v));
      }
    );
    setOverrideSlider(
      'live-side-jaw-inner',
      settings.SIDE_JAW_INNER_OVERRIDE_IN,
      (v) => {
        const maxOuter = settings.SIDE_JAW_OUTER_OVERRIDE_IN ?? settings.CORNER_STRAIGHT_X_IN - 0.25;
        return Math.max(0.5, Math.min(maxOuter - 0.25, v));
      }
    );

    setOverrideSlider(
      'live-corner-jaw-x',
      settings.CORNER_JAW_X_OVERRIDE_IN,
      (v) => {
        const maxX = settings.CORNER_STRAIGHT_X_IN - 0.25;
        return Math.max(30, Math.min(maxX, v));
      }
    );
    setOverrideSlider(
      'live-corner-jaw-y',
      settings.CORNER_JAW_Y_OVERRIDE_IN,
      (v) => {
        const maxY = settings.SIDE_STRAIGHT_Y_IN - 0.25;
        return Math.max(10, Math.min(maxY, v));
      }
    );

    const setNullableSlider = (
      sliderId: string,
      value: number | null,
      digits: number = 2,
      clamp?: (val: number) => number
    ) => {
      const slider = document.getElementById(sliderId) as HTMLInputElement | null;
      const valSpan = document.getElementById(`${sliderId}-val`);
      if (!slider || !valSpan) return;
      const defaultValue = slider.dataset.default ? parseFloat(slider.dataset.default) : parseFloat(slider.value);
      if (value == null) {
        valSpan.textContent = 'Auto';
        slider.value = (defaultValue ?? 0).toFixed(digits);
      } else {
        const clamped = clamp ? clamp(value) : value;
        slider.value = clamped.toFixed(digits);
        valSpan.textContent = formatNumber(clamped, digits);
      }
    };

    setNullableSlider('live-side-throat-width', settings.SIDE_THROAT_WIDTH_IN, 2, (v) => Math.max(1, Math.min(30, v)));
    setNullableSlider('live-corner-throat-width', settings.CORNER_THROAT_WIDTH_IN, 2, (v) => Math.max(2, Math.min(50, v)));

    const setSimpleSlider = (
      sliderId: string,
      value: number,
      digits: number = 2,
      formatter?: (v: number) => string
    ) => {
      const slider = document.getElementById(sliderId) as HTMLInputElement | null;
      const valueSpan = document.getElementById(`${sliderId}-val`);
      if (!slider || !valueSpan) return;
      slider.value = value.toFixed(digits);
      valueSpan.textContent = formatter ? formatter(value) : formatNumber(value, digits);
    };

    setSimpleSlider('live-corner-pocket-capture', settings.CORNER_POCKET_CAPTURE_RADIUS_IN);
    setSimpleSlider('live-side-pocket-capture', settings.SIDE_POCKET_CAPTURE_RADIUS_IN);
    setSimpleSlider('live-corner-pocket-visual', settings.CORNER_POCKET_VISUAL_RADIUS_IN);
    setSimpleSlider('live-side-pocket-visual', settings.SIDE_POCKET_VISUAL_RADIUS_IN);
    setSimpleSlider('live-pocket-shelf-depth', settings.POCKET_SHELF_DEPTH_IN);
    setSimpleSlider('live-jaw-curve-blend', settings.JAW_CURVE_BLEND, 2);
    setSimpleSlider('live-corner-cut-angle', settings.CORNER_CUT_ANGLE_DEG, 1, (v) => formatNumber(v, 1));
    setSimpleSlider('live-side-cut-angle', settings.SIDE_CUT_ANGLE_DEG, 1, (v) => formatNumber(v, 1));

    setSlider('live-corner-frame', settings.CORNER_FRAME_OFFSET_IN, (v) => formatNumber(v, 1), 1);
    setSlider('live-corner-radius', settings.CORNER_JAW_REF_RADIUS_IN, (v) => formatNumber(v, 1), 1);
    setSlider('live-corner-straight', settings.CORNER_STRAIGHT_X_IN);
    setSlider('live-corner-target', settings.CORNER_TARGET_Y_IN);
    setSlider('live-frame-width', settings.FRAME_OFFSET_IN, (v) => formatNumber(v, 1), 1);
    setSlider('live-frame-corner-radius', settings.FRAME_CORNER_RADIUS_IN, (v) => formatNumber(v, 1), 1);
    setSlider('live-rail-thickness-inner', settings.RAIL_THICKNESS_INNER);
    setSlider('live-rail-thickness-outer', settings.RAIL_THICKNESS_OUTER);

    if (sideOffsetSlider instanceof HTMLInputElement) {
      sideOffsetSlider.value = settings.SIDE_POCKET_OUTWARD_OFFSET_IN.toFixed(2);
    }
  }

  toggle() {
    this.panelController.toggle();
  }

  open() {
    this.panelController.open();
  }

  close() {
    this.panelController.close();
  }

  getController(): UIPanel {
    return this.panelController;
  }
}
