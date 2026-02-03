import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";

interface EmojiPickerInputProps {
  value: string | null;
  onChange: (emoji: string | null) => void;
  label?: string;
  className?: string;
}

export function EmojiPickerInput({
  value,
  onChange,
  label,
  className = "",
}: EmojiPickerInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      // Calculate position for fixed positioning (opens upward)
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        const pickerHeight = 400; // Height of the emoji picker
        const spacing = 8; // Spacing between button and picker
        setPosition({
          top: rect.top + window.scrollY - pickerHeight - spacing,
          left: rect.left + window.scrollX,
        });
      }
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    onChange(emojiData.emoji);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          {label}
        </label>
      )}
      <div className="flex items-center gap-2">
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-12 h-12 flex items-center justify-center border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-600 transition-colors text-2xl"
        >
          {value || "😀"}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300"
          >
            Clear
          </button>
        )}
      </div>
      {isOpen &&
        createPortal(
          <div
            ref={pickerRef}
            className="fixed z-[100]"
            style={{
              top: `${position.top}px`,
              left: `${position.left}px`,
            }}
          >
            <EmojiPicker
              onEmojiClick={handleEmojiClick}
              width={350}
              height={400}
            />
          </div>,
          document.body
        )}
    </div>
  );
}
