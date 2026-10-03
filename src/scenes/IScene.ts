export interface IScene {
  name: string;
  isTransparentOverlay?: boolean;
  enter(params?: any): void | Promise<void>;
  exit(): void | Promise<void>;
  resume?(): void | Promise<void>;
  update(dt: number): void;
  render(alpha: number): void;
  onResize?(width: number, height: number): void;
}
