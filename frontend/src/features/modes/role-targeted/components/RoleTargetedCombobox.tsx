import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown, type LucideIcon, X } from 'lucide-react';

const MAX_VISIBLE_OPTIONS = 8;

type RoleTargetedComboboxProps = {
  id: string;
  label: React.ReactNode;
  icon: LucideIcon;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  placeholder: string;
  required?: boolean;
  inputAutoComplete?: string;
  emptyHint?: string;
};

function filterOptions(options: readonly string[], query: string): string[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [...options];
  return options.filter((option) => option.toLowerCase().includes(normalized));
}

export function RoleTargetedCombobox({
  id,
  label,
  icon: Icon,
  value,
  onChange,
  options,
  placeholder,
  required = false,
  inputAutoComplete,
  emptyHint = 'Type to search or enter a custom value',
}: RoleTargetedComboboxProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const filteredOptions = useMemo(() => filterOptions(options, value), [options, value]);
  const showCustomRow = value.trim().length > 0 && !filteredOptions.includes(value.trim());
  const listItems = useMemo(() => {
    if (showCustomRow) {
      return [{ type: 'custom' as const, label: value.trim() }, ...filteredOptions.map((o) => ({ type: 'option' as const, label: o }))];
    }
    return filteredOptions.map((o) => ({ type: 'option' as const, label: o }));
  }, [filteredOptions, showCustomRow, value]);

  const closeMenu = useCallback(() => {
    setOpen(false);
    setActiveIndex(-1);
  }, []);

  const openMenu = useCallback(() => {
    setOpen(true);
    setActiveIndex(-1);
  }, []);

  const selectValue = useCallback(
    (next: string) => {
      onChange(next);
      closeMenu();
      inputRef.current?.focus();
    },
    [closeMenu, onChange],
  );

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        closeMenu();
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [closeMenu, open]);

  useEffect(() => {
    setActiveIndex(-1);
  }, [value, open]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      closeMenu();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!open) openMenu();
      setActiveIndex((prev) => Math.min(prev + 1, listItems.length - 1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) openMenu();
      setActiveIndex((prev) => (prev <= 0 ? listItems.length - 1 : prev - 1));
      return;
    }
    if (event.key === 'Enter' && open && activeIndex >= 0 && listItems[activeIndex]) {
      event.preventDefault();
      selectValue(listItems[activeIndex].label);
      return;
    }
    if (event.key === 'Tab') {
      closeMenu();
    }
  };

  const activeOptionId =
    activeIndex >= 0 && listItems[activeIndex] ? `${listId}-option-${activeIndex}` : undefined;

  return (
    <div ref={rootRef} className="role-targeted-combobox flex flex-col gap-2">
      <span className="type-label-sm uppercase tracking-[0.12em] text-[var(--color-on-surface-variant)]">
        {label}
      </span>
      <div
        className={`role-targeted-combobox__control ${open ? 'role-targeted-combobox__control--open' : ''}`}
      >
        <Icon
          className="role-targeted-combobox__icon pointer-events-none"
          aria-hidden
        />
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeOptionId}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            openMenu();
          }}
          onFocus={openMenu}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          required={required}
          aria-required={required || undefined}
          autoComplete={inputAutoComplete}
          className="role-targeted-combobox__input"
        />
        {value ? (
          <button
            type="button"
            className="role-targeted-combobox__clear"
            onClick={() => {
              onChange('');
              openMenu();
              inputRef.current?.focus();
            }}
            aria-label="Clear"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        ) : null}
        <button
          type="button"
          className="role-targeted-combobox__toggle"
          aria-label={open ? 'Close suggestions' : 'Show suggestions'}
          aria-expanded={open}
          onClick={() => {
            if (open) {
              closeMenu();
            } else {
              openMenu();
              inputRef.current?.focus();
            }
          }}
        >
          <ChevronDown
            className={`h-4 w-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </button>

        {open ? (
          <ul
            id={listId}
            role="listbox"
            className="role-targeted-combobox__menu textarea-scroll"
            aria-label={`${typeof label === 'string' ? label : 'Field'} suggestions`}
          >
            <li className="role-targeted-combobox__menu-hint" aria-hidden>
              {value.trim()
                ? `${filteredOptions.length} match${filteredOptions.length === 1 ? '' : 'es'}`
                : emptyHint}
            </li>
            {listItems.length === 0 ? (
              <li className="role-targeted-combobox__empty" role="presentation">
                No presets match — your text will be used as-is
              </li>
            ) : (
              listItems.slice(0, MAX_VISIBLE_OPTIONS).map((item, index) => {
                const isActive = index === activeIndex;
                const optionId = `${listId}-option-${index}`;
                return (
                  <li key={`${item.type}-${item.label}`} role="presentation">
                    <button
                      type="button"
                      id={optionId}
                      role="option"
                      aria-selected={isActive}
                      className={`role-targeted-combobox__option ${
                        isActive ? 'role-targeted-combobox__option--active' : ''
                      } ${item.type === 'custom' ? 'role-targeted-combobox__option--custom' : ''}`}
                      onMouseEnter={() => setActiveIndex(index)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => selectValue(item.label)}
                    >
                      {item.type === 'custom' ? (
                        <>
                          <span className="role-targeted-combobox__option-prefix">Use</span>
                          <span className="role-targeted-combobox__option-value">{item.label}</span>
                        </>
                      ) : (
                        item.label
                      )}
                    </button>
                  </li>
                );
              })
            )}
            {listItems.length > MAX_VISIBLE_OPTIONS ? (
              <li className="role-targeted-combobox__more" role="presentation">
                {listItems.length - MAX_VISIBLE_OPTIONS} more — keep typing to narrow
              </li>
            ) : null}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
