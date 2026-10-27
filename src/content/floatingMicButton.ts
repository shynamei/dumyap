// Floating microphone button.
//
// Renders a single, self-contained button inside a Shadow DOM so the host
// page's styles can neither affect it nor be affected by it. The button is
// positioned in the viewport near the current text selection.
//
// This module is intentionally UI-only: clicking the button does nothing
// beyond firing the supplied callback. Audio recording and everything
// downstream are out of scope for now.

const HOST_ID = "dumyap-mic-host";

export interface FloatingMicButtonOptions {
  /** Invoked when the user clicks the microphone button. */
  onClick?: () => void;
}

export class FloatingMicButton {
  private host: HTMLDivElement;
  private button: HTMLButtonElement;
  private visible = false;

  constructor(options: FloatingMicButtonOptions = {}) {
    // Host element that anchors the shadow root. Positioned via fixed
    // coordinates so it tracks the viewport, not the document flow.
    this.host = document.createElement("div");
    this.host.id = HOST_ID;
    Object.assign(this.host.style, {
      position: "fixed",
      top: "0",
      left: "0",
      zIndex: "2147483647", // max; sit above page chrome
      display: "none",
    } satisfies Partial<CSSStyleDeclaration>);

    const shadow = this.host.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = `
      :host { all: initial; }
      .btn {
        all: unset;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border-radius: 9999px;
        background: #6366f1;
        color: #ffffff;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
        font-family: system-ui, sans-serif;
        line-height: 1;
        transition: background-color 120ms ease, transform 120ms ease;
      }
      .btn:hover { background: #4f46e5; }
      .btn:active { transform: scale(0.94); }
      .btn:focus-visible { outline: 2px solid #c7d2fe; outline-offset: 2px; }
      .btn svg { width: 18px; height: 18px; display: block; }
    `;

    this.button = document.createElement("button");
    this.button.className = "btn";
    this.button.type = "button";
    this.button.setAttribute("aria-label", "Capture a spoken thought");
    this.button.title = "dumyap: speak your thought";
    // Simple microphone glyph (inline SVG, no external asset).
    this.button.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
           aria-hidden="true">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
        <line x1="12" y1="19" x2="12" y2="23"/>
        <line x1="8" y1="23" x2="16" y2="23"/>
      </svg>
    `;

    // Use mousedown (not click) and prevent default so pressing the button
    // does not collapse the user's active text selection.
    this.button.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    this.button.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      options.onClick?.();
    });

    shadow.appendChild(style);
    shadow.appendChild(this.button);
  }

  /** Attach the host to the page once the body is available. */
  mount(): void {
    if (!this.host.isConnected) {
      (document.body ?? document.documentElement).appendChild(this.host);
    }
  }

  /**
   * Show the button at a viewport coordinate. The coordinate marks the
   * anchor point (top-left of the selection); the button is offset so it sits
   * just above the selection and is clamped to stay on screen.
   */
  showAt(viewportX: number, viewportY: number): void {
    const BTN = 36;
    const GAP = 8;
    const margin = 4;

    let left = viewportX;
    let top = viewportY - BTN - GAP; // above the selection

    // If there's no room above, drop below the anchor instead.
    if (top < margin) {
      top = viewportY + GAP;
    }

    // Clamp horizontally/vertically within the viewport.
    const maxLeft = window.innerWidth - BTN - margin;
    const maxTop = window.innerHeight - BTN - margin;
    left = Math.max(margin, Math.min(left, maxLeft));
    top = Math.max(margin, Math.min(top, maxTop));

    this.host.style.left = `${Math.round(left)}px`;
    this.host.style.top = `${Math.round(top)}px`;
    this.host.style.display = "block";
    this.visible = true;
  }

  hide(): void {
    if (this.visible) {
      this.host.style.display = "none";
      this.visible = false;
    }
  }

  isVisible(): boolean {
    return this.visible;
  }

  /** True if the given node lives inside this button's host element. */
  contains(node: Node | null): boolean {
    return node != null && this.host.contains(node);
  }

  destroy(): void {
    this.host.remove();
  }
}
