import { PageLayout } from "@/components/PageLayout";
import { HouseLoader } from "@/components/HouseLoader";

export function LoadingState() {
  return (
    <PageLayout>
      <div className="flex items-center justify-center py-8">
        <HouseLoader size="md" />
      </div>
    </PageLayout>
  );
}
