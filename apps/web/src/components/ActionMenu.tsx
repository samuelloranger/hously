import { useState, useRef, useEffect } from "react";

interface ActionMenuItem {
  label: string;
  icon: string;
  onClick: () => void;
  variant?: "default" | "danger" | "success";
}

interface ActionMenuProps {
  items: ActionMenuItem[];
  buttonClassName?: string;
  menuClassName?: string;
}

export function ActionMenu({
  items,
  buttonClassName = "p-3 text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 focus:outline-none rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center",
  menuClassName = "absolute right-0 mt-2 w-48 bg-neutral-50 dark:bg-neutral-800 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-20 border border-neutral-200 dark:border-neutral-700",
}: ActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    // Support both mouse and touch events for better mobile compatibility
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  const getItemClassName = (variant: string = "default") => {
    const baseClasses =
      "block w-full text-left px-4 py-3 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors min-h-[44px] flex items-center";
    const variantClasses = {
      default: "text-neutral-700 dark:text-neutral-300",
      danger: "text-red-600 dark:text-red-400",
      success: "text-green-600 dark:text-green-400",
    };
    return `${baseClasses} ${
      variantClasses[variant as keyof typeof variantClasses] ||
      variantClasses.default
    }`;
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={buttonClassName}
        aria-label="Open menu"
      >
        <span>⋮</span>
      </button>
      {isOpen && (
        <div ref={menuRef} className={menuClassName}>
          {items.map((item, index) => (
            <button
              key={index}
              onClick={() => {
                item.onClick();
                setIsOpen(false);
              }}
              className={`${getItemClassName(item.variant)} ${
                index === 0 ? "rounded-t-md" : ""
              } ${index === items.length - 1 ? "rounded-b-md" : ""} ${
                index > 0 ? "border-t border-neutral-200 dark:border-neutral-700" : ""
              }`}
            >
              <span className="mr-2">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
