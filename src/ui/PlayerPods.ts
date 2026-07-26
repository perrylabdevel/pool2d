// Floating player pods: avatar + turn-timer ring + remaining-group ball icons.
// Pure presentation — pods read state that is pushed in, they never write it.

import { createAvatarSVG } from './Avatar';
import { ballColor, isStripe } from './palette';

const RING_RADIUS = 22.5;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const NAME_MAX = 12;

/** Final quarter of the clock turns the ring red and starts it breathing. */
const DANGER_THRESHOLD = 0.25;

function truncate(name: string): string {
  return name.length > NAME_MAX ? `${name.slice(0, NAME_MAX - 1)}…` : name;
}

export class PlayerPod {
  readonly root: HTMLElement;

  private ringProgress: SVGCircleElement;
  private nameEl: HTMLElement;
  private groupEl: HTMLElement;
  private ballsEl: HTMLElement;
  private ballIcons = new Map<number, HTMLElement>();

  private mirrored: boolean;

  constructor(mount: HTMLElement, name: string, mirrored: boolean) {
    this.mirrored = mirrored;

    const pod = document.createElement('div');
    pod.className = mirrored ? 'pod mirrored' : 'pod';

    const avatarWrap = document.createElement('div');
    avatarWrap.className = 'pod-avatar-wrap';

    const avatar = document.createElement('div');
    avatar.className = 'pod-avatar';
    avatar.innerHTML = createAvatarSVG(name);

    const ring = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    ring.setAttribute('class', 'pod-ring');
    ring.setAttribute('viewBox', '0 0 48 48');

    const track = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    track.setAttribute('class', 'pod-ring-track');
    track.setAttribute('cx', '24');
    track.setAttribute('cy', '24');
    track.setAttribute('r', String(RING_RADIUS));

    this.ringProgress = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    this.ringProgress.setAttribute('class', 'pod-ring-progress');
    this.ringProgress.setAttribute('cx', '24');
    this.ringProgress.setAttribute('cy', '24');
    this.ringProgress.setAttribute('r', String(RING_RADIUS));
    this.ringProgress.setAttribute('stroke-dasharray', String(RING_CIRCUMFERENCE));
    this.ringProgress.setAttribute('stroke-dashoffset', '0');

    ring.append(track, this.ringProgress);
    avatarWrap.append(avatar, ring);

    const body = document.createElement('div');
    body.className = 'pod-body';

    this.nameEl = document.createElement('div');
    this.nameEl.className = 'pod-name';
    this.nameEl.textContent = truncate(name);

    this.groupEl = document.createElement('div');
    this.groupEl.className = 'pod-group';
    this.groupEl.textContent = 'Table open';

    this.ballsEl = document.createElement('div');
    this.ballsEl.className = 'pod-balls';

    body.append(this.nameEl, this.groupEl, this.ballsEl);
    pod.append(avatarWrap, body);
    mount.appendChild(pod);

    this.root = pod;
  }

  get isMirrored(): boolean {
    return this.mirrored;
  }

  setActive(active: boolean) {
    this.root.classList.toggle('active', active);
    if (!active) {
      this.root.classList.remove('danger');
      this.setTimer(1);
    }
  }

  /** `remaining` is 0..1 of the shot clock. 1 = full, 0 = expired. */
  setTimer(remaining: number) {
    const clamped = Math.max(0, Math.min(1, remaining));
    this.ringProgress.setAttribute(
      'stroke-dashoffset',
      String(RING_CIRCUMFERENCE * (1 - clamped))
    );
    this.root.classList.toggle(
      'danger',
      clamped <= DANGER_THRESHOLD && this.root.classList.contains('active')
    );
  }

  setGroupLabel(label: string) {
    this.groupEl.textContent = label;
  }

  /**
   * Declare which balls belong to this player. Icons are created once and then
   * only toggled, so potting animates instead of re-rendering the row.
   */
  setGroupBalls(ids: number[]) {
    if (
      ids.length === this.ballIcons.size &&
      ids.every((id) => this.ballIcons.has(id))
    ) {
      return;
    }

    this.ballsEl.textContent = '';
    this.ballIcons.clear();

    for (const id of ids) {
      const icon = document.createElement('span');
      icon.className = isStripe(id) ? 'pod-ball stripe' : 'pod-ball';
      icon.style.background = ballColor(id);
      icon.title = `Ball ${id}`;
      this.ballsEl.appendChild(icon);
      this.ballIcons.set(id, icon);
    }
  }

  /** Dim and shrink out the balls this player has already sunk. */
  setPotted(pottedIds: ReadonlySet<number>) {
    this.ballIcons.forEach((icon, id) => {
      icon.classList.toggle('potted', pottedIds.has(id));
    });
  }

  /** Screen-space center of the avatar — the pot animation flies here. */
  getAvatarCenter(): { x: number; y: number } {
    const rect = this.root.querySelector('.pod-avatar-wrap')!.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }
}
