import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api";
import { queryKeys } from "../../../lib/queryKeys";
import type {
  CreateCustomEventRequest,
  UpdateCustomEventRequest,
  CalendarEvent,
  CalendarEventCustomEventMetadata,
} from "../../../types/api";
import { Dialog } from "../../../components/dialog";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import { MinimalTiptap } from "../../../components/ui/minimal-tiptap";
import {
  ColorPicker,
  ColorPickerSelection,
  ColorPickerHue,
  ColorPickerFormat,
} from "../../../components/ui/color-picker";
import { DateRangePicker } from "../../../components/DateRangePicker";

interface CreateCustomEventFormProps {
  isOpen: boolean;
  onClose: () => void;
  eventToEdit?: CalendarEvent & CalendarEventCustomEventMetadata;
}

function roundTo15Minutes(date: Date): Date {
  const rounded = new Date(date);
  const minutes = rounded.getMinutes();
  const roundedMinutes = Math.round(minutes / 15) * 15;
  rounded.setMinutes(roundedMinutes, 0, 0);
  return rounded;
}

export function CreateCustomEventForm({
  isOpen,
  onClose,
  eventToEdit,
}: CreateCustomEventFormProps) {
  const { t } = useTranslation("common");
  const queryClient = useQueryClient();
  const isEditMode = !!eventToEdit;

  const {
    register,
    handleSubmit,
    formState: { errors },
    getValues,
    reset,
    watch,
    setValue,
  } = useForm<CreateCustomEventRequest>({
    defaultValues: {
      title: eventToEdit?.title || "",
      description: eventToEdit?.description || "",
      start_datetime: eventToEdit?.metadata?.start_datetime || "",
      end_datetime: eventToEdit?.metadata?.end_datetime || "",
      all_day: eventToEdit?.metadata?.all_day || false,
      color: eventToEdit?.metadata?.color || "#3b82f6",
      recurrence_type: eventToEdit?.metadata?.recurrence_type || null,
      recurrence_interval_days:
        eventToEdit?.metadata?.recurrence_interval_days || null,
    },
  });

  const startDatetime = watch("start_datetime");
  const endDatetime = watch("end_datetime");
  const recurrenceType = watch("recurrence_type");

  const createMutation = useMutation({
    mutationFn: (data: CreateCustomEventRequest) => api.createCustomEvent(data),
    onSuccess: () => {
      toast.success(t("calendar.customEventCreated"));
      queryClient.invalidateQueries({
        queryKey: queryKeys.calendar.events(),
      });
      reset();
      onClose();
    },
    onError: (error: any) => {
      toast.error(
        error?.message || t("calendar.customEventError") || t("common.error")
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      eventId,
      data,
    }: {
      eventId: number;
      data: UpdateCustomEventRequest;
    }) => api.updateCustomEvent(eventId, data),
    onSuccess: () => {
      toast.success(t("calendar.customEventUpdated"));
      queryClient.invalidateQueries({
        queryKey: queryKeys.calendar.events(),
      });
      reset();
      onClose();
    },
    onError: (error: any) => {
      toast.error(
        error?.message || t("calendar.customEventError") || t("common.error")
      );
    },
  });

  const onSubmit = (data: CreateCustomEventRequest) => {
    // Round times to 15 minutes if not all_day
    let start = new Date(data.start_datetime);
    let end = new Date(data.end_datetime);

    if (!data.all_day) {
      start = roundTo15Minutes(start);
      end = roundTo15Minutes(end);
    }

    // Ensure end is after start
    if (end <= start) {
      toast.error(t("calendar.endAfterStart"));
      return;
    }

    if (
      isEditMode &&
      eventToEdit?.type === "custom_event" &&
      eventToEdit.metadata?.custom_event_id
    ) {
      // Update existing event
      const updateData: UpdateCustomEventRequest = {
        title: data.title,
        description: data.description || null,
        start_datetime: start.toISOString(),
        end_datetime: end.toISOString(),
        color: data.color,
        all_day: data.all_day,
        recurrence_type: recurrenceType || null,
        recurrence_interval_days:
          recurrenceType === "daily_interval"
            ? data.recurrence_interval_days || 2
            : null,
      };
      updateMutation.mutate({
        eventId: eventToEdit.metadata.custom_event_id,
        data: updateData,
      });
    } else {
      // Create new event
      const submitData: CreateCustomEventRequest = {
        ...data,
        start_datetime: start.toISOString(),
        end_datetime: end.toISOString(),
        description: data.description || null,
        color: data.color,
        all_day: data.all_day,
        recurrence_type: recurrenceType || null,
        recurrence_interval_days:
          recurrenceType === "daily_interval"
            ? data.recurrence_interval_days || 2
            : null,
      };
      createMutation.mutate(submitData);
    }
  };

  const handleRangeChange = (start: string, end: string) => {
    // DateRangePicker returns datetime-local format (YYYY-MM-DDTHH:mm)
    // Convert to Date objects and then to ISO strings
    const startDate = new Date(start);
    const endDate = new Date(end);

    if (!getValues("all_day")) {
      const roundedStart = roundTo15Minutes(startDate);
      const roundedEnd = roundTo15Minutes(endDate);
      setValue("start_datetime", roundedStart.toISOString());
      setValue("end_datetime", roundedEnd.toISOString());
    } else {
      // For all-day events, ensure times are set to start/end of day
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      setValue("start_datetime", startDate.toISOString());
      setValue("end_datetime", endDate.toISOString());
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={
        isEditMode
          ? t("calendar.editCustomEvent")
          : t("calendar.addCustomEvent")
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            {t("calendar.eventTitle")} *
          </label>
          <Input
            {...register("title", { required: true })}
            placeholder={t("calendar.eventTitlePlaceholder")}
          />
          {errors.title && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
              {t("calendar.titleRequired")}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            {t("calendar.description")}
          </label>
          <MinimalTiptap
            content={watch("description") || ""}
            onChange={(value) => setValue("description", value)}
            placeholder={t("calendar.descriptionPlaceholder")}
          />
        </div>

        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="all_day"
            checked={watch("all_day") || false}
            onChange={(e) => {
              setValue("all_day", e.target.checked);
              if (e.target.checked) {
                // Set to start/end of day
                const start = new Date(startDatetime);
                start.setHours(0, 0, 0, 0);
                setValue("start_datetime", start.toISOString());

                const end = new Date(endDatetime);
                end.setHours(23, 59, 59, 999);
                setValue("end_datetime", end.toISOString());
              }
            }}
            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-neutral-300 rounded"
          />
          <label
            htmlFor="all_day"
            className="text-sm font-medium text-neutral-700 dark:text-neutral-300"
          >
            {t("calendar.allDay")}
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            {t("calendar.startDateTime")} - {t("calendar.endDateTime")} *
          </label>
          <DateRangePicker
            startValue={startDatetime}
            endValue={endDatetime}
            onChange={handleRangeChange}
            allDay={watch("all_day") || false}
            placeholder={t("calendar.selectDateRange") || "Select date range"}
          />
          {(errors.start_datetime || errors.end_datetime) && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
              {errors.start_datetime
                ? t("calendar.startRequired")
                : t("calendar.endRequired")}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            {t("calendar.color")}
          </label>
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded border-2 border-neutral-300 dark:border-neutral-600"
              style={{ backgroundColor: watch("color") || "#3b82f6" }}
            />
            <div className="flex-1">
              <ColorPicker
                value={watch("color") || "#3b82f6"}
                onChange={(value: string) => setValue("color", value)}
              >
                <div className="w-full h-32">
                  <ColorPickerSelection />
                </div>
                <ColorPickerHue />
                <div className="flex items-center gap-2">
                  <ColorPickerFormat />
                </div>
              </ColorPicker>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            {t("calendar.recurrence")}
          </label>
          <select
            {...register("recurrence_type")}
            className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">{t("calendar.noRecurrence")}</option>
            <option value="daily_interval">{t("calendar.everyTwoDays")}</option>
            <option value="weekly">{t("calendar.weekly")}</option>
            <option value="biweekly">{t("calendar.biweekly")}</option>
            <option value="monthly">{t("calendar.monthly")}</option>
            <option value="yearly">{t("calendar.yearly")}</option>
          </select>
          {recurrenceType === "daily_interval" && (
            <div className="mt-2">
              <Input
                type="number"
                min="1"
                {...register("recurrence_interval_days", {
                  valueAsNumber: true,
                  min: 1,
                })}
                placeholder={t("calendar.intervalDays")}
                defaultValue={2}
              />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            type="submit"
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            {isEditMode
              ? updateMutation.isPending
                ? t("common.updating")
                : t("common.update")
              : createMutation.isPending
              ? t("common.creating")
              : t("common.create")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
