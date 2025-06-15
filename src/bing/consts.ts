import { BingConversionAction } from "./interfaces";

 
export const generateBingCreateOfflineConversionXml = (token: string, customerAccountId: string, 
   customerId: string, developerToken: string, conversion: BingConversionAction) => `
 <s:Envelope xmlns:i="http://www.w3.org/2001/XMLSchema-instance" xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
   <s:Header xmlns="https://bingads.microsoft.com/CampaignManagement/v13">
    <Action mustUnderstand="1">UpdateConversionGoals</Action>
      <AuthenticationToken i:nil="false">${token}</AuthenticationToken>
      <CustomerAccountId i:nil="false">${customerAccountId}</CustomerAccountId>
      <CustomerId i:nil="false">${customerId}</CustomerId>
      <DeveloperToken i:nil="false">${developerToken}</DeveloperToken>
   </s:Header>
   <s:Body>
       <AddConversionGoalsRequest xmlns="https://bingads.microsoft.com/CampaignManagement/v13">
         <ConversionGoals i:nil="false">
            <ConversionGoal i:type="OfflineConversionGoal">
               <ConversionWindowInMinutes i:nil="false">129600</ConversionWindowInMinutes>
               <CountType i:nil="false">${conversion["Count Type"]}</CountType>
               <ExcludeFromBidding i:nil="false">true</ExcludeFromBidding>
               <GoalCategory i:nil="false">${conversion["Goal Category"]}</GoalCategory>
               <IsEnhancedConversionsEnabled i:nil="false">false</IsEnhancedConversionsEnabled>
               <Name i:nil="false">${conversion["Conversion Name Action"]}</Name>
               <Revenue i:nil="false">
                  <CurrencyCode i:nil="false">USD</CurrencyCode>
                  <Type i:nil="false">FixedValue</Type>
                  <Value i:nil="false">1.0</Value>
               </Revenue>
               <Scope i:nil="false">Account</Scope>
               <Status i:nil="false">Active</Status>
               <Type i:nil="false">OfflineConversion</Type>
               <!--This field is applicable if the derived type attribute is set to OfflineConversionGoal-->
               <IsExternallyAttributed i:nil="false">false</IsExternallyAttributed>
               <!--No additional fields are applicable if the derived type attribute is set to InStoreTransactionGoal-->
            </ConversionGoal>
         </ConversionGoals>
      </AddConversionGoalsRequest>
   </s:Body>
</s:Envelope>
`;







export const generateBingGetCampaignsByAccountIdXml = (token: string, customerAccountId: string, 
   customerId: string, developerToken: string ) => `
<s:Envelope xmlns:i="http://www.w3.org/2001/XMLSchema-instance" xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
  <s:Header xmlns="https://bingads.microsoft.com/CampaignManagement/v13">
    <Action mustUnderstand="1">GetCampaignsByAccountId</Action>
    <AuthenticationToken i:nil="false">${token}</AuthenticationToken>
    <CustomerAccountId i:nil="false">${customerAccountId}</CustomerAccountId>
    <CustomerId i:nil="false">${customerId}</CustomerId>
    <DeveloperToken i:nil="false">${developerToken}</DeveloperToken>
  </s:Header>
  <s:Body>
    <GetCampaignsByAccountIdRequest xmlns="https://bingads.microsoft.com/CampaignManagement/v13">
      <AccountId>${customerAccountId}</AccountId>
      <CampaignType>Search</CampaignType>
    </GetCampaignsByAccountIdRequest>
  </s:Body>
</s:Envelope>`;

export const generateGetAdGroupsByCampaignIdXml = (
   token: string,
   customerAccountId: string,
   customerId: string,
   developerToken: string,
   campaignId: string // SINGLE ID ONLY
 ) => `
 <s:Envelope xmlns:i="http://www.w3.org/2001/XMLSchema-instance" xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
   <s:Header xmlns="https://bingads.microsoft.com/CampaignManagement/v13">
     <Action mustUnderstand="1">GetAdGroupsByCampaignId</Action>
     <AuthenticationToken i:nil="false">${token}</AuthenticationToken>
     <CustomerAccountId i:nil="false">${customerAccountId}</CustomerAccountId>
     <CustomerId i:nil="false">${customerId}</CustomerId>
     <DeveloperToken i:nil="false">${developerToken}</DeveloperToken>
   </s:Header>
   <s:Body>
     <GetAdGroupsByCampaignIdRequest xmlns="https://bingads.microsoft.com/CampaignManagement/v13">
       <CampaignId>${campaignId}</CampaignId>
     </GetAdGroupsByCampaignIdRequest>
   </s:Body>
 </s:Envelope>`;

  
 export const generateGetAdsByAdGroupIdsXml = (
   token: string,
   customerAccountId: string,
   customerId: string,
   developerToken: string,
   adGroupId: string
 ) => `
 <s:Envelope xmlns:i="http://www.w3.org/2001/XMLSchema-instance" xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
   <s:Header xmlns="https://bingads.microsoft.com/CampaignManagement/v13">
     <Action mustUnderstand="1">GetAdsByAdGroupId</Action>
     <AuthenticationToken i:nil="false">${token}</AuthenticationToken>
     <CustomerAccountId i:nil="false">${customerAccountId}</CustomerAccountId>
     <CustomerId i:nil="false">${customerId}</CustomerId>
     <DeveloperToken i:nil="false">${developerToken}</DeveloperToken>
   </s:Header>
   <s:Body>
     <GetAdsByAdGroupIdRequest xmlns="https://bingads.microsoft.com/CampaignManagement/v13">
       <AdGroupId>${adGroupId}</AdGroupId>
       <AdTypes xmlns:a1="https://bingads.microsoft.com/CampaignManagement/v13">
         <a1:AdType>AppInstall</a1:AdType>
         <a1:AdType>DynamicSearch</a1:AdType>
         <a1:AdType>ExpandedText</a1:AdType>
         <a1:AdType>Hotel</a1:AdType>
         <a1:AdType>Image</a1:AdType>
         <a1:AdType>Product</a1:AdType>
         <a1:AdType>ResponsiveAd</a1:AdType>
         <a1:AdType>ResponsiveSearch</a1:AdType>
         <a1:AdType>Text</a1:AdType>
       </AdTypes>
     </GetAdsByAdGroupIdRequest>
   </s:Body>
 </s:Envelope>`;