import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import {
  CreateHabitRequest,
  Habit,
  UpdateHabitRequest,
} from "@hously/shared/types";
import { EmojiPicker } from "@/pages/habits/_component/EmojiPicker";
import { ScheduleTimePicker } from "@/pages/habits/_component/ScheduleTimePicker";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { FormInput, FormTextarea } from "@/components/ui/form-field";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type HabitFormProps =
  | {
      habit?: undefined;
      onSubmit: (data: CreateHabitRequest) => void;
      isLoading?: boolean;
    }
  | {
      habit: Habit;
      onSubmit: (data: UpdateHabitRequest) => void;
      isLoading?: boolean;
    };

interface HabitFormFields {
  name: string;
  description?: string;
}

export const HabitForm: React.FC<HabitFormProps> = ({
  habit,
  onSubmit,
  isLoading,
}) => {
  const { t } = useTranslation("common");
  const isEdit = habit !== undefined;

  const [selectedEmoji, setSelectedEmoji] = useState(habit?.emoji ?? "💧");
  const [times, setTimes] = useState<string[]>(
    habit ? habit.schedules.map((s) => s.time) : ["08:00"],
  );
  const [isActive, setIsActive] = useState(habit?.active ?? true);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<HabitFormFields>({
    defaultValues: {
      name: habit?.name ?? "",
      description: habit?.description ?? "",
    },
  });

  const handleFormSubmit = (data: HabitFormFields) => {
    if (isEdit) {
      (onSubmit as (data: UpdateHabitRequest) => void)({
        ...data,
        emoji: selectedEmoji,
        schedules: times,
        active: isActive,
      });
    } else {
      (onSubmit as (data: CreateHabitRequest) => void)({
        ...data,
        emoji: selectedEmoji,
        schedules: times,
      });
    }
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <div className="flex items-start gap-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-neutral-300">
            {t("habits.emoji")}
          </label>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-md bg-neutral-800 border border-neutral-600 text-2xl hover:bg-neutral-700 transition-colors"
              >
                {selectedEmoji}
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 p-2">
              <EmojiPicker
                selectedEmoji={selectedEmoji}
                onSelect={setSelectedEmoji}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex-1">
          <FormInput
            {...register("name", { required: t("habits.nameRequired") })}
            label={t("habits.name")}
            required
            placeholder={t("habits.namePlaceholder")}
            error={errors.name?.message}
          />
        </div>
      </div>

      <FormTextarea
        {...register("description")}
        label={t("habits.description")}
        placeholder={t("habits.descriptionPlaceholder")}
        rows={2}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ScheduleTimePicker times={times} onChange={setTimes} />

        <div className="rounded-xl border px-4 py-3 text-sm border-neutral-700 bg-neutral-800/60 text-neutral-300">
          <div className="font-semibold text-neutral-50">
            {t("habits.timesPerDay")}
          </div>
          <div className="mt-1">
            {t("habits.timesPerDayDerived", { count: times.length })}
          </div>
        </div>
      </div>

      {isEdit && (
        <div className="flex items-center gap-3 py-2 px-1">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="sr-only peer"
            />
            <div
              className={cn(
                "w-11 h-6 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-500/40 rounded-full peer bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-neutral-200 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-neutral-200 after:border-neutral-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all border-neutral-600 peer-checked:bg-primary-600",
              )}
            />
          </label>
          <span className="text-sm font-medium text-neutral-300">
            {isActive ? t("habits.active") : t("habits.inactive")}
          </span>
        </div>
      )}

      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
          {isLoading
            ? t(isEdit ? "common.updating" : "common.creating")
            : t(isEdit ? "habits.editHabit" : "habits.addHabit")}
        </Button>
      </div>
    </form>
  );
};
