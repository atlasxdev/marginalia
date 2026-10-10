import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FieldError = { name: string; message?: string };

// Inputs stacked in one rounded group with hairline dividers, like iOS forms.
export function FieldGroup({ children, errors }: { children: React.ReactNode; errors: FieldError[] }) {
  const shown = errors.filter((e): e is Required<FieldError> => !!e.message);
  return (
    <div className="grid gap-2 text-left">
      <div className="divide-y overflow-hidden rounded-xl border bg-card focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/20">
        {children}
      </div>
      {shown.map((e) => (
        <p key={e.name} id={`${e.name}-error`} className="px-1 text-sm text-destructive">
          {e.message}
        </p>
      ))}
    </div>
  );
}

type GroupedInputProps = React.ComponentProps<typeof Input> & {
  label: string;
  name: string;
  invalid?: boolean;
};

export function GroupedInput({ label, name, invalid, ...input }: GroupedInputProps) {
  return (
    // One wrapper per row so the group's dividers fall between rows, not around the hidden label
    <div>
      <Label htmlFor={name} className="sr-only">
        {label}
      </Label>
      <Input
        id={name}
        name={name}
        placeholder={label}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? `${name}-error` : undefined}
        // Autofill and password-manager extensions restyle these inputs before React hydrates
        suppressHydrationWarning
        className="h-12 rounded-none border-0 bg-transparent px-4 text-[17px] shadow-none focus-visible:ring-0 aria-invalid:ring-0 md:text-[17px] dark:bg-transparent"
        {...input}
      />
    </div>
  );
}
