import { useTranslation } from "react-i18next";
import { ChoreForm } from "@/pages/chores/_component/ChoreForm";
import type { ChoreUser } from "@hously/shared/types";
import { Dialog } from "@/components/dialog";

interface CreateChoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: ChoreUser[];
}

export function CreateChoreModal({
  isOpen,
  onClose,
  users,
}: CreateChoreModalProps) {
  const { t } = useTranslation("common");

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={t("chores.addNewChore")}
      showCloseButton
    >
      <ChoreForm users={users} onClose={onClose} />
    </Dialog>
  );
}
