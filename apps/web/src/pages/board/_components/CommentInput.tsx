import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useCreateComment } from "@/pages/board/_hooks/useCreateComment";

export function CommentInput({ taskId }: { taskId: number }) {
  const { t } = useTranslation("common");
  const [body, setBody] = useState("");
  const { mutate, isPending } = useCreateComment();

  const submit = () => {
    const text = body.trim();
    if (!text) return;
    mutate({ taskId, body: text }, { onSuccess: () => setBody("") });
  };

  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
        }}
        placeholder="Write a comment… (⌘↵ to submit)"
        rows={3}
        className="w-full resize-none rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-400 border-neutral-700 bg-neutral-800/60 text-neutral-100 placeholder-neutral-500"
      />
      <div className="flex justify-end">
        <Button
          onClick={submit}
          disabled={isPending || !body.trim()}
          className="h-7 bg-primary-600 px-3 text-xs hover:bg-primary-700"
        >
          {t("board.comment")}
        </Button>
      </div>
    </div>
  );
}
