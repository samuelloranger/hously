export type WeatherConditionKey =
  | "clearSky"
  | "partlyCloudy"
  | "overcast"
  | "foggy"
  | "drizzle"
  | "freezingDrizzle"
  | "rain"
  | "freezingRain"
  | "snow"
  | "thunderstorm"
  | "currentConditions";

export function getWeatherConditionKey(
  weatherCode: number,
): WeatherConditionKey {
  if (weatherCode === 0) return "clearSky";
  if ([1, 2].includes(weatherCode)) return "partlyCloudy";
  if (weatherCode === 3) return "overcast";
  if ([45, 48].includes(weatherCode)) return "foggy";
  if ([51, 53, 55].includes(weatherCode)) return "drizzle";
  if ([56, 57].includes(weatherCode)) return "freezingDrizzle";
  if ([61, 63, 65, 80, 81, 82].includes(weatherCode)) return "rain";
  if ([66, 67].includes(weatherCode)) return "freezingRain";
  if ([71, 73, 75, 77, 85, 86].includes(weatherCode)) return "snow";
  if ([95, 96, 99].includes(weatherCode)) return "thunderstorm";
  return "currentConditions";
}
