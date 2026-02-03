import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Dialog } from "../../../components/dialog";
import { RecipeForm } from "./RecipeForm";

interface CreateRecipeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateRecipeModal({ isOpen, onClose }: CreateRecipeModalProps) {
  const { t } = useTranslation("common");
  const navigate = useNavigate();

  const handleSuccess = (recipeId: number) => {
    onClose();
    navigate({ to: `/kitchen/${recipeId}` });
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={t("recipes.addRecipe", "Add Recipe")}
    >
      <RecipeForm onCancel={onClose} onSuccess={handleSuccess} />
    </Dialog>
  );
}
