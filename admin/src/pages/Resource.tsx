import { useParams, Navigate } from 'react-router-dom';
import { getResource } from '@/config/resources';
import { getResourceVisual } from '@/config/resourceVisuals';
import DataTable from '@/components/data/DataTable';
import ResourceStats from '@/components/data/ResourceStats';
import { Insights } from '@/components/data/Insights';
import ResourceHero from '@/components/layout/ResourceHero';

export default function ResourcePage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const resource = getResource(slug);
  if (!resource) return <Navigate to="/" replace />;
  const visual = getResourceVisual(slug);

  return (
    <div className="space-y-5 p-8">
      <ResourceHero
        icon={visual.icon}
        accent={visual.accent}
        title={resource.title}
        blurb={visual.blurb}
        table={resource.table ?? resource.slug}
        readOnly={resource.readOnly}
      />
      <Insights slug={slug} />
      <ResourceStats resource={resource} />
      <DataTable resource={resource} />
    </div>
  );
}
