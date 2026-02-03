import { useState, useEffect } from "react";

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
  const [wasCompleted, setWasCompleted] = useState(completed);

  useEffect(() => {
    // Trigger animation when transitioning from incomplete to complete
    if (completed && !wasCompleted) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 600);
      setWasCompleted(completed);
      return () => clearTimeout(timer);
    }
    setWasCompleted(completed);
    return undefined;
  }, [completed, wasCompleted]);

  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={`checkbox relative flex justify-center items-center border-2 min-w-7 min-h-7 w-7 h-7 rounded ${
        completed
          ? "bg-green-500 border-green-500"
          : "border-neutral-300 dark:border-neutral-600 hover:border-green-400 dark:hover:border-green-500"
      } focus:outline-none focus:ring-2 focus:ring-green-500 transition-all duration-200 ${
        isAnimating ? "checkbox-celebrate" : ""
      } ${className}`}
    >
      {completed && (
        <span
          className={`text-white text-xl ${isAnimating ? "checkmark-pop" : ""}`}
        >
          ✓
        </span>
      )}
      {/* Ripple effect on complete */}
      {isAnimating && (
        <span className="absolute inset-0 rounded checkbox-ripple" />
      )}
    </button>
  );
}
