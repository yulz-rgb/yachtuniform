import Workspace from '../../components/Workspace';

export const metadata = {
  title: 'Demo — Yacht Uniform Lookbook',
  description: 'Try the yacht uniform lookbook without signing in.',
};

export default function DemoPage() {
  return <Workspace mode="local" canUpload={false} isDemo />;
}
