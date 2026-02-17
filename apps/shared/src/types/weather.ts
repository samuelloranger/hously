export interface WeatherData {
  address: string;
  locationName: string;
  latitude: number;
  longitude: number;
  temperatureF: number;
  feelsLikeF: number;
  weatherCode: number;
  isDay: boolean;
  conditionLabel: string;
}
