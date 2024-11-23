import generate_report from './functions/generate_report';

export const functionFactory = {
  // Add your functions here
  generate_report,
} as const;

export type FunctionFactoryType = keyof typeof functionFactory;
