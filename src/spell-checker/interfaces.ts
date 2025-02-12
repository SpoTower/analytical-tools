export interface websiteText{
    domain:number,
    fullPath:string,
    innerHtml:string
}

export interface gptProposal{
    domain:number,
    path:string,
    errors:string
    jsonErrors?:any
}