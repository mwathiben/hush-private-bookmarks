import { Button } from '@/components/ui/button';
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface UpgradePromptProps {
  readonly featureName: string;
  readonly benefitText: string;
  readonly canTrial: boolean;
  readonly onUpgrade: () => void;
  readonly onStartTrial?: () => void;
}

export function UpgradePrompt({
  featureName,
  benefitText,
  canTrial,
  onUpgrade,
  onStartTrial,
}: UpgradePromptProps): React.JSX.Element {
  return (
    <Card data-testid="upgrade-prompt">
      <CardHeader>
        <CardTitle>{featureName}</CardTitle>
        <CardDescription>{benefitText}</CardDescription>
      </CardHeader>
      <CardFooter className="gap-2">
        {canTrial && onStartTrial && (
          <Button variant="outline" onClick={onStartTrial}>
            Start free trial
          </Button>
        )}
        <Button onClick={onUpgrade}>Upgrade to Pro</Button>
      </CardFooter>
    </Card>
  );
}
