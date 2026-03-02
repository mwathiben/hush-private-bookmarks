import { Button } from '@/components/ui/button';

function App() {
  return (
    <div className="flex min-h-[400px] w-[350px] flex-col items-center justify-center gap-4 bg-background p-6 text-foreground">
      <h1 className="text-xl font-semibold">Hush</h1>
      <Button>Get Started</Button>
    </div>
  );
}

export default App;
