import { ReactNode } from "react";

interface Tab {
  id: string;
  label: string;
  icon?: string;
  content: ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export function Tabs({ tabs, activeTab, onTabChange }: TabsProps) {
  return (
    <div>
      <div className="border-b border-neutral-200 dark:border-neutral-700">
        <nav className="overflow-x-auto flex -mb-px" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              style={{ minWidth: "max-content" }}
              className={`
                whitespace-nowrap py-4 px-4 border-b-2 font-medium text-sm transition-colors
                ${
                  activeTab === tab.id
                    ? "border-primary-500 text-primary-600 dark:text-primary-400"
                    : "border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300 dark:text-neutral-400 dark:hover:text-neutral-300"
                }
              `}
            >
              {tab.icon && <span className="mr-2">{tab.icon}</span>}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
      <div className="mt-6">
        {tabs.find((tab) => tab.id === activeTab)?.content}
      </div>
    </div>
  );
}
