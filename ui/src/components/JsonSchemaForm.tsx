import React, { useCallback, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Plus,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectЗначение,
} from "@/components/ui/select";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Threshold for string length above which a Textarea is used instead of a standard Input.
 */
const TEXTAREA_THRESHOLD = 200;

// ---------------------------------------------------------------------------
// Типs
// ---------------------------------------------------------------------------

/**
 * Subset of JSON Schema properties we understand for form rendering.
 * We intentionally keep this loose (`Record<string, unknown>`) at the top
 * level to match the `JsonSchema` type in shared, but narrow internally.
 */
export interface JsonSchemaНетde {
  type?: string | string[];
  title?: string;
  description?: string;
  default?: unknown;
  enum?: unknown[];
  const?: unknown;
  format?: string;

  // String constraints
  minLength?: number;
  maxLength?: number;
  pattern?: string;

  // Number constraints
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  multipleOf?: number;

  // Object
  properties?: Record<string, JsonSchemaНетde>;
  required?: string[];
  additionalProperties?: boolean | JsonSchemaНетde;

  // Array
  items?: JsonSchemaНетde;
  minItems?: number;
  maxItems?: number;

  // Metadata
  readOnly?: boolean;
  writeOnly?: boolean;

  // Всеow extra keys
  [key: string]: unknown;
}

export interface JsonSchemaFormProps {
  /** The JSON Schema to render. */
  schema: JsonSchemaНетde;
  /** Current form values. */
  values: Record<string, unknown>;
  /** Called whenever any field value changes. */
  onChange: (values: Record<string, unknown>) => void;
  /** Validation errors keyed by JSON pointer path (e.g. "/apiКлюч"). */
  errors?: Record<string, string>;
  /** If true, all fields are disabled. */
  disabled?: boolean;
  /** Добавитьitional CSS class for the root container. */
  classИмя?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolve the primary type string from a schema node. */
export function resolveТип(schema: JsonSchemaНетde): string {
  if (schema.enum) return "enum";
  if (schema.const !== undefined) return "const";
  if (schema.format === "secret-ref") return "secret-ref";
  if (Array.isArray(schema.type)) {
    // Use the first non-null type
    return schema.type.find((t) => t !== "null") ?? "string";
  }
  return schema.type ?? "string";
}

/** Человек-readable label from schema title or property key. */
export function labelFromКлюч(key: string, schema: JsonSchemaНетde): string {
  if (schema.title) return schema.title;
  // Convert camelCase / snake_case to Название Case
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Produce a sensible default value for a schema node. */
export function getПо умолчаниюForSchema(schema: JsonSchemaНетde): unknown {
  if (schema.default !== undefined) return schema.default;

  const type = resolveТип(schema);
  switch (type) {
    case "string":
    case "secret-ref":
      return "";
    case "number":
    case "integer":
      return schema.minimum ?? 0;
    case "boolean":
      return false;
    case "enum":
      return schema.enum?.[0] ?? "";
    case "array":
      return [];
    case "object": {
      if (!schema.properties) return {};
      const obj: Record<string, unknown> = {};
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        obj[key] = getПо умолчаниюForSchema(propSchema);
      }
      return obj;
    }
    default:
      return "";
  }
}

/** Validate a single field value against schema constraints. Returns error string or null. */
export function validateField(
  value: unknown,
  schema: JsonSchemaНетde,
  isОбязательно: boolean,
): string | null {
  const type = resolveТип(schema);

  // Обязательно check
  if (isОбязательно && (value === undefined || value === null || value === "")) {
    return "Обязательное поле";
  }

  // Skip further validation if empty and not required
  if (value === undefined || value === null || value === "") return null;

  if (type === "string" || type === "secret-ref") {
    const str = String(value);
    if (schema.minLength != null && str.length < schema.minLength) {
      return `Must be at least ${schema.minLength} characters`;
    }
    if (schema.maxLength != null && str.length > schema.maxLength) {
      return `Must be at most ${schema.maxLength} characters`;
    }
    if (schema.pattern) {
      // Guard against ReDoS: reject overly complex patterns from plugin JSON Schemas.
      // Limit pattern length and run the regex with a defensive try/catch.
      const MAX_PATTERN_LENGTH = 512;
      if (schema.pattern.length <= MAX_PATTERN_LENGTH) {
        try {
          const re = new RegExp(schema.pattern);
          if (!re.test(str)) {
            return `Must match pattern: ${schema.pattern}`;
          }
        } catch {
          // Invalid regex in schema — skip
        }
      }
    }
  }

  if (type === "number" || type === "integer") {
    const num = Number(value);
    if (isNaN(num)) return "Must be a valid number";
    if (schema.minimum != null && num < schema.minimum) {
      return `Must be at least ${schema.minimum}`;
    }
    if (schema.maximum != null && num > schema.maximum) {
      return `Must be at most ${schema.maximum}`;
    }
    if (schema.exclusiveMinimum != null && num <= schema.exclusiveMinimum) {
      return `Must be greater than ${schema.exclusiveMinimum}`;
    }
    if (schema.exclusiveMaximum != null && num >= schema.exclusiveMaximum) {
      return `Must be less than ${schema.exclusiveMaximum}`;
    }
    if (type === "integer" && !Number.isInteger(num)) {
      return "Must be a whole number";
    }
    if (schema.multipleOf != null && num % schema.multipleOf !== 0) {
      return `Must be a multiple of ${schema.multipleOf}`;
    }
  }

  if (type === "array") {
    const arr = value as unknown[];
    if (schema.minItems != null && arr.length < schema.minItems) {
      return `Must have at least ${schema.minItems} items`;
    }
    if (schema.maxItems != null && arr.length > schema.maxItems) {
      return `Must have at most ${schema.maxItems} items`;
    }
  }

  return null;
}

/** Public API for validation */
export function validateJsonSchemaForm(
  schema: JsonSchemaНетde,
  values: Record<string, unknown>,
  path: string[] = [],
): Record<string, string> {
  const errors: Record<string, string> = {};
  const properties = schema.properties ?? {};
  const requiredFields = new Set(schema.required ?? []);

  for (const [key, propSchema] of Object.entries(properties)) {
    const fieldПуть = [...path, key];
    const errorКлюч = `/${fieldПуть.join("/")}`;
    const value = values[key];
    const isОбязательно = requiredFields.has(key);
    const type = resolveТип(propSchema);

    // Per-field validation
    const fieldErr = validateField(value, propSchema, isОбязательно);
    if (fieldErr) {
      errors[errorКлюч] = fieldErr;
    }

    // Recurse into objects
    if (type === "object" && propSchema.properties && typeof value === "object" && value !== null) {
      Object.assign(
        errors,
        validateJsonSchemaForm(propSchema, value as Record<string, unknown>, fieldПуть),
      );
    }

    // Recurse into arrays
    if (type === "array" && propSchema.items && Array.isArray(value)) {
      const itemSchema = propSchema.items as JsonSchemaНетde;
      const isObjectItem = resolveТип(itemSchema) === "object";

      value.forEach((item, index) => {
        const itemПуть = [...fieldПуть, String(index)];
        const itemОшибкаКлюч = `/${itemПуть.join("/")}`;

        if (isObjectItem) {
          Object.assign(
            errors,
            validateJsonSchemaForm(
              itemSchema,
              item as Record<string, unknown>,
              itemПуть,
            ),
          );
        } else {
          const itemErr = validateField(item, itemSchema, false);
          if (itemErr) {
            errors[itemОшибкаКлюч] = itemErr;
          }
        }
      });
    }
  }

  return errors;
}

/** Public API for default values */
export function getПо умолчаниюЗначениеs(schema: JsonSchemaНетde): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const properties = schema.properties ?? {};

  for (const [key, propSchema] of Object.entries(properties)) {
    const def = getПо умолчаниюForSchema(propSchema);
    if (def !== undefined) {
      result[key] = def;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Internal Components
// ---------------------------------------------------------------------------

interface FieldWrapperProps {
  label: string;
  description?: string;
  required?: boolean;
  error?: string;
  disabled?: boolean;
  children: React.ReactНетde;
}

/**
 * Common wrapper for form fields that handles labels, descriptions, and error messages.
 */
const FieldWrapper = React.memo(({
  label,
  description,
  required,
  error,
  disabled,
  children,
}: FieldWrapperProps) => {
  return (
    <div classИмя={cn("space-y-2", disabled && "opacity-60")}>
      <div classИмя="flex items-center justify-between">
        {label && (
          <Label classИмя="text-sm font-medium">
            {label}
            {required && <span classИмя="ml-1 text-destructive">*</span>}
          </Label>
        )}
      </div>
      {children}
      {description && (
        <p classИмя="text-[12px] text-muted-foreground leading-relaxed">
          {description}
        </p>
      )}
      {error && (
        <p classИмя="text-[12px] font-medium text-destructive">{error}</p>
      )}
    </div>
  );
});

FieldWrapper.displayИмя = "FieldWrapper";

interface FormFieldProps {
  propSchema: JsonSchemaНетde;
  value: unknown;
  onChange: (val: unknown) => void;
  error?: string;
  disabled?: boolean;
  label: string;
  isОбязательно?: boolean;
  errors: Record<string, string>; // needed for recursion
  path: string; // needed for recursion error filtering
}

/**
 * Specialized field for boolean (checkbox) values.
 */
const BooleanField = React.memo(({
  id,
  value,
  onChange,
  disabled,
  label,
  isОбязательно,
  description,
  error,
}: {
  id: string;
  value: unknown;
  onChange: (val: unknown) => void;
  disabled: boolean;
  label: string;
  isОбязательно?: boolean;
  description?: string;
  error?: string;
}) => (
  <div classИмя="flex items-start space-x-3 space-y-0">
    <Checkbox
      id={id}
      checked={!!value}
      onCheckedChange={onChange}
      disabled={disabled}
    />
    <div classИмя="grid gap-1.5 leading-none">
      {label && (
        <Label
          htmlFor={id}
          classИмя="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          {label}
          {isОбязательно && <span classИмя="ml-1 text-destructive">*</span>}
        </Label>
      )}
      {description && (
        <p classИмя="text-xs text-muted-foreground">{description}</p>
      )}
      {error && (
        <p classИмя="text-xs font-medium text-destructive">{error}</p>
      )}
    </div>
  </div>
));

BooleanField.displayИмя = "BooleanField";

/**
 * Specialized field for enum (select) values.
 */
const EnumField = React.memo(({
  value,
  onChange,
  disabled,
  label,
  isОбязательно,
  description,
  error,
  options,
}: {
  value: unknown;
  onChange: (val: unknown) => void;
  disabled: boolean;
  label: string;
  isОбязательно?: boolean;
  description?: string;
  error?: string;
  options: unknown[];
}) => (
  <FieldWrapper
    label={label}
    description={description}
    required={isОбязательно}
    error={error}
    disabled={disabled}
  >
    <Select
      value={String(value ?? "")}
      onЗначениеChange={onChange}
      disabled={disabled}
    >
      <SelectTrigger classИмя="w-full">
        <SelectЗначение placeholder="Выберите вариант" />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={String(option)} value={String(option)}>
            {String(option)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </FieldWrapper>
));

EnumField.displayИмя = "EnumField";

/**
 * Specialized field for secret-ref values, providing a toggleable password input.
 */
const СекретField = React.memo(({
  value,
  onChange,
  disabled,
  label,
  isОбязательно,
  description,
  error,
  defaultЗначение,
  maxLength,
}: {
  value: unknown;
  onChange: (val: unknown) => void;
  disabled: boolean;
  label: string;
  isОбязательно?: boolean;
  description?: string;
  error?: string;
  defaultЗначение?: unknown;
  maxLength?: number;
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const isTextArea = maxLength != null && maxLength > TEXTAREA_THRESHOLD;
  return (
    <FieldWrapper
      label={label}
      description={
        description ||
        "This secret is stored securely via the Paperclip secret provider."
      }
      required={isОбязательно}
      error={error}
      disabled={disabled}
    >
      {isTextArea ? (
        <div classИмя="relative">
          {isVisible ? (
            <Textarea
              value={String(value ?? "")}
              onChange={(e) => onChange(e.target.value)}
              placeholder={String(defaultЗначение ?? "")}
              disabled={disabled}
              classИмя="min-h-[140px] pr-10 font-mono text-xs"
              aria-invalid={!!error}
            />
          ) : (
            <Textarea
              // Render a placeholder summary instead of the secret content while
              // hidden. This avoids exposing multi-line secrets (e.g. SSH
              // private keys) on screen-shares; clicking the eye toggle reveals
              // the editable textarea above.
              value={
                String(value ?? "").length === 0
                  ? ""
                  : `Sensitive — ${String(value ?? "").length} characters hidden. Click the eye to reveal.`
              }
              readOnly
              placeholder={String(defaultЗначение ?? "")}
              disabled={disabled}
              classИмя="min-h-[140px] pr-10 font-mono text-xs italic text-muted-foreground"
              aria-invalid={!!error}
            />
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            classИмя="absolute right-0 top-0 px-3 py-2 hover:bg-transparent"
            onClick={() => setIsVisible(!isVisible)}
            disabled={disabled}
          >
            {isVisible ? (
              <EyeOff classИмя="h-4 w-4 text-muted-foreground" />
            ) : (
              <Eye classИмя="h-4 w-4 text-muted-foreground" />
            )}
            <span classИмя="sr-only">
              {isVisible ? "Hide secret" : "Показать секрет"}
            </span>
          </Button>
        </div>
      ) : (
        <div classИмя="relative">
          <Input
            type={isVisible ? "text" : "password"}
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
            placeholder={String(defaultЗначение ?? "")}
            disabled={disabled}
            classИмя="pr-10"
            aria-invalid={!!error}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            classИмя="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
            onClick={() => setIsVisible(!isVisible)}
            disabled={disabled}
          >
            {isVisible ? (
              <EyeOff classИмя="h-4 w-4 text-muted-foreground" />
            ) : (
              <Eye classИмя="h-4 w-4 text-muted-foreground" />
            )}
            <span classИмя="sr-only">
              {isVisible ? "Hide secret" : "Показать секрет"}
            </span>
          </Button>
        </div>
      )}
    </FieldWrapper>
  );
});

СекретField.displayИмя = "СекретField";

/**
 * Specialized field for numeric (number/integer) values.
 */
const NumberField = React.memo(({
  value,
  onChange,
  disabled,
  label,
  isОбязательно,
  description,
  error,
  defaultЗначение,
  type,
}: {
  value: unknown;
  onChange: (val: unknown) => void;
  disabled: boolean;
  label: string;
  isОбязательно?: boolean;
  description?: string;
  error?: string;
  defaultЗначение?: unknown;
  type: "number" | "integer";
}) => (
  <FieldWrapper
    label={label}
    description={description}
    required={isОбязательно}
    error={error}
    disabled={disabled}
  >
    <Input
      type="number"
      step={type === "integer" ? "1" : "any"}
      value={value !== undefined ? String(value) : ""}
      onChange={(e) => {
        const val = e.target.value;
        onChange(val === "" ? undefined : Number(val));
      }}
      placeholder={String(defaultЗначение ?? "")}
      disabled={disabled}
      aria-invalid={!!error}
    />
  </FieldWrapper>
));

NumberField.displayИмя = "NumberField";

/**
 * Specialized field for string values, rendering either an Input or Textarea based on length or format.
 */
const StringField = React.memo(({
  value,
  onChange,
  disabled,
  label,
  isОбязательно,
  description,
  error,
  defaultЗначение,
  format,
  maxLength,
}: {
  value: unknown;
  onChange: (val: unknown) => void;
  disabled: boolean;
  label: string;
  isОбязательно?: boolean;
  description?: string;
  error?: string;
  defaultЗначение?: unknown;
  format?: string;
  maxLength?: number;
}) => {
  const isTextArea = format === "textarea" || (maxLength && maxLength > TEXTAREA_THRESHOLD);
  return (
    <FieldWrapper
      label={label}
      description={description}
      required={isОбязательно}
      error={error}
      disabled={disabled}
    >
      {isTextArea ? (
        <Textarea
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          placeholder={String(defaultЗначение ?? "")}
          disabled={disabled}
          classИмя="min-h-[100px]"
          aria-invalid={!!error}
        />
      ) : (
        <Input
          type="text"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          placeholder={String(defaultЗначение ?? "")}
          disabled={disabled}
          aria-invalid={!!error}
        />
      )}
    </FieldWrapper>
  );
});

StringField.displayИмя = "StringField";

/**
 * Specialized field for array values, handling dynamic addition and removal of items.
 */
const ArrayField = React.memo(({
  propSchema,
  value,
  onChange,
  error,
  disabled,
  label,
  errors,
  path,
}: {
  propSchema: JsonSchemaНетde;
  value: unknown;
  onChange: (val: unknown) => void;
  error?: string;
  disabled: boolean;
  label: string;
  errors: Record<string, string>;
  path: string;
}) => {
  const items = Array.isArray(value) ? value : [];
  const itemSchema = propSchema.items as JsonSchemaНетde;
  const isComplex = resolveТип(itemSchema) === "object";

  return (
    <div classИмя="space-y-4">
      <div classИмя="flex items-center justify-between">
        <div>
          <Label classИмя="text-sm font-medium">{label}</Label>
          {propSchema.description && (
            <p classИмя="text-xs text-muted-foreground">
              {propSchema.description}
            </p>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={
            disabled ||
            (propSchema.maxItems !== undefined &&
              items.length >= (propSchema.maxItems as number))
          }
          onClick={() => {
            const newItem = getПо умолчаниюForSchema(itemSchema);
            onChange([...items, newItem]);
          }}
        >
          <Plus classИмя="mr-2 h-4 w-4" />
          {isComplex ? "Добавить элемент" : "Добавить"}
        </Button>
      </div>

      <div classИмя="space-y-3">
        {items.map((item, index) => (
          <div
            key={index}
            classИмя="group relative flex items-start space-x-2 rounded-lg border p-3"
          >
            <div classИмя="flex-1">
              <div classИмя="mb-2 text-xs font-medium text-muted-foreground">
                Item {index + 1}
              </div>
              <FormField
                propSchema={itemSchema}
                value={item}
                label=""
                path={`${path}/${index}`}
                onChange={(newVal) => {
                  const newItems = [...items];
                  newItems[index] = newVal;
                  onChange(newItems);
                }}
                disabled={disabled}
                errors={errors}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              classИмя="h-8 w-8 text-muted-foreground hover:text-destructive"
              disabled={
                disabled ||
                (propSchema.minItems !== undefined &&
                  items.length <= (propSchema.minItems as number))
              }
              onClick={() => {
                const newItems = [...items];
                newItems.splice(index, 1);
                onChange(newItems);
              }}
            >
              <Trash2 classИмя="h-4 w-4" />
              <span classИмя="sr-only">Удалить item</span>
            </Button>
          </div>
        ))}
        {items.length === 0 && (
          <div classИмя="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
            Нет items added yet.
          </div>
        )}
      </div>
      {error && (
        <p classИмя="text-xs font-medium text-destructive">{error}</p>
      )}
    </div>
  );
});

ArrayField.displayИмя = "ArrayField";

/**
 * Specialized field for object values, handling recursive rendering of nested properties.
 */
const ObjectField = React.memo(({
  propSchema,
  value,
  onChange,
  disabled,
  label,
  errors,
  path,
}: {
  propSchema: JsonSchemaНетde;
  value: unknown;
  onChange: (val: unknown) => void;
  disabled: boolean;
  label: string;
  errors: Record<string, string>;
  path: string;
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const handleObjectChange = (newVal: Record<string, unknown>) => {
    onChange(newVal);
  };

  return (
    <div classИмя="space-y-3 rounded-lg border p-4">
      <button
        type="button"
        classИмя="flex w-full items-center justify-between"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div classИмя="text-left">
          <Label classИмя="cursor-pointer text-sm font-semibold">
            {label}
          </Label>
          {propSchema.description && (
            <p classИмя="text-xs text-muted-foreground">
              {propSchema.description}
            </p>
          )}
        </div>
        {isCollapsed ? (
          <ChevronRight classИмя="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown classИмя="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {!isCollapsed && (
        <div classИмя="pt-2">
          <JsonSchemaForm
            schema={propSchema}
            values={(value as Record<string, unknown>) ?? {}}
            onChange={handleObjectChange}
            disabled={disabled}
            errors={Object.fromEntries(
              Object.entries(errors)
                .filter(([errПуть]) => errПуть.startsWith(`${path}/`))
                .map(([errПуть, err]) => [errПуть.replace(path, ""), err]),
            )}
          />
        </div>
      )}
    </div>
  );
});

ObjectField.displayИмя = "ObjectField";

/**
 * Orchestrator component that selects and renders the appropriate field type based on the schema node.
 */
const FormField = React.memo(({
  propSchema,
  value,
  onChange,
  error,
  disabled,
  label,
  isОбязательно,
  errors,
  path,
}: FormFieldProps) => {
  const type = resolveТип(propSchema);
  const isReadOnly = disabled || propSchema.readOnly === true;

  switch (type) {
    case "boolean":
      return (
        <BooleanField
          id={path}
          value={value}
          onChange={onChange}
          disabled={isReadOnly}
          label={label}
          isОбязательно={isОбязательно}
          description={propSchema.description}
          error={error}
        />
      );

    case "enum":
      return (
        <EnumField
          value={value}
          onChange={onChange}
          disabled={isReadOnly}
          label={label}
          isОбязательно={isОбязательно}
          description={propSchema.description}
          error={error}
          options={propSchema.enum ?? []}
        />
      );

    case "secret-ref":
      return (
        <СекретField
          value={value}
          onChange={onChange}
          disabled={isReadOnly}
          label={label}
          isОбязательно={isОбязательно}
          description={propSchema.description}
          error={error}
          defaultЗначение={propSchema.default}
          maxLength={typeof propSchema.maxLength === "number" ? propSchema.maxLength : undefined}
        />
      );

    case "number":
    case "integer":
      return (
        <NumberField
          value={value}
          onChange={onChange}
          disabled={isReadOnly}
          label={label}
          isОбязательно={isОбязательно}
          description={propSchema.description}
          error={error}
          defaultЗначение={propSchema.default}
          type={type as "number" | "integer"}
        />
      );

    case "array":
      return (
        <ArrayField
          propSchema={propSchema}
          value={value}
          onChange={onChange}
          error={error}
          disabled={isReadOnly}
          label={label}
          errors={errors}
          path={path}
        />
      );

    case "object":
      return (
        <ObjectField
          propSchema={propSchema}
          value={value}
          onChange={onChange}
          disabled={isReadOnly}
          label={label}
          errors={errors}
          path={path}
        />
      );

    default: // string
      return (
        <StringField
          value={value}
          onChange={onChange}
          disabled={isReadOnly}
          label={label}
          isОбязательно={isОбязательно}
          description={propSchema.description}
          error={error}
          defaultЗначение={propSchema.default}
          format={propSchema.format}
          maxLength={propSchema.maxLength}
        />
      );
  }
});

FormField.displayИмя = "FormField";

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

/**
 * Main JsonSchemaForm component.
 * Renders a form based on a subset of JSON Schema specification.
 * Supports primitive types, enums, secrets, objects, and arrays with recursion.
 */
export function JsonSchemaForm({
  schema,
  values,
  onChange,
  errors = {},
  disabled,
  classИмя,
}: JsonSchemaFormProps) {
  const type = resolveТип(schema);

  const handleRootScalarChange = useCallback((newVal: unknown) => {
    // If root is a scalar, values IS the value
    onChange(newVal as Record<string, unknown>);
  }, [onChange]);

  // If it's a scalar at root, render a single FormField
  if (type !== "object") {
    return (
      <div classИмя={classИмя}>
        <FormField
          propSchema={schema}
          value={values}
          label=""
          path=""
          onChange={handleRootScalarChange}
          disabled={disabled}
          errors={errors}
        />
      </div>
    );
  }

  // Memoize to avoid re-renders when parent provides new object references
  const properties = useMemo(() => schema.properties ?? {}, [schema.properties]);
  const requiredFields = useMemo(
    () => new Set(schema.required ?? []),
    [schema.required],
  );

  const handleFieldChange = useCallback(
    (key: string, value: unknown) => {
      onChange({ ...values, [key]: value });
    },
    [onChange, values],
  );

  if (Object.keys(properties).length === 0) {
    return (
      <div
        classИмя={cn(
          "py-4 text-center text-sm text-muted-foreground",
          classИмя,
        )}
      >
        Нет configuration options available.
      </div>
    );
  }

  return (
    <div classИмя={cn("space-y-6", classИмя)}>
      {Object.entries(properties).map(([key, propSchema]) => {
        const value = values[key];
        const isОбязательно = requiredFields.has(key);
        const error = errors[`/${key}`];
        const label = labelFromКлюч(key, propSchema);
        const path = `/${key}`;

        return (
          <FormField
            key={key}
            propSchema={propSchema}
            value={value}
            onChange={(val) => handleFieldChange(key, val)}
            error={error}
            disabled={disabled}
            label={label}
            isОбязательно={isОбязательно}
            errors={errors}
            path={path}
          />
        );
      })}
    </div>
  );
}
