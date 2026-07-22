/** Minimal DOM helpers for the meta screens — no framework, just typed element creation. */

type AttrValue = string | number | boolean | undefined | ((e: MouseEvent) => void);

interface Attrs {
  [key: string]: AttrValue;
  class?: string;
  text?: string;
  html?: string;
  onclick?: (e: MouseEvent) => void;
  style?: string;
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  children: (HTMLElement | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    if (key === 'class') node.className = String(value);
    else if (key === 'text') node.textContent = String(value);
    else if (key === 'html') node.innerHTML = String(value);
    else if (key === 'style') node.setAttribute('style', String(value));
    else if (key === 'onclick') node.addEventListener('click', value as EventListener);
    else node.setAttribute(key, String(value));
  }
  for (const child of children) node.append(child);
  return node;
}

export function clear(node: HTMLElement): void {
  node.replaceChildren();
}

/** Family pictogram as inline SVG (matches the canvas renderer: circle/triangle/ring). */
export function pictogram(family: string, size = 26, color = 'rgba(255,255,255,.95)'): HTMLElement {
  const s = size;
  let inner: string;
  if (family === 'ranged') {
    inner = `<polygon points="${s / 2},${s * 0.16} ${s * 0.82},${s * 0.82} ${s * 0.18},${s * 0.82}" fill="${color}"/>`;
  } else if (family === 'gravity') {
    inner = `<circle cx="${s / 2}" cy="${s / 2}" r="${s * 0.34}" fill="none" stroke="${color}" stroke-width="${s * 0.13}"/><circle cx="${s / 2}" cy="${s / 2}" r="${s * 0.12}" fill="${color}"/>`;
  } else {
    inner = `<circle cx="${s / 2}" cy="${s / 2}" r="${s * 0.36}" fill="${color}"/>`;
  }
  const wrap = document.createElement('div');
  wrap.innerHTML = `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">${inner}</svg>`;
  return wrap.firstElementChild as unknown as HTMLElement;
}
