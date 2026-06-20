import { SignUp } from '@clerk/nextjs';
import { AuthBrandPanel } from '../../../../components/AuthBrandPanel';

export const metadata = { title: 'Sign up - Yacht Uniform Lookbook' };

export default function SignUpPage() {
  return (
    <div className="auth-screen">
      <div className="auth-shell">
        <AuthBrandPanel />
        <div className="auth-widget">
          <SignUp fallbackRedirectUrl="/workspace" forceRedirectUrl="/workspace" />
        </div>
      </div>
    </div>
  );
}
