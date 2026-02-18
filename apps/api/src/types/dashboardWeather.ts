export interface DashboardWeatherResponse {
  address: string;
  locationName: string;
  latitude: number;
  longitude: number;
  temperatureF: number;
  feelsLikeF: number;
  weatherCode: number;
  isDay: boolean;
  conditionLabel: string;
  temperatureUnit: 'fahrenheit' | 'celsius';
}
