import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Inputs stacked in one rounded glass group with hairline dividers, like iOS forms.
export function FieldGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="glass divide-y divide-glass-divider overflow-hidden rounded-xl border border-glass-border bg-glass-strong text-left focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/20">
      {children}
    </div>
  );
}

type GroupedInputProps = React.ComponentProps<typeof Input> & {
  label: string;
  name: string;
  error?: string;
};

export function GroupedInput({ label, name, error, ...input }: GroupedInputProps) {
  return (
    // One wrapper per row so the group's dividers fall between rows, and the error sits in its own row
    <div>
      <Label htmlFor={name} className="sr-only">
        {label}
      </Label>
      <Input
        id={name}
        name={name}
        placeholder={label}
        aria-invalid={!!error || undefined}
        aria-describedby={error ? `${name}-error` : undefined}
        // Autofill and password-manager extensions restyle these inputs before React hydrates
        suppressHydrationWarning
        className="h-12 rounded-none border-0 bg-transparent px-4 text-[17px] shadow-none focus-visible:ring-0 aria-invalid:ring-0 md:text-[17px] dark:bg-transparent"
        {...input}
      />
      {error && (
        <p id={`${name}-error`} className="-mt-1.5 px-4 pb-2.5 text-[13px] text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
