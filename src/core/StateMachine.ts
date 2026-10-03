/**
 * Generic Finite State Machine (FSM)
 */
export interface IState<TContext = any> {
  name: string;
  enter?(context: TContext, params?: any): void;
  update?(context: TContext, dt: number): void;
  exit?(context: TContext): void;
}

export class StateMachine<TContext = any> {
  private states: Map<string, IState<TContext>> = new Map();
  private currentState: IState<TContext> | null = null;
  private previousState: IState<TContext> | null = null;
  private context: TContext;

  constructor(context: TContext) {
    this.context = context;
  }

  public addState(state: IState<TContext>): this {
    this.states.set(state.name, state);
    return this;
  }

  public changeState(name: string, params?: any): void {
    const nextState = this.states.get(name);
    if (!nextState) {
      console.warn(`[StateMachine] State "${name}" not found.`);
      return;
    }

    if (this.currentState) {
      this.currentState.exit?.(this.context);
      this.previousState = this.currentState;
    }

    this.currentState = nextState;
    this.currentState.enter?.(this.context, params);
  }

  public update(dt: number): void {
    if (this.currentState && this.currentState.update) {
      this.currentState.update(this.context, dt);
    }
  }

  public getCurrentState(): IState<TContext> | null {
    return this.currentState;
  }

  public getPreviousState(): IState<TContext> | null {
    return this.previousState;
  }

  public isInState(name: string): boolean {
    return this.currentState?.name === name;
  }
}
