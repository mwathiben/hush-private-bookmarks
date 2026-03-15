import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { validateMnemonic } from '@/lib/recovery';

type VerifyResult = 'idle' | 'valid' | 'invalid';

function normalizePhrase(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function RecoveryPhraseVerify(): React.JSX.Element {
  const [phrase, setPhrase] = useState('');
  const [result, setResult] = useState<VerifyResult>('idle');

  useEffect(() => {
    return () => setPhrase('');
  }, []);

  function handleVerify(): void {
    const normalized = normalizePhrase(phrase);
    const isValid = validateMnemonic(normalized);
    setResult(isValid ? 'valid' : 'invalid');
  }

  return (
    <div className="space-y-2">
      <Textarea
        id="recovery-phrase"
        value={phrase}
        onChange={(e) => setPhrase(e.target.value)}
        placeholder="Enter your 12-word recovery phrase"
        rows={2}
        aria-label="Recovery phrase"
      />
      {result === 'valid' && (
        <p className="text-sm text-primary" role="status">Valid recovery phrase</p>
      )}
      {result === 'invalid' && (
        <p className="text-sm text-destructive" role="alert">Invalid recovery phrase</p>
      )}
      <Button type="button" size="sm" variant="outline" onClick={handleVerify} disabled={!normalizePhrase(phrase)}>
        Verify
      </Button>
    </div>
  );
}
