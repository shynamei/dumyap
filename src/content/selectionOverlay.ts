// In-page region selection overlay.
//
// Renders a full-viewport, Shadow-DOM-isolated overlay that dims the page and
// lets the user drag a rectangle. While active it captures pointer input so
// the page underneath can't be interacted with. Escape or the Cancel control
// aborts. The overlay can hide itself (so it is NOT in the screenshot) before
// the caller captures pixels.
//
// Coordinates reported in `onSelect` are in viewport CSS pixels, matching what
// chrome.tabs.captureVisibleTab records (the captured bitmap is the viewport at
// devicePixelRatio scale).

const HOST_ID = "dumyap-capture-overlay-host";

export interface ViewportRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface SelectionOverlayOptions {
  /** Fired with the selected viewport rect after a valid drag. */
  onSelect: (rect: ViewportRect) => void;
  /** Fired when the user cancels (Escape, Cancel button, or tiny drag). */
  onCancel: () => void;
}

export class SelectionOverlay {
  private host: HTMLDivElement;
  private shadow: ShadowRoot;
  private box: HTMLDivElement;
  private instructions: HTMLDivElement;
  private dragging = false;
  private startX = 0;
  private startY = 0;
  private finished = false;

  constructor(private options: SelectionOverlayOptions) {
    this.host = document.createElement("div");
    this.host.id = HOST_ID;
    Object.assign(this.host.style, {
      position: "fixed",
      inset: "0",
      zIndex: "2147483647",
      cursor: "crosshair",
    } satisfies Partial<CSSStyleDeclaration>);

    this.shadow = this.host.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = `
      :host { all: initial; }
      .backdrop {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.35);
        font-family: system-ui, sans-serif;
      }
      .hint {
        position: fixed;
        top: 16px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 8px 14px;
        border-radius: 9999px;
        background: rgba(17, 24, 39, 0.92);
        color: #fff;
        font-size: 13px;
        line-height: 1;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
      }
      .cancel {
        all: unset;
        cursor: pointer;
        color: #c7d2fe;
        font-weight: 600;
        font-size: 12px;
      }
      .cancel:hover { color: #e0e7ff; }
      .box {
        position: fixed;
        border: 2px solid #6366f1;
        background: rgba(99, 102, 241, 0.12);
        box-shadow: 0 0 0 100vmax rgba(15, 23, 42, 0.0);
        display: none;
        pointer-events: none;
      }
    `;

    const backdrop = document.createElement("div");
    backdrop.className = "backdrop";

    this.instructions = document.createElement("div");
    this.instructions.className = "hint";
    this.instructions.innerHTML = `
      <span>Drag to capture a region</span>
      <button class="cancel" type="button">Cancel (Esc)</button>
    `;

    this.box = document.createElement("div");
    this.box.className = "box";

    this.shadow.appendChild(style);
    this.shadow.appendChild(backdrop);
    this.shadow.appendChild(this.instructions);
    this.shadow.appendChild(this.box);

    const cancelBtn = this.instructions.querySelector(".cancel");
    cancelBtn?.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.cancel();
    });

    // Bind handlers on the host so all pointer input is intercepted.
    this.host.addEventListener("pointerdown", this.onPointerDown);
    this.host.addEventListener("pointermove", this.onPointerMove);
    this.host.addEventListener("pointerup", this.onPointerUp);
    // Keydown on window so Escape works regardless of focus.
    window.addEventListener("keydown", this.onKeyDown, true);
  }

  mount(): void {
    (document.body ?? document.documentElement).appendChild(this.host);
  }

  /** Hide the overlay visually without tearing it down (pre-capture). */
  hideVisual(): void {
    this.host.style.display = "none";
  }

  destroy(): void {
    this.host.removeEventListener("pointerdown", this.onPointerDown);
    this.host.removeEventListener("pointermove", this.onPointerMove);
    this.host.removeEventListener("pointerup", this.onPointerUp);
    window.removeEventListener("keydown", this.onKeyDown, true);
    this.host.remove();
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === "Escape") {
      e.stopPropagation();
      e.preventDefault();
      this.cancel();
    }
  };

  private onPointerDown = (e: PointerEvent): void => {
    if (this.finished) return;
    e.preventDefault();
    e.stopPropagation();
    this.dragging = true;
    this.startX = e.clientX;
    this.startY = e.clientY;
    this.instructions.style.display = "none";
    this.updateBox(e.clientX, e.clientY);
    this.box.style.display = "block";
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.dragging) return;
    e.preventDefault();
    e.stopPropagation();
    this.updateBox(e.clientX, e.clientY);
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (!this.dragging) return;
    e.preventDefault();
    e.stopPropagation();
    this.dragging = false;
    const rect = this.rectFrom(e.clientX, e.clientY);
    // Ignore tiny/accidental drags.
    if (rect.width < 5 || rect.height < 5) {
      this.cancel();
      return;
    }
    this.finished = true;
    this.options.onSelect(rect);
  };

  private cancel(): void {
    if (this.finished) return;
    this.finished = true;
    this.options.onCancel();
  }

  private rectFrom(curX: number, curY: number): ViewportRect {
    const left = Math.min(this.startX, curX);
    const top = Math.min(this.startY, curY);
    const width = Math.abs(curX - this.startX);
    const height = Math.abs(curY - this.startY);
    // Clamp to viewport.
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const clampedLeft = Math.max(0, Math.min(left, vw));
    const clampedTop = Math.max(0, Math.min(top, vh));
    return {
      left: clampedLeft,
      top: clampedTop,
      width: Math.min(width, vw - clampedLeft),
      height: Math.min(height, vh - clampedTop),
    };
  }

  private updateBox(curX: number, curY: number): void {
    const r = this.rectFrom(curX, curY);
    this.box.style.left = `${r.left}px`;
    this.box.style.top = `${r.top}px`;
    this.box.style.width = `${r.width}px`;
    this.box.style.height = `${r.height}px`;
  }
}
