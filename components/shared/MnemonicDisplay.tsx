import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';

interface MnemonicDisplayProps {
  readonly mnemonic: string;
}

const COPY_FEEDBACK_MS = 2000;

export function MnemonicDisplay({
  mnemonic,
}: MnemonicDisplayProps): React.JSX.Element {
  const words = mnemonic.split(/\s+/);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  const handleCopy = useCallback(async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(mnemonic);
      setCopied(true);
    } catch {
      // Clipboard API may be unavailable in certain contexts
    }
  }, [mnemonic]);

  return (
    <div data-testid="mnemonic-display">
      <div className="grid grid-cols-3 gap-2">
        {words.map((word, i) => (
          <div
            key={i}
            className="rounded border border-border bg-muted px-2 py-1 text-sm"
          >
            <span className="mr-1 text-muted-foreground">{i + 1}.</span>
            <span className="font-mono">{word}</span>
          </div>
        ))}
      </div>
      <Button
        variant="outline"
        size="sm"
        className="mt-3 w-full"
        onClick={handleCopy}
        data-testid="copy-mnemonic-button"
      >
        {copied ? 'Copied!' : 'Copy to clipboard'}
      </Button>
    </div>
  );
}
