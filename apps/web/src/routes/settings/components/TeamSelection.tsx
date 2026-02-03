import { cn } from "@/lib/utils";
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";

interface Team {
  id: number;
  name: string;
  location_name: string;
  team_name: string;
}

interface TeamSelectionProps {
  teams: Team[];
  selectedTeamIds: number[];
  onTeamToggle: (teamId: number, isSelected: boolean) => void;
  isLoading?: boolean;
}

export function TeamSelection({
  teams,
  selectedTeamIds,
  onTeamToggle,
  isLoading = false,
}: TeamSelectionProps) {
  const { t } = useTranslation("common");
  const [searchQuery, setSearchQuery] = useState("");

  // Filter teams by search query
  const filteredTeams = useMemo(() => {
    if (!searchQuery.trim()) {
      return teams;
    }
    const query = searchQuery.toLowerCase();
    return teams.filter(
      (team) =>
        team.name.toLowerCase().includes(query) ||
        team.location_name.toLowerCase().includes(query) ||
        team.team_name.toLowerCase().includes(query)
    );
  }, [teams, searchQuery]);

  return (
    <div className="space-y-4">
      {/* Search input */}
      <div>
        <input
          type="text"
          placeholder={
            t("settings.calendar.sportsMatches.searchPlaceholder") ||
            "Search teams..."
          }
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {/* Teams list */}
      <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg max-h-96 overflow-y-auto">
        {filteredTeams.length === 0 ? (
          <div className="p-4 text-center text-neutral-500 dark:text-neutral-400">
            {t("settings.calendar.sportsMatches.noTeamsFound") ||
              "No teams found"}
          </div>
        ) : (
          <div className="divide-y divide-neutral-200 dark:divide-neutral-700">
            {filteredTeams.map((team) => {
              const isSelected = selectedTeamIds.includes(team.id);
              return (
                <label
                  key={team.id}
                  className={`flex items-center p-4 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors ${
                    isSelected
                      ? "bg-primary-50 dark:bg-primary-900/20 text-primary-600 hover:text-primary-600 dark:hover:text-primary-400"
                      : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => onTeamToggle(team.id, e.target.checked)}
                    disabled={isLoading}
                    className="w-4 h-4 text-primary-600 border-neutral-300 rounded focus:ring-primary-500 focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <div className="ml-3 flex-1">
                    <div
                      className={cn(
                        "text-sm font-medium text-neutral-900 dark:text-neutral-100",
                        isSelected
                          ? "text-primary-600 dark:text-primary-400"
                          : ""
                      )}
                    >
                      {team.name}
                    </div>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400">
                      {team.location_name}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* Selected count */}
      {selectedTeamIds.length > 0 && (
        <div className="text-sm text-neutral-600 dark:text-neutral-400">
          {t("settings.calendar.sportsMatches.selectedCount", {
            count: selectedTeamIds.length,
          }) || `${selectedTeamIds.length} team(s) selected`}
        </div>
      )}
    </div>
  );
}
