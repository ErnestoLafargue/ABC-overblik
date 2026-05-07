import { forwardRef } from 'react';
import { formatThousands, parseDigits } from '../lib/format';

type Props = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type' | 'inputMode'
> & {
  /** Raw digit-string (fx "30000"). Tom streng = tomt felt. */
  value: string;
  /** Kaldes med raw digits ("30000"), ikke formatteret. */
  onChange: (raw: string) => void;
};

/**
 * Number-input til DKK-bel\u00f8b der viser tusinde-separator (".") i
 * displayet, men bevarer raw digits i parent-state.
 *
 * - type="text" + inputMode="numeric" giver numerisk tastatur p\u00e5 mobil
 *   uden at miste mulighed for at vise "."
 * - Stripper alt non-digit ved input s\u00e5 brugeren ikke kan skrive
 *   bogstaver eller flere "." selv
 */
export const NumberInput = forwardRef<HTMLInputElement, Props>(
  function NumberInput({ value, onChange, ...rest }, ref) {
    return (
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={formatThousands(value)}
        onChange={(e) => onChange(parseDigits(e.target.value))}
        {...rest}
      />
    );
  },
);
