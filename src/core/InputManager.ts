import { GlobalInput, Input } from './Input';

export class InputManager {
  public static getInstance(): Input {
    return GlobalInput;
  }
}

export { GlobalInput as inputManager, GlobalInput };
