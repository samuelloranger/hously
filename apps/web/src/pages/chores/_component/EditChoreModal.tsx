import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog } from "@/components/dialog";
import { ChoreForm } from "@/pages/chores/_component/ChoreForm";
import { ImageModal } from "@/components/ImageModal";
import type { Chore, ChoreUser } from "@hously/shared/types";
import { getChoreImageUrl } from "@/lib/utils/media";

interface EditChoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  chore: Chore;
  users: ChoreUser[];
}

export function EditChoreModal({
  isOpen,
  onClose,
  chore,
  users,
}: EditChoreModalProps) {
  const { t } = useTranslation("common");
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);

  return (
    <>
      <Dialog
        isOpen={isOpen}
        onClose={onClose}
        title={t("chores.editChore")}
        panelClassName="max-h-[80dvh]"
      >
        <ChoreForm
          chore={chore}
          users={users}
          onClose={onClose}
          onImageClick={() => setIsImageModalOpen(true)}
        />
      </Dialog>
      {chore.image_path && (
        <ImageModal
          isOpen={isImageModalOpen}
          onClose={() => setIsImageModalOpen(false)}
          imageUrl={getChoreImageUrl(chore.image_path) || ""}
          alt={chore.chore_name}
        />
      )}
    </>
  );
}
