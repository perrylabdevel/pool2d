export function makePanelDraggable(panel: HTMLElement, handle: HTMLElement) {
  if (!panel || !handle) return;

  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;

  const canDragFromTarget = (target: EventTarget | null): boolean => {
    if (!(target instanceof HTMLElement)) {
      return true;
    }
    if (target.closest('[data-no-drag="true"]')) {
      return false;
    }
    return true;
  };

  const preparePosition = () => {
    const rect = panel.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(panel);
    const position = computedStyle.position;

    if (position !== 'absolute' && position !== 'fixed') {
      panel.style.position = 'absolute';
    }

    panel.style.left = `${rect.left}px`;
    panel.style.top = `${rect.top}px`;
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
    panel.style.margin = '0';
  };

  const onMouseDown = (event: MouseEvent) => {
    if (event.button !== 0) return;
    if (!canDragFromTarget(event.target)) return;
    event.preventDefault();

    if (!isDragging) {
      preparePosition();
    }

    const rect = panel.getBoundingClientRect();
    startX = event.clientX;
    startY = event.clientY;
    startLeft = rect.left;
    startTop = rect.top;

    isDragging = true;

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const onMouseMove = (event: MouseEvent) => {
    if (!isDragging) return;

    const deltaX = event.clientX - startX;
    const deltaY = event.clientY - startY;

    panel.style.left = `${startLeft + deltaX}px`;
    panel.style.top = `${startTop + deltaY}px`;
  };

  const onMouseUp = () => {
    if (!isDragging) return;
    isDragging = false;

    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  };

  handle.style.cursor = 'move';
  handle.addEventListener('mousedown', onMouseDown);
}
