import React, { useState } from 'react';
import { cn } from '@/lib/utils';

interface EmojiPickerProps {
  selectedEmoji: string;
  onSelect: (emoji: string) => void;
}

const HABIT_EMOJIS = [
  // Health
  '💧', '💊', '🏃‍♂️', '🧘‍♀️', '🍎', '🥗', '🥦', '🦷',
  // Wellness
  '😴', '🧠', '📖', '✍️', '🕯️', '🛀', '💆‍♂️', '☀️',
  // Productivity
  '💻', '📝', '📚', '🎯', '⌛', '📅', '💡', '✅',
  // Home
  '🧹', '🪥', '🐕', '🌱', '🧺', '🚿', '🍳', '☕',
  // Sport
  '🏋️‍♂️', '🚴‍♂️', '🏊‍♂️', '🚶‍♂️', '🤸‍♂️', '🧗‍♂️', '🏀', '⚽'
];

export const EmojiPicker: React.FC<EmojiPickerProps> = ({ selectedEmoji, onSelect }) => {
  const [customEmoji, setCustomEmoji] = useState('');

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomEmoji(val);
    if (val) {
      // Very simple emoji detection (just use the first character if it's there)
      onSelect(val);
    }
  };

  return (
    <div className="space-y-4 p-1">
      <div className="grid grid-cols-8 gap-1">
        {HABIT_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onSelect(emoji)}
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl text-xl transition-all duration-200",
              selectedEmoji === emoji 
                ? "bg-primary-100 dark:bg-primary-900/40 scale-110 shadow-sm" 
                : "hover:bg-neutral-100 dark:hover:bg-neutral-700"
            )}
          >
            {emoji}
          </button>
        ))}
      </div>
      
      <div className="pt-2 border-t border-neutral-100 dark:border-neutral-700">
        <input
          type="text"
          placeholder="Or paste any emoji..."
          value={customEmoji}
          onChange={handleCustomChange}
          className="w-full h-9 px-3 rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-sm text-neutral-900 dark:text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
        />
      </div>
    </div>
  );
};
