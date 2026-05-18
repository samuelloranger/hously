import React from "react";
import { useTranslation } from "react-i18next";
import { Dialog } from "@/components/dialog";
import { HabitForm } from "@/pages/habits/_component/HabitForm";
import { useCreateHabit } from "@/pages/habits/useCreateHabit";
import type { CreateHabitRequest } from "@hously/shared/types";
import { toast } from "sonner";

interface CreateHabitModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateHabitModal: React.FC<CreateHabitModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation("common");
  const createHabit = useCreateHabit();

  const handleSubmit = (data: CreateHabitRequest) => {
    createHabit.mutate(data, {
      onSuccess: () => {
        toast.success(t("habits.habitCreated"));
        onClose();
      },
      onError: () => {
        toast.error("Failed to create habit");
      },
    });
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={t("habits.addHabit")}
      showCloseButton
    >
      <div className="p-1">
        <HabitForm onSubmit={handleSubmit} isLoading={createHabit.isPending} />
      </div>
    </Dialog>
  );
};
