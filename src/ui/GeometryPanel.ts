import { SettingsManager, GeometrySettings } from './SettingsManager';
import { makePanelDraggable } from './drag';

const formatNumber = (value: number, digits: number = 2): string =>
  value.toFixed(digits).replace(/\.0+$|\.([0-9]*[1-9])0+$/, '.$1').replace(/\.$/, '');

export class GeometryPanel {
  private panel: HTMLElement;
  private isOpen = false;
  private settingsManager: SettingsManager;
  private onGeometryChange: () => void;

  constructor(settingsManager: SettingsManager, onGeometryChange: () => void) {
    this.settingsManager = settingsManager;
    this.onGeometryChange = onGeometryChange;
    
    this.panel = document.getElementById('geometry-panel')!;
    const header = this.panel.querySelector('.panel-header') as HTMLElement | null;
    if (header) {
      makePanelDraggable(this.panel, header);
    }
    this.setupControls();
    this.loadCurrentValues();
  }

  private setupControls() {
    // Toggle button
    const toggleBtn = document.getElementById('geometry-panel-btn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => this.toggle());
    }

    // Close button
    const closeBtn = document.getElementById('geometry-panel-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }

    const notify = (settings: Partial<GeometrySettings>) => {
      this.settingsManager.saveGeometrySettings(settings);
      this.onGeometryChange();
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

    const handleOverrideInput = (
      input: HTMLInputElement | null,
      resetBtn: HTMLElement | null,
      key: 'SIDE_JAW_OUTER_OVERRIDE_IN' | 'SIDE_JAW_INNER_OVERRIDE_IN'
    ) => {
      if (!input) return;

      const commit = () => {
        const raw = input.value.trim();
        if (!raw) {
          notify({ [key]: null } as any);
          return;
        }
        let value = parseFloat(raw);
        if (!Number.isFinite(value)) {
          input.value = '';
          notify({ [key]: null } as any);
          return;
        }
        const settings = this.settingsManager.getGeometrySettings();
        const maxOuter = settings.CORNER_STRAIGHT_X_IN - 0.25;
        if (key === 'SIDE_JAW_OUTER_OVERRIDE_IN') {
          value = Math.min(Math.max(1, value), maxOuter);
        } else {
          const outer = settings.SIDE_JAW_OUTER_OVERRIDE_IN ?? maxOuter;
          value = Math.min(Math.max(0.25, value), outer - 0.25);
        }
        input.value = formatNumber(value);
        notify({ [key]: value } as any);
      };

      input.addEventListener('change', commit);
      input.addEventListener('blur', commit);

      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          input.value = '';
          notify({ [key]: null } as any);
        });
      }
    };

    handleOverrideInput(
      document.getElementById('side-jaw-outer') as HTMLInputElement,
      document.getElementById('side-jaw-outer-reset'),
      'SIDE_JAW_OUTER_OVERRIDE_IN'
    );

    handleOverrideInput(
      document.getElementById('side-jaw-inner') as HTMLInputElement,
      document.getElementById('side-jaw-inner-reset'),
      'SIDE_JAW_INNER_OVERRIDE_IN'
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
    const cornerPocketRadiusSlider = document.getElementById('live-corner-pocket-radius') as HTMLInputElement;
    const cornerPocketRadiusVal = document.getElementById('live-corner-pocket-radius-val');
    if (cornerPocketRadiusSlider && cornerPocketRadiusVal) {
      cornerPocketRadiusSlider.addEventListener('input', (e) => {
        const raw = parseFloat((e.target as HTMLInputElement).value);
        const value = Math.max(1.5, Math.min(3.75, raw));
        cornerPocketRadiusSlider.value = value.toFixed(2);
        cornerPocketRadiusVal.textContent = formatNumber(value, 2);
        notify({ CORNER_POCKET_RADIUS_IN: value });
      });
    }

    const sidePocketRadiusSlider = document.getElementById('live-side-pocket-radius') as HTMLInputElement;
    const sidePocketRadiusVal = document.getElementById('live-side-pocket-radius-val');
    if (sidePocketRadiusSlider && sidePocketRadiusVal) {
      sidePocketRadiusSlider.addEventListener('input', (e) => {
        const raw = parseFloat((e.target as HTMLInputElement).value);
        const value = Math.max(1.5, Math.min(3.75, raw));
        sidePocketRadiusSlider.value = value.toFixed(2);
        sidePocketRadiusVal.textContent = formatNumber(value, 2);
        notify({ SIDE_POCKET_RADIUS_IN: value });
      });
    }

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
      if (e.key === 'Escape' && this.isOpen) {
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

    const setOverrideInput = (id: string, value: number | null) => {
      const input = document.getElementById(id) as HTMLInputElement | null;
      if (!input) return;
      input.value = value == null ? '' : formatNumber(value);
    };

    setOverrideInput('side-jaw-outer', settings.SIDE_JAW_OUTER_OVERRIDE_IN);
    setOverrideInput('side-jaw-inner', settings.SIDE_JAW_INNER_OVERRIDE_IN);

    setSlider('live-corner-frame', settings.CORNER_FRAME_OFFSET_IN, (v) => formatNumber(v, 1), 1);
    setSlider('live-corner-radius', settings.CORNER_JAW_REF_RADIUS_IN, (v) => formatNumber(v, 1), 1);
    setSlider('live-corner-pocket-radius', settings.CORNER_POCKET_RADIUS_IN, (v) => formatNumber(v, 2), 2);
    setSlider('live-side-pocket-radius', settings.SIDE_POCKET_RADIUS_IN, (v) => formatNumber(v, 2), 2);
    setSlider('live-corner-straight', settings.CORNER_STRAIGHT_X_IN);
    setSlider('live-corner-target', settings.CORNER_TARGET_Y_IN);
    setSlider('live-frame-width', settings.FRAME_OFFSET_IN, (v) => formatNumber(v, 1), 1);
    setSlider('live-rail-thickness-inner', settings.RAIL_THICKNESS_INNER);
    setSlider('live-rail-thickness-outer', settings.RAIL_THICKNESS_OUTER);

    if (sideOffsetSlider instanceof HTMLInputElement) {
      sideOffsetSlider.value = settings.SIDE_POCKET_OUTWARD_OFFSET_IN.toFixed(2);
    }
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  open() {
    this.panel.classList.remove('hidden');
    this.isOpen = true;
    this.loadCurrentValues();
  }

  close() {
    this.panel.classList.add('hidden');
    this.isOpen = false;
  }
}
