import type { AppState } from './AppState';
import type { Route } from './routes';

export interface Screen {
  unmount(): void;
}

export interface ScreenCtx {
  app: AppState;
  host: HTMLElement;
  nav: (route: Route) => void;
  route: Route;
}

export type ScreenFactory = (ctx: ScreenCtx) => Screen;

/** Swaps one full-screen view at a time inside `host`. Each screen builds its own DOM/canvas. */
export class Router {
  private current: Screen | null = null;

  constructor(
    private readonly host: HTMLElement,
    private readonly app: AppState,
    private readonly factories: Record<Route['name'], ScreenFactory>,
  ) {}

  go(route: Route): void {
    this.current?.unmount();
    this.host.replaceChildren();
    const factory = this.factories[route.name];
    this.current = factory({ app: this.app, host: this.host, nav: (r) => this.go(r), route });
  }
}
