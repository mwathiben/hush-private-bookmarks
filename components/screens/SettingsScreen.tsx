import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSessionDispatch } from '@/entrypoints/popup/App';
import { PasswordChangeForm } from '@/components/settings/PasswordChangeForm';
import { RecoveryPhraseVerify } from '@/components/settings/RecoveryPhraseVerify';

export default function SettingsScreen(): React.JSX.Element {
  const dispatch = useSessionDispatch();

  return (
    <div data-testid="settings-screen" className="flex flex-col">
      <div className="flex items-center border-b px-4 py-2">
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Back"
          onClick={() => dispatch({ type: 'NAVIGATE', to: 'tree' })}
        >
          <ChevronLeft />
        </Button>
        <h2 className="ml-1 text-sm font-semibold">Settings</h2>
      </div>
      <div className="space-y-6 px-4 py-3">
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Account</h3>
          <div className="space-y-4">
            <div>
              <h4 className="mb-1 text-sm font-medium">Change Password</h4>
              <PasswordChangeForm />
            </div>
            <div>
              <h4 className="mb-1 text-sm font-medium">Verify Recovery Phrase</h4>
              <RecoveryPhraseVerify />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
