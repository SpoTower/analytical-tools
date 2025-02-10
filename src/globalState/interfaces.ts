import { Company } from "src/kidonInterfaces/shared";
import { Domain } from "src/kidonInterfaces/shared";
import { Paths } from "src/kidonInterfaces/shared";

export interface State{
    allTokens: any[];
    companies: Company[];
    domains: Domain[];
    paths: Paths[];
    gptKey: string;
  }