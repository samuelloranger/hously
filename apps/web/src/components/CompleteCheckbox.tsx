import { useState, useEffect, useRef, startTransition } from "react";
import { Check } from "lucide-react";

interface CompleteCheckboxProps {
  completed: boolean;
  onToggle: () => void;
  disabled?: boolean;
  className?: string;
}

export function CompleteCheckbox({
  completed,
  onToggle,
  disabled = false,
  className = "",
}: CompleteCheckboxProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const prevCompleted = useRef(completed);

  useEffect(() => {
    if (completed && !prevCompleted.current) {
      startTransition(() => setIsAnimating(true));
      const timer = setTimeout(() => setIsAnimating(false), 600);
      prevCompleted.current = completed;
      return () => clearTimeout(timer);
    }
    prevCompleted.current = completed;
    return undefined;
  }, [completed]);

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      style={{ touchAction: "manipulation" }}
      className={`checkbox relative flex justify-center items-center border-2 min-w-7 min-h-7 w-7 h-7 rounded ${
        completed
          ? "bg-green-500 border-green-500"
          : "border-neutral-300 dark:border-neutral-600 hover:border-green-400 dark:hover:border-green-500"
      } focus:outline-none focus:ring-2 focus:ring-green-500 transition-all duration-200 ${
        isAnimating ? "checkbox-celebrate" : ""
      } ${className}`}
    >
      {completed && (
        <Check
          size={14}
          strokeWidth={3}
          className={`text-white ${isAnimating ? "checkmark-pop" : ""}`}
        />
      )}
      {isAnimating && (
        <span className="absolute inset-0 rounded checkbox-ripple" />
      )}
    </button>
  );
}
