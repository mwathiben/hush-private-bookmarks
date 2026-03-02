import { Button } from '@/components/ui/button';

function ThrowOnMount(): never {
  throw new Error('Intentional test error');
}

function App() {
  const params = new URLSearchParams(window.location.search);
  const shouldThrow = params.get('__test_throw') === '1';

  return (
    <div className="flex min-h-[400px] w-[350px] flex-col items-center justify-center gap-4 bg-background p-6 text-foreground">
      <h1 className="text-xl font-semibold">Hush</h1>
      <Button>Get Started</Button>
      {shouldThrow && <ThrowOnMount />}
    </div>
  );
}

export default App;
