import { useState, useCallback } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'hush-theme';

function applyTheme(t: Theme): void {
  if (t === 'dark') {
    document.documentElement.classList.add('dark');
  } else if (t === 'light') {
    document.documentElement.classList.remove('dark');
  } else {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('dark', prefersDark);
  }
}

export function ThemeToggle(): React.JSX.Element {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? 'system',
  );

  const handleSelect = useCallback((t: Theme) => {
    localStorage.setItem(STORAGE_KEY, t);
    applyTheme(t);
    setTheme(t);
  }, []);

  const options: readonly { readonly value: Theme; readonly label: string; readonly icon: typeof Sun }[] = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ];

  return (
    <div className="flex gap-2">
      {options.map(({ value, label, icon: Icon }) => (
        <Button
          key={value}
          variant={theme === value ? 'default' : 'outline'}
          size="sm"
          aria-pressed={theme === value}
          onClick={() => handleSelect(value)}
        >
          <Icon className="mr-1 size-3.5" />
          {label}
        </Button>
      ))}
    </div>
  );
}
