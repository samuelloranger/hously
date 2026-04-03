import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

interface ActionMenuItem {
  label: string;
  icon: string;
  onClick: () => void;
  variant?: "default" | "danger" | "success";
}

interface ActionMenuProps {
  items: ActionMenuItem[];
  buttonClassName?: string;
}

const variantClasses = {
  default: "text-neutral-700 dark:text-neutral-300",
  danger: "text-red-600 dark:text-red-400",
  success: "text-green-600 dark:text-green-400",
};

export function ActionMenu({
  items,
  buttonClassName = "p-3 text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 focus:outline-none rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center",
}: ActionMenuProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className={buttonClassName} aria-label="Open menu">
          <span>⋮</span>
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className="w-48 bg-neutral-50 dark:bg-neutral-800 rounded-md shadow-lg ring-1 ring-black/5 z-20 border border-neutral-200 dark:border-neutral-700 animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2"
        >
          {items.map((item, index) => (
            <DropdownMenu.Item
              key={index}
              onSelect={item.onClick}
              className={`w-full text-left px-4 py-3 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors min-h-[44px] flex items-center cursor-pointer outline-none ${
                variantClasses[item.variant || "default"]
              } ${index === 0 ? "rounded-t-md" : ""} ${
                index === items.length - 1 ? "rounded-b-md" : ""
              } ${index > 0 ? "border-t border-neutral-200 dark:border-neutral-700" : ""}`}
            >
              <span className="mr-2">{item.icon}</span>
              {item.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
