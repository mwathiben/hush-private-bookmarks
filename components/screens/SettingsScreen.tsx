import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useSessionDispatch } from '@/entrypoints/popup/App';
import { PasswordChangeForm } from '@/components/settings/PasswordChangeForm';
import { RecoveryPhraseVerify } from '@/components/settings/RecoveryPhraseVerify';
import { ImportSection } from '@/components/settings/ImportSection';
import { ExportSection } from '@/components/settings/ExportSection';

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
      <div className="space-y-3 px-4 py-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-xs font-semibold uppercase text-muted-foreground">Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="mb-2 text-sm font-medium">Change Password</h4>
              <PasswordChangeForm />
            </div>
            <Separator />
            <div>
              <h4 className="mb-2 text-sm font-medium">Verify Recovery Phrase</h4>
              <RecoveryPhraseVerify />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-xs font-semibold uppercase text-muted-foreground">Import / Export</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="mb-2 text-sm font-medium">Import</h4>
              <ImportSection />
            </div>
            <Separator />
            <div>
              <h4 className="mb-2 text-sm font-medium">Export</h4>
              <ExportSection />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
