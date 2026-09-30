targetScope = 'subscription'

@minLength(1)
@maxLength(24)
param environmentName string

param location string

param serviceName string = 'web'

var resourceToken = uniqueString(subscription().id, location, environmentName)
var regionIndex = '1'
var tags = {
  'azd-env-name': environmentName
  application: 'number-origin-desk'
}

resource resourceGroup 'Microsoft.Resources/resourceGroups@2024-11-01' = {
  name: 'azrg${resourceToken}${regionIndex}'
  location: location
  tags: tags
}

module resources './modules/resources.bicep' = {
  name: 'number-origin-desk-resources'
  scope: resourceGroup
  params: {
    name: environmentName
    location: location
    serviceName: serviceName
    tags: tags
  }
}

output AZURE_RESOURCE_GROUP string = resourceGroup.name
output AZURE_LOCATION string = location
output AZURE_LOG_ANALYTICS_WORKSPACE_ID string = resources.outputs.logAnalyticsWorkspaceId
output WEB_URL string = resources.outputs.webUrl
