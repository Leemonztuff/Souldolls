export type WeatherType = 'none' | 'sun' | 'rain' | 'sandstorm' | 'snow';

export interface WeatherState {
  type: WeatherType;
  turnsRemaining: number;
}
