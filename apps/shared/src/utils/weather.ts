import type { WeatherData } from '../types';

export interface WeatherVisualTheme {
  icon: string;
  startColor: string;
  endColor: string;
  textColor: string;
  subtextColor: string;
}

function isRainCode(code: number): boolean {
  return [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code);
}

function isSnowCode(code: number): boolean {
  return [71, 73, 75, 77, 85, 86].includes(code);
}

function isThunderCode(code: number): boolean {
  return [95, 96, 99].includes(code);
}

function isFogCode(code: number): boolean {
  return code === 45 || code === 48;
}

function isCloudCode(code: number): boolean {
  return [1, 2, 3].includes(code);
}

export function getWeatherVisualTheme(weather: WeatherData): WeatherVisualTheme {
  const { weatherCode, temperatureF, isDay } = weather;

  if (isThunderCode(weatherCode)) {
    return {
      icon: '⛈️',
      startColor: '#2E3A87',
      endColor: '#111827',
      textColor: '#F8FAFC',
      subtextColor: '#CBD5E1',
    };
  }

  if (isSnowCode(weatherCode) || temperatureF <= 32) {
    return {
      icon: '❄️',
      startColor: '#CFE8FF',
      endColor: '#8DB9E5',
      textColor: '#0F172A',
      subtextColor: '#334155',
    };
  }

  if (isRainCode(weatherCode)) {
    return {
      icon: '🌧️',
      startColor: '#4A6FA5',
      endColor: '#223A5E',
      textColor: '#F8FAFC',
      subtextColor: '#DBEAFE',
    };
  }

  if (isFogCode(weatherCode)) {
    return {
      icon: '🌫️',
      startColor: '#C4CDD5',
      endColor: '#8E9BA8',
      textColor: '#111827',
      subtextColor: '#334155',
    };
  }

  if (weatherCode === 0) {
    if (temperatureF >= 82) {
      return {
        icon: '☀️',
        startColor: '#F59E0B',
        endColor: '#F97316',
        textColor: '#111827',
        subtextColor: '#1F2937',
      };
    }

    return {
      icon: isDay ? '🌤️' : '🌙',
      startColor: isDay ? '#7DD3FC' : '#1E3A8A',
      endColor: isDay ? '#38BDF8' : '#312E81',
      textColor: '#F8FAFC',
      subtextColor: '#DBEAFE',
    };
  }

  if (isCloudCode(weatherCode)) {
    return {
      icon: isDay ? '⛅' : '☁️',
      startColor: '#9AA5B1',
      endColor: '#6B7280',
      textColor: '#F8FAFC',
      subtextColor: '#E5E7EB',
    };
  }

  if (temperatureF >= 82) {
    return {
      icon: '🌡️',
      startColor: '#FB923C',
      endColor: '#EF4444',
      textColor: '#111827',
      subtextColor: '#1F2937',
    };
  }

  if (temperatureF <= 45) {
    return {
      icon: '🥶',
      startColor: '#93C5FD',
      endColor: '#60A5FA',
      textColor: '#0F172A',
      subtextColor: '#1E293B',
    };
  }

  return {
    icon: '🌈',
    startColor: '#6EE7B7',
    endColor: '#3B82F6',
    textColor: '#F8FAFC',
    subtextColor: '#E2E8F0',
  };
}
