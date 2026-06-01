import { useState, type ChangeEvent } from "react";
import { useForm, useWatch, Controller } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useCreateChore } from "@/pages/chores/useCreateChore";
import { useUpdateChore } from "@/pages/chores/useUpdateChore";
import { useUploadChoreImage } from "@/pages/chores/useUploadChoreImage";
import type { Chore, ChoreUser } from "@hously/shared/types";
import { formatUsername } from "@/lib/utils/format";
import { getChoreThumbnailUrl } from "@/lib/utils/media";
import {
  datetimeLocalToUTC,
  toDateTimeLocal,
  tomorrow,
} from "@hously/shared/utils";
import { useNotifications } from "@/lib/notifications/useNotifications";
import { DateTimePicker } from "@/components/DateTimePicker";
import { MinimalTiptap } from "@/components/ui/minimal-tiptap";

interface ChoreFormProps {
  users: ChoreUser[];
  chore?: Chore;
  onClose: () => void;
  onImageClick?: () => void;
}

interface FormData {
  chore_name: string;
  description: string;
  assigned_to: number | null;
  reminder_enabled: boolean;
  reminder_datetime: string;
  recurrence_enabled: boolean;
  recurrence_type: "daily_interval" | "weekly" | null;
  recurrence_interval_days: number;
  recurrence_weekday: number;
}

export function ChoreForm(props: ChoreFormProps) {
  return <ChoreFormInner key={props.chore?.id ?? "create"} {...props} />;
}

function ChoreFormInner({
  users,
  chore,
  onClose,
  onImageClick,
}: ChoreFormProps) {
  const { t } = useTranslation("common");
  const { subscription } = useNotifications();
  const isEdit = chore !== undefined;
  const createMutation = useCreateChore();
  const updateMutation = useUpdateChore();
  const uploadImageMutation = useUploadChoreImage();
  const submitMutation = isEdit ? updateMutation : createMutation;

  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    control,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: chore
      ? {
          chore_name: chore.chore_name,
          description: chore.description || "",
          assigned_to: chore.assigned_to || null,
          reminder_enabled: chore.reminder_enabled || false,
          reminder_datetime: chore.reminder_datetime
            ? toDateTimeLocal(new Date(chore.reminder_datetime))
            : "",
          recurrence_enabled: !!chore.recurrence_type,
          recurrence_type: chore.recurrence_type || null,
          recurrence_interval_days: chore.recurrence_interval_days || 1,
          recurrence_weekday: chore.recurrence_weekday || 0,
        }
      : {
          chore_name: "",
          description: "",
          assigned_to: null,
          reminder_enabled: false,
          reminder_datetime: "",
          recurrence_enabled: false,
          recurrence_type: null,
          recurrence_interval_days: 1,
          recurrence_weekday: 0,
        },
  });

  const reminderEnabled = useWatch({ control, name: "reminder_enabled" });
  const recurrenceEnabled = useWatch({ control, name: "recurrence_enabled" });
  const recurrenceType = useWatch({ control, name: "recurrence_type" });

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
  };

  const handleToggleReminder = (newEnabled: boolean) => {
    setValue("reminder_enabled", newEnabled);
    if (newEnabled) {
      setValue("reminder_datetime", toDateTimeLocal(tomorrow()));
    } else {
      setValue("reminder_datetime", "");
    }
  };

  const buildPayload = (data: FormData, imagePath: string | null) => ({
    chore_name: data.chore_name.trim(),
    assigned_to: data.assigned_to || null,
    description:
      data.description && data.description !== "<p></p>"
        ? data.description
        : null,
    reminder_enabled: data.reminder_enabled,
    reminder_datetime:
      data.reminder_enabled && data.reminder_datetime
        ? datetimeLocalToUTC(data.reminder_datetime)
        : undefined,
    image_path: imagePath,
    subscription_info:
      data.reminder_enabled && subscription ? subscription : undefined,
    recurrence_type:
      data.recurrence_enabled && data.recurrence_type
        ? data.recurrence_type
        : null,
    recurrence_interval_days:
      data.recurrence_enabled && data.recurrence_type === "daily_interval"
        ? data.recurrence_interval_days
        : undefined,
    recurrence_weekday:
      data.recurrence_enabled && data.recurrence_type === "weekly"
        ? data.recurrence_weekday
        : undefined,
  });

  const onSubmit = async (data: FormData) => {
    let imagePath: string | null = chore?.image_path ?? null;

    if (selectedImage) {
      setIsUploadingImage(true);
      try {
        const formData = new FormData();
        formData.append("image", selectedImage);
        const result = await uploadImageMutation.mutateAsync(formData);
        if (result.success && result.data) {
          imagePath = result.data.image_path;
        } else {
          console.error("Image upload failed - no data:", result);
          toast.error(t("chores.imageUploadError") || "Failed to upload image");
          setIsUploadingImage(false);
          return;
        }
      } catch (error) {
        console.error("Error uploading image:", error);
        toast.error(t("chores.imageUploadError") || "Failed to upload image");
        setIsUploadingImage(false);
        return;
      }
      setIsUploadingImage(false);
    }

    const payload = buildPayload(data, imagePath);

    if (isEdit) {
      updateMutation.mutate(
        { choreId: chore.id, data: payload },
        {
          onSuccess: () => {
            onClose();
          },
        },
      );
    } else {
      createMutation.mutate(payload, {
        onSuccess: () => {
          reset();
          setSelectedImage(null);
          setImagePreview(null);
          onClose();
        },
      });
    }
  };

  const idPrefix = isEdit ? "edit_" : "";

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor={`${idPrefix}chore_name`}
            className="block text-sm font-medium text-neutral-300"
          >
            {t("chores.choreName")}
          </label>
          <input
            type="text"
            id={`${idPrefix}chore_name`}
            {...register("chore_name", { required: true })}
            className="mt-1 w-full px-3 py-2 border border-neutral-600 rounded-md placeholder-neutral-400 text-neutral-100 bg-neutral-700 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
            placeholder={t("chores.choreNamePlaceholder")}
          />
          {errors.chore_name && (
            <p className="mt-1 text-sm text-rose-400">
              {t("chores.choreNameRequired") || "Chore name is required"}
            </p>
          )}
        </div>
        <div>
          <label
            htmlFor={`${idPrefix}assigned_to`}
            className="block text-sm font-medium text-neutral-300"
          >
            {t("chores.assignTo")}
          </label>
          <select
            id={`${idPrefix}assigned_to`}
            {...register("assigned_to", {
              setValueAs: (v) => (v === "" ? null : Number(v)),
            })}
            className="mt-1 w-full px-3 py-2 border border-neutral-600 rounded-md text-neutral-100 bg-neutral-700 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">{t("chores.anyoneCanDo")}</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.first_name || user.last_name
                  ? formatUsername(
                      [user.first_name, user.last_name]
                        .filter(Boolean)
                        .join(" "),
                    )
                  : user.email}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label
          htmlFor={`${idPrefix}description`}
          className="block text-sm font-medium text-neutral-300 mb-2"
        >
          {t("chores.description")}
        </label>
        <Controller
          name="description"
          control={control}
          render={({ field }) => (
            <MinimalTiptap
              content={field.value}
              onChange={field.onChange}
              placeholder={t("chores.descriptionPlaceholder")}
              className="mt-1"
            />
          )}
        />
      </div>

      <div>
        <label
          htmlFor={`${idPrefix}image`}
          className="block text-sm font-medium text-neutral-300 mb-2"
        >
          {t("chores.image")}
        </label>
        {isEdit && chore.image_path && !imagePreview && (
          <div className="mb-2 flex items-center gap-2">
            <img
              src={getChoreThumbnailUrl(chore.image_path) || ""}
              alt={chore.chore_name}
              onClick={onImageClick}
              className={`w-12 h-12 object-cover rounded border border-neutral-600 ${
                onImageClick ? "cursor-pointer" : ""
              }`}
            />
            <button
              type="button"
              onClick={() => {
                updateMutation.mutate(
                  {
                    choreId: chore.id,
                    data: { remove_image: true },
                  },
                  {
                    onSuccess: () => {
                      setImagePreview(null);
                    },
                  },
                );
              }}
              className="text-sm text-rose-400 hover:underline"
            >
              {t("chores.removeImage")}
            </button>
          </div>
        )}
        {imagePreview && (
          <div className="mb-2 flex items-center gap-2">
            <img
              src={imagePreview}
              alt="Preview"
              className="w-12 h-12 object-cover rounded border border-neutral-600"
            />
            <button
              type="button"
              onClick={handleRemoveImage}
              className="text-sm text-rose-400 hover:underline"
            >
              {t("chores.removeImage")}
            </button>
          </div>
        )}
        <input
          type="file"
          id={`${idPrefix}image`}
          accept="image/*"
          onChange={handleImageChange}
          className="mt-1 w-full px-3 py-2 border border-neutral-600 rounded-md text-neutral-100 bg-neutral-700 focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-sm"
        />
        <p className="mt-1 text-xs text-neutral-400">{t("chores.imageHelp")}</p>
      </div>

      <div className="border-t border-neutral-700 pt-4">
        {!subscription && (
          <p className="text-xs text-amber-400 mb-4">
            {t("chores.noSubscriptionWarning")}
          </p>
        )}
        <div className="flex items-center justify-between mb-4">
          <div>
            <label
              htmlFor={`${idPrefix}reminder_enabled`}
              className="block text-sm font-medium text-neutral-300"
            >
              {t("chores.enableReminder")}
            </label>
            <p className="text-xs text-neutral-400 mt-1">
              {t("chores.reminderDescription")}
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              id={`${idPrefix}reminder_enabled`}
              {...register("reminder_enabled")}
              onChange={(e) => handleToggleReminder(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-800 rounded-full peer bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-neutral-200 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-neutral-200 after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all border-neutral-600 peer-checked:bg-primary-600"></div>
          </label>
        </div>
        {reminderEnabled && (
          <div>
            <label
              htmlFor={`${idPrefix}reminder_datetime`}
              className="block text-sm font-medium text-neutral-300 mb-2"
            >
              {t("chores.reminderDateTime")}
            </label>
            <Controller
              name="reminder_datetime"
              control={control}
              render={({ field }) => (
                <DateTimePicker
                  id={`${idPrefix}reminder_datetime`}
                  value={field.value}
                  onChange={field.onChange}
                  minDate={new Date()}
                  placeholder={t("chores.reminderDateTime")}
                />
              )}
            />
          </div>
        )}
      </div>

      <div className="border-t border-neutral-700 pt-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <label
              htmlFor={`${idPrefix}recurrence_enabled`}
              className="block text-sm font-medium text-neutral-300"
            >
              {t("chores.enableRecurrence") || "Récurrence"}
            </label>
            <p className="text-xs text-neutral-400 mt-1">
              {t("chores.recurrenceDescription") ||
                "Créez automatiquement une nouvelle tâche selon un planning"}
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              id={`${idPrefix}recurrence_enabled`}
              {...register("recurrence_enabled")}
              onChange={(e) => {
                setValue("recurrence_enabled", e.target.checked);
                if (!e.target.checked) {
                  setValue("recurrence_type", null);
                } else if (!recurrenceType) {
                  setValue("recurrence_type", "daily_interval");
                }
              }}
              className="sr-only peer"
            />
            <div className="w-11 h-6 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-800 rounded-full peer bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-neutral-200 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-neutral-200 after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all border-neutral-600 peer-checked:bg-primary-600"></div>
          </label>
        </div>
        {recurrenceEnabled && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                {t("chores.recurrenceType") || "Type de récurrence"}
              </label>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    {...register("recurrence_type")}
                    value="daily_interval"
                    onChange={() => {
                      setValue("recurrence_type", "daily_interval");
                      setValue("recurrence_weekday", 0);
                    }}
                    className="mr-2"
                  />
                  <span className="text-sm text-neutral-300">
                    {t("chores.dailyInterval") || "Tous les X jours"}
                  </span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    {...register("recurrence_type")}
                    value="weekly"
                    onChange={() => {
                      setValue("recurrence_type", "weekly");
                      setValue("recurrence_interval_days", 1);
                    }}
                    className="mr-2"
                  />
                  <span className="text-sm text-neutral-300">
                    {t("chores.weekly") || "Hebdomadaire"}
                  </span>
                </label>
              </div>
            </div>
            {recurrenceType === "daily_interval" && (
              <div>
                <label
                  htmlFor={`${idPrefix}recurrence_interval_days`}
                  className="block text-sm font-medium text-neutral-300 mb-2"
                >
                  {t("chores.intervalDays") || "Nombre de jours"}
                </label>
                <input
                  type="number"
                  id={`${idPrefix}recurrence_interval_days`}
                  min="1"
                  {...register("recurrence_interval_days", {
                    valueAsNumber: true,
                    min: 1,
                  })}
                  className="w-full px-3 py-2 border border-neutral-600 rounded-md text-neutral-100 bg-neutral-700 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            )}
            {recurrenceType === "weekly" && (
              <div>
                <label
                  htmlFor={`${idPrefix}recurrence_weekday`}
                  className="block text-sm font-medium text-neutral-300 mb-2"
                >
                  {t("chores.weekday") || "Jour de la semaine"}
                </label>
                <select
                  id={`${idPrefix}recurrence_weekday`}
                  {...register("recurrence_weekday", {
                    valueAsNumber: true,
                  })}
                  className="w-full px-3 py-2 border border-neutral-600 rounded-md text-neutral-100 bg-neutral-700 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value={0}>{t("chores.monday") || "Lundi"}</option>
                  <option value={1}>{t("chores.tuesday") || "Mardi"}</option>
                  <option value={2}>
                    {t("chores.wednesday") || "Mercredi"}
                  </option>
                  <option value={3}>{t("chores.thursday") || "Jeudi"}</option>
                  <option value={4}>{t("chores.friday") || "Vendredi"}</option>
                  <option value={5}>{t("chores.saturday") || "Samedi"}</option>
                  <option value={6}>{t("chores.sunday") || "Dimanche"}</option>
                </select>
              </div>
            )}
          </div>
        )}
      </div>

      {isEdit ? (
        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-neutral-300 bg-neutral-700 hover:bg-neutral-600 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            disabled={submitMutation.isPending || isUploadingImage}
            className="px-4 py-2 text-sm font-medium text-neutral-950 bg-primary-600 hover:bg-primary-500 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
          >
            {isUploadingImage
              ? t("chores.uploadingImage")
              : submitMutation.isPending
                ? t("common.saving")
                : t("common.save")}
          </button>
        </div>
      ) : (
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitMutation.isPending || isUploadingImage}
            className="px-6 py-2 bg-primary-600 hover:bg-primary-500 text-neutral-950 font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2 focus:ring-offset-neutral-800 transition-colors disabled:opacity-50"
          >
            <Plus size={16} className="mr-1.5 inline" />
            {isUploadingImage
              ? t("chores.uploadingImage")
              : t("chores.addChore")}
          </button>
        </div>
      )}
    </form>
  );
}
