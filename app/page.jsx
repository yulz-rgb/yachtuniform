import Workspace from '../components/Workspace';
import { backendEnabled, hasBlob } from '../lib/config';
import { getActiveContext } from '../lib/auth';
import { getWorkspace } from '../lib/repository';

export const dynamic = 'force-dynamic';

export default async function Page() {
  if (!backendEnabled) {
    return <Workspace mode="local" canUpload={hasBlob} />;
  }

  const ctx = await getActiveContext();
  if (!ctx) {
    return <Workspace mode="local" canUpload={hasBlob} />;
  }

  const data = await getWorkspace(ctx.yachtId);
  const authInfo = {
    signedIn: true,
    activeYachtId: ctx.yachtId,
    role: ctx.role,
    yachts: ctx.memberships.map((m) => ({ id: m.yachtId, name: m.yacht.name })),
  };

  return <Workspace mode="server" initialData={data} authInfo={authInfo} canUpload={hasBlob} />;
}
