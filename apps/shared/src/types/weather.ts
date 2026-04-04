export interface WeatherData {
  address: string;
  location_name: string;
  latitude: number;
  longitude: number;
  temperature_f: number;
  feels_like_f: number;
  weather_code: number;
  is_day: boolean;
  condition_label: string;
  temperature_unit: "fahrenheit" | "celsius";
}
