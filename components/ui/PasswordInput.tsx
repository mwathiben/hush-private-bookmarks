import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface PasswordInputProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onSubmit?: () => void;
  readonly disabled?: boolean;
  readonly placeholder?: string;
  readonly autoFocus?: boolean;
}

export function PasswordInput({
  value,
  onChange,
  onSubmit,
  disabled = false,
  placeholder = 'Password',
  autoFocus = false,
}: PasswordInputProps): React.JSX.Element {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSubmit?.();
        }}
        disabled={disabled}
        placeholder={placeholder}
        autoFocus={autoFocus}
        aria-label={placeholder}
        className="pr-9"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="absolute right-1 top-1/2 -translate-y-1/2"
        onClick={() => setVisible((v) => !v)}
        disabled={disabled}
        aria-label="Toggle password visibility"
      >
        {visible ? <EyeOff /> : <Eye />}
      </Button>
    </div>
  );
}
