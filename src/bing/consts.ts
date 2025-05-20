export const generateBingCreateOfflineConversionXml = (token: string, customerAccountId: string, customerId: string, developerToken: string, conversionName: string) => `
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
               <CountType i:nil="false">Unique</CountType>
               <ExcludeFromBidding i:nil="false">true</ExcludeFromBidding>
               <GoalCategory i:nil="false">OutboundClick</GoalCategory>
               <IsEnhancedConversionsEnabled i:nil="false">false</IsEnhancedConversionsEnabled>
               <Name i:nil="false">${conversionName}</Name>
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
