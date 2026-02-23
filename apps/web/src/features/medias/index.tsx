import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageLayout } from '../../components/PageLayout';
import { PageHeader } from '../../components/PageHeader';
import { MediasLibrary } from './components/MediasLibrary';
import { MediasExplore } from './components/MediasExplore';
import { Compass, Library } from 'lucide-react';

export function MediasPage() {
  const { t } = useTranslation('common');
  const [activeTab, setActiveTab] = useState<'explore' | 'library'>('explore');

  return (
    <PageLayout>
      <PageHeader
        icon="🎞️"
        iconColor="text-indigo-600"
        title={t('medias.title')}
        subtitle={t('medias.subtitle')}
      />

      <div className="space-y-6">
        {/* Tab Switcher */}
        <div className="flex items-center gap-1 p-1 bg-neutral-100 dark:bg-neutral-800 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab('explore')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'explore'
                ? 'bg-white dark:bg-neutral-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
            }`}
          >
            <Compass size={16} />
            {t('medias.tabs.explore')}
          </button>
          <button
            onClick={() => setActiveTab('library')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'library'
                ? 'bg-white dark:bg-neutral-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
            }`}
          >
            <Library size={16} />
            {t('medias.tabs.library')}
          </button>
        </div>

        {activeTab === 'explore' ? <MediasExplore /> : <MediasLibrary />}
      </div>
    </PageLayout>
  );
}
