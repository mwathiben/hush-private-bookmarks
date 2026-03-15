import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { validateMnemonic } from '@/lib/recovery';

type VerifyResult = 'idle' | 'valid' | 'invalid';

function normalizePhrase(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function RecoveryPhraseVerify(): React.JSX.Element {
  const [phrase, setPhrase] = useState('');
  const [result, setResult] = useState<VerifyResult>('idle');

  const handleVerify = (): void => {
    const normalized = normalizePhrase(phrase);
    const isValid = validateMnemonic(normalized);
    setResult(isValid ? 'valid' : 'invalid');
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="recovery-phrase">Recovery phrase</Label>
        <Textarea
          id="recovery-phrase"
          value={phrase}
          onChange={(e) => setPhrase(e.target.value)}
          placeholder="Enter your recovery phrase"
          rows={3}
        />
      </div>
      {result === 'valid' && (
        <p className="text-sm text-green-600">Valid recovery phrase</p>
      )}
      {result === 'invalid' && (
        <p className="text-sm text-destructive" role="alert">Invalid recovery phrase</p>
      )}
      <Button type="button" size="sm" variant="outline" onClick={handleVerify}>
        Verify
      </Button>
    </div>
  );
}
