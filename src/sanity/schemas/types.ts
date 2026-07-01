export interface ValidationRule {
  required: () => ValidationRule;
  min: (value: number) => ValidationRule;
  email: () => ValidationRule;
}
