import Workspace from '../../../components/Workspace';
import { backendEnabled, hasBlob } from '../../../lib/config';
import { getActiveContext } from '../../../lib/auth';
import { getWorkspace, getActiveOrder, listArtifacts, listMembers } from '../../../lib/repository';
import { can } from '../../../lib/permissions';

export const metadata = {
  title: 'Workspace — Yacht Uniform Lookbook',
  description: 'Manage crew uniforms, looks, sizing, budgets, and procurement for your yacht.',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function WorkspacePage() {
  if (!backendEnabled) {
    return <Workspace mode="local" canUpload={hasBlob} />;
  }

  const ctx = await getActiveContext();
  if (!ctx) {
    return <Workspace mode="local" canUpload={hasBlob} />;
  }

  const [data, activeOrder, artifacts, members] = await Promise.all([
    getWorkspace(ctx.yachtId),
    getActiveOrder(ctx.yachtId),
    listArtifacts(ctx.yachtId),
    can(ctx.role, 'member.manage') ? listMembers(ctx.yachtId) : Promise.resolve([]),
  ]);

  const authInfo = {
    signedIn: true,
    userId: ctx.user.id,
    activeYachtId: ctx.yachtId,
    yachtName: ctx.yacht?.name || '',
    role: ctx.role,
    yachts: ctx.memberships.map((m) => ({ id: m.yachtId, name: m.yacht.name })),
    activeOrder,
    artifacts,
    members,
  };

  return (
    <Workspace
      mode="server"
      initialData={data}
      authInfo={authInfo}
      canUpload={hasBlob && can(ctx.role, 'product.upload')}
    />
  );
}
