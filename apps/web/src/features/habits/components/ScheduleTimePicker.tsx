import React from 'react';
import { Plus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ScheduleTimePickerProps {
  times: string[];
  onChange: (times: string[]) => void;
}

export const ScheduleTimePicker: React.FC<ScheduleTimePickerProps> = ({ times, onChange }) => {
  const { t } = useTranslation('common');

  const addTime = () => {
    onChange([...times, '08:00']);
  };

  const removeTime = (index: number) => {
    if (times.length <= 1) return;
    const newTimes = [...times];
    newTimes.splice(index, 1);
    onChange(newTimes);
  };

  const updateTime = (index: number, value: string) => {
    const newTimes = [...times];
    newTimes[index] = value;
    onChange(newTimes);
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
        {t('habits.scheduleTimes')}
      </label>
      
      <div className="flex flex-wrap gap-2">
        {times.map((time, index) => (
          <div key={index} className="flex items-center gap-1 p-1 pr-2 rounded-lg bg-neutral-100 dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-700">
            <input
              type="time"
              value={time}
              onChange={(e) => updateTime(index, e.target.value)}
              className="bg-transparent border-none text-sm focus:ring-0 focus:outline-none dark:text-white"
            />
            {times.length > 1 && (
              <button
                type="button"
                onClick={() => removeTime(index)}
                className="p-1 rounded-md text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>
        ))}
        
        <button
          type="button"
          onClick={addTime}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:border-neutral-400 dark:hover:border-neutral-600 hover:text-neutral-600 dark:hover:text-neutral-300 transition-all text-sm font-medium"
        >
          <Plus size={14} />
          {t('habits.addTime')}
        </button>
      </div>
    </div>
  );
};
