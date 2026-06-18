import { SignIn } from '@clerk/nextjs';
import { AuthBrandPanel } from '../../../components/AuthBrandPanel';

export const metadata = { title: 'Sign in - Yacht Uniform Lookbook' };

export default function SignInPage() {
  return (
    <div className="auth-screen">
      <div className="auth-shell">
        <AuthBrandPanel />
        <div className="auth-widget">
          <SignIn />
        </div>
      </div>
    </div>
  );
}
