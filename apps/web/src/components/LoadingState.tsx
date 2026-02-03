import { PageLayout } from "./PageLayout";
import { HouseLoader } from "./HouseLoader";

export function LoadingState() {
  return (
    <PageLayout>
      <div className="flex items-center justify-center py-8">
        <HouseLoader size="md" />
      </div>
    </PageLayout>
  );
}
