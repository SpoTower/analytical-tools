import dayjs from "dayjs";
import { QUERY_DATE_FORMAT } from "src/utils.ts/consts";

export class AbTestManagement {
        
    title!: string; // Extracted from tracker_events.event_value.title in JSON
    
    description?: string; // Extracted from tracker_events.event_value.description in JSON
    
    domainId?: number; // Extracted from tracker_events.domain_id
    
    controlGroup?: string; // Extracted from tracker_events.event_value.group = 'Control' -> path
    
    variantGroup?: string; // Extracted from tracker_events.event_value.group = 'Variant' -> lineup

    createdAt?: string; // From tracker_events.created_at
    
    updatedAt?: string; // Same as createdAt, updated on update
    
    type!: string; // From tracker_events.event_name
    
    hostname?: string; // From tracker_events.hostname

    parentPath?: string; 
    // If type = 'partner' -> tracker_events.path_id
    // If type = 'page' -> tracker_events.event_value.userSawPath


  constructor({
    title,
    description,
    domainId,
    controlGroup,
    variantGroup,
    type,
    parentPath,
    hostname,
  }: {
    title: string;
    description?: string;
    domainId: number;
    controlGroup: string;
    variantGroup: string;
    type: string;
    parentPath: string;
    hostname?: string;
  }) {
    this.title = title;
    this.description = description;
    this.domainId = domainId;
    this.controlGroup = controlGroup;
    this.variantGroup = variantGroup;
    this.type = type;
    this.parentPath = parentPath;
    this.hostname = hostname;
    this.createdAt = dayjs.utc().format(QUERY_DATE_FORMAT);
    this.updatedAt =  dayjs.utc().format(QUERY_DATE_FORMAT);
  }
}




