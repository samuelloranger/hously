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

export interface WeatherForecastDay {
  date: string;
  weather_code: number;
  temperature_max_f: number;
  temperature_min_f: number;
  precipitation_probability_max: number;
  precipitation_sum_mm: number;
  wind_speed_max_kmh: number;
}

export interface WeatherForecastData {
  location_name: string;
  temperature_unit: "fahrenheit" | "celsius";
  days: WeatherForecastDay[];
}
