export interface PromptUpdate {
    key: string;
    value: string;
  }
  
  export class UpdatePromptsDto {
    prompts: PromptUpdate[];
  }