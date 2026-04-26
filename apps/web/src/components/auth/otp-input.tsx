'use client';

import { useEffect, useMemo, useRef } from 'react';
import { cn } from '@/lib/utils';

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  disabled?: boolean;
  error?: boolean;
}

export function OtpInput({
  value,
  onChange,
  length = 6,
  disabled = false,
  error = false,
}: OtpInputProps) {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = useMemo(() => {
    const sanitized = value.replace(/\D/g, '').slice(0, length);
    return Array.from({ length }, (_, index) => sanitized[index] ?? '');
  }, [length, value]);

  useEffect(() => {
    inputRefs.current = inputRefs.current.slice(0, length);
  }, [length]);

  const focusInput = (index: number) => {
    inputRefs.current[index]?.focus();
    inputRefs.current[index]?.select();
  };

  const updateDigits = (nextDigits: string[], focusIndex?: number) => {
    onChange(nextDigits.join(''));
    if (typeof focusIndex === 'number') {
      requestAnimationFrame(() => focusInput(focusIndex));
    }
  };

  const handleChange = (index: number, nextValue: string) => {
    const sanitized = nextValue.replace(/\D/g, '');

    if (!sanitized) {
      const nextDigits = [...digits];
      nextDigits[index] = '';
      updateDigits(nextDigits);
      return;
    }

    if (sanitized.length > 1) {
      const nextDigits = [...digits];
      sanitized
        .slice(0, length)
        .split('')
        .forEach((digit, offset) => {
          const targetIndex = index + offset;
          if (targetIndex < length) {
            nextDigits[targetIndex] = digit;
          }
        });

      const nextFocus = Math.min(index + sanitized.length, length - 1);
      updateDigits(nextDigits, nextFocus);
      return;
    }

    const nextDigits = [...digits];
    nextDigits[index] = sanitized;
    updateDigits(nextDigits, index < length - 1 ? index + 1 : index);
  };

  const handleKeyDown = (
    index: number,
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      event.preventDefault();
      const nextDigits = [...digits];
      nextDigits[index - 1] = '';
      updateDigits(nextDigits, index - 1);
      return;
    }

    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      focusInput(index - 1);
    }

    if (event.key === 'ArrowRight' && index < length - 1) {
      event.preventDefault();
      focusInput(index + 1);
    }
  };

  const handlePaste = (
    event: React.ClipboardEvent<HTMLInputElement>,
  ) => {
    event.preventDefault();
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);

    if (!pasted) {
      return;
    }

    const nextDigits = Array.from({ length }, (_, index) => pasted[index] ?? '');
    updateDigits(nextDigits, Math.min(pasted.length, length) - 1);
  };

  return (
    <div className="flex gap-2 sm:gap-3">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(element) => {
            inputRefs.current[index] = element;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          value={digit}
          disabled={disabled}
          onChange={(event) => handleChange(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={handlePaste}
          className={cn(
            'h-14 w-12 rounded-2xl border text-center text-lg font-semibold outline-none transition sm:h-16 sm:w-14',
            'focus:border-[#0D1B3E] focus:ring-2 focus:ring-[#0D1B3E]/15',
            disabled && 'cursor-not-allowed bg-slate-100 text-slate-400',
            error
              ? 'border-red-300 bg-red-50 text-red-700'
              : 'border-slate-200 bg-white text-slate-900',
          )}
          aria-label={`OTP digit ${index + 1}`}
        />
      ))}
    </div>
  );
}
