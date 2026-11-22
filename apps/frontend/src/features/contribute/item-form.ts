import type { CreateItemRequest, ItemKind, ValidationIssue } from '../../lib/api';

/** Field lengths of the gateway's CreateItemRequest, as the Content service checks them. */
export const ITEM_LIMITS = {
  title: 160,
  description: 8000,
  creatorName: 160,
  creatorCommunity: 160,
  technique: 160,
  origin: 160,
  period: 80,
  rightsStatement: 2000,
} as const;

export type ItemFormField = keyof typeof ITEM_LIMITS | 'kind' | 'rightsConfirmed';

export interface ItemFormValues {
  title: string;
  kind: ItemKind | '';
  description: string;
  creatorName: string;
  creatorCommunity: string;
  technique: string;
  origin: string;
  period: string;
  rightsStatement: string;
  rightsConfirmed: boolean;
}

export const EMPTY_ITEM_FORM: ItemFormValues = {
  title: '',
  kind: '',
  description: '',
  creatorName: '',
  creatorCommunity: '',
  technique: '',
  origin: '',
  period: '',
  rightsStatement: '',
  rightsConfirmed: false,
};

export type ItemFormErrors = Partial<Record<ItemFormField, string>>;

const REQUIRED_MESSAGE: Partial<Record<ItemFormField, string>> = {
  title: 'Indiquez le titre de l’œuvre.',
  description: 'Décrivez l’œuvre.',
  rightsStatement: 'Indiquez les droits sur l’œuvre et ses médias.',
};

/** Client-side checks matching the service; the service checks again. */
export function validateItemForm(values: ItemFormValues): ItemFormErrors {
  const errors: ItemFormErrors = {};
  for (const [field, message] of Object.entries(REQUIRED_MESSAGE)) {
    const value = values[field as keyof ItemFormValues];
    if (typeof value === 'string' && value.trim() === '') {
      errors[field as ItemFormField] = message;
    }
  }
  if (values.kind === '') errors.kind = 'Choisissez le type d’œuvre.';
  for (const [field, max] of Object.entries(ITEM_LIMITS)) {
    const value = values[field as keyof typeof ITEM_LIMITS];
    if (value.trim().length > max) {
      errors[field as ItemFormField] = `${String(max)} caractères au maximum.`;
    }
  }
  if (!values.rightsConfirmed) {
    errors.rightsConfirmed =
      'Confirmez que vous détenez le droit de publier cette œuvre et ses médias.';
  }
  return errors;
}

export function toCreateRequest(values: ItemFormValues): CreateItemRequest {
  if (values.kind === '') throw new Error('kind is required');
  const optional = (value: string) => (value.trim() === '' ? null : value.trim());
  return {
    title: values.title.trim(),
    kind: values.kind,
    description: values.description.trim(),
    creatorName: optional(values.creatorName),
    creatorCommunity: optional(values.creatorCommunity),
    technique: optional(values.technique),
    origin: optional(values.origin),
    period: optional(values.period),
    rightsStatement: values.rightsStatement.trim(),
    rightsConfirmed: values.rightsConfirmed,
  };
}

const FIELDS = new Set<string>([...Object.keys(ITEM_LIMITS), 'kind', 'rightsConfirmed']);

/** Maps the service's validation details onto the form fields. */
export function serverFieldErrors(details: readonly ValidationIssue[]): ItemFormErrors {
  const errors: ItemFormErrors = {};
  for (const issue of details) {
    if (FIELDS.has(issue.field)) {
      errors[issue.field as ItemFormField] = `Refusé par le serveur : ${issue.reason}.`;
    }
  }
  return errors;
}
