import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useAddressWeather, getWeatherVisualTheme } from '@hously/shared';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';

const STORAGE_KEY = 'dashboard-weather-address';

export function WeatherWidget() {
  const [addressInput, setAddressInput] = useState('');
  const [submittedAddress, setSubmittedAddress] = useState('');

  useEffect(() => {
    const savedAddress = localStorage.getItem(STORAGE_KEY);
    if (!savedAddress) return;

    setAddressInput(savedAddress);
    setSubmittedAddress(savedAddress);
  }, []);

  const weatherQuery = useAddressWeather(submittedAddress);
  const weatherTheme = useMemo(() => {
    if (!weatherQuery.data) {
      return {
        icon: '🌤️',
        startColor: '#94A3B8',
        endColor: '#64748B',
        textColor: '#F8FAFC',
        subtextColor: '#E2E8F0',
      };
    }

    return getWeatherVisualTheme(weatherQuery.data);
  }, [weatherQuery.data]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedAddress = addressInput.trim();
    if (!trimmedAddress) return;

    localStorage.setItem(STORAGE_KEY, trimmedAddress);
    setSubmittedAddress(trimmedAddress);
  }

  return (
    <div
      className="mb-8 rounded-xl shadow p-6"
      style={{ background: `linear-gradient(135deg, ${weatherTheme.startColor}, ${weatherTheme.endColor})` }}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide" style={{ color: weatherTheme.subtextColor }}>
            Weather
          </p>
          {weatherQuery.data ? (
            <h3 className="text-xl font-bold" style={{ color: weatherTheme.textColor }}>
              {weatherTheme.icon} {weatherQuery.data.locationName}
            </h3>
          ) : (
            <h3 className="text-xl font-bold" style={{ color: weatherTheme.textColor }}>
              {weatherTheme.icon} Add a location
            </h3>
          )}
        </div>
        {weatherQuery.isFetching && <span style={{ color: weatherTheme.subtextColor }}>Updating...</span>}
      </div>

      {weatherQuery.data && (
        <div className="mb-4">
          <p className="text-4xl font-bold leading-none" style={{ color: weatherTheme.textColor }}>
            {Math.round(weatherQuery.data.temperatureF)} degrees F
          </p>
          <p className="mt-1 text-sm" style={{ color: weatherTheme.subtextColor }}>
            {weatherQuery.data.conditionLabel} - Feels like {Math.round(weatherQuery.data.feelsLikeF)} degrees
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
        <Input
          value={addressInput}
          onChange={event => {
            setAddressInput(event.target.value);
          }}
          placeholder="Enter an address"
          className="bg-white/95 dark:bg-white/95 text-neutral-900 placeholder:text-neutral-600 border-transparent"
        />
        <Button type="submit" variant="secondary" className="sm:w-auto w-full">
          Show Weather
        </Button>
      </form>

      {weatherQuery.error && (
        <p className="mt-2 text-sm" style={{ color: weatherTheme.subtextColor }}>
          {weatherQuery.error.message}
        </p>
      )}
    </div>
  );
}
