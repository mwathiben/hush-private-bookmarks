import type { PasswordSetInfo } from '@/lib/types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface SetPickerProps {
  readonly sets: readonly PasswordSetInfo[];
  readonly value: string;
  readonly onChange: (setId: string) => void;
  readonly disabled?: boolean;
}

export function SetPicker({
  sets,
  value,
  onChange,
  disabled = false,
}: SetPickerProps): React.JSX.Element | null {
  if (sets.length <= 1) return null;

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger aria-label="Password set">
        <SelectValue placeholder="Select set..." />
      </SelectTrigger>
      <SelectContent>
        {sets.map((set) => (
          <SelectItem key={set.id} value={set.id}>
            {set.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
