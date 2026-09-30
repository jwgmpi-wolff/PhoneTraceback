targetScope = 'resourceGroup'

@minLength(1)
param name string

param location string = resourceGroup().location

param serviceName string

param tags object = {}

var resourceToken = uniqueString(subscription().id, resourceGroup().id, location, name)
var regionIndex = '1'
var identityName = 'azid${resourceToken}${regionIndex}'
var workspaceName = 'azlaw${resourceToken}${regionIndex}'
var insightsName = 'azai${resourceToken}${regionIndex}'
var planName = 'azasp${resourceToken}${regionIndex}'
var appName = 'azapp${resourceToken}${regionIndex}'

resource managedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: identityName
  location: location
  tags: tags
}

resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: workspaceName
  location: location
  tags: tags
  properties: {
    features: {
      enableLogAccessUsingOnlyResourcePermissions: true
    }
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
    retentionInDays: 30
    sku: {
      name: 'PerGB2018'
    }
  }
}

resource applicationInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: insightsName
  location: location
  kind: 'web'
  tags: tags
  properties: {
    Application_Type: 'web'
    IngestionMode: 'LogAnalytics'
    WorkspaceResourceId: logAnalyticsWorkspace.id
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

resource appServicePlan 'Microsoft.Web/serverfarms@2024-11-01' = {
  name: planName
  location: location
  kind: 'linux'
  tags: tags
  sku: {
    name: 'B1'
    tier: 'Basic'
    capacity: 1
  }
  properties: {
    reserved: true
    zoneRedundant: false
  }
}

resource webApp 'Microsoft.Web/sites@2024-11-01' = {
  name: appName
  location: location
  kind: 'app,linux'
  tags: union(tags, {
    'azd-service-name': serviceName
  })
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${managedIdentity.id}': {}
    }
  }
  properties: {
    clientAffinityEnabled: false
    httpsOnly: true
    publicNetworkAccess: 'Enabled'
    serverFarmId: appServicePlan.id
    siteConfig: {
      alwaysOn: true
      appSettings: [
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: applicationInsights.properties.ConnectionString
        }
        {
          name: 'ApplicationInsightsAgent_EXTENSION_VERSION'
          value: '~3'
        }
        {
          name: 'SCM_DO_BUILD_DURING_DEPLOYMENT'
          value: 'true'
        }
      ]
      cors: {
        allowedOrigins: [
          'https://${appName}.azurewebsites.net'
        ]
        supportCredentials: false
      }
      detailedErrorLoggingEnabled: true
      ftpsState: 'Disabled'
      healthCheckPath: '/health'
      http20Enabled: true
      httpLoggingEnabled: true
      ipSecurityRestrictionsDefaultAction: 'Allow'
      linuxFxVersion: 'NODE|22-lts'
      minTlsVersion: '1.2'
      scmIpSecurityRestrictionsDefaultAction: 'Allow'
      scmMinTlsVersion: '1.2'
    }
  }
}

resource webAuth 'Microsoft.Web/sites/config@2024-11-01' = {
  parent: webApp
  name: 'authsettingsV2'
  properties: {
    globalValidation: {
      redirectToProvider: ''
      requireAuthentication: false
      unauthenticatedClientAction: 'AllowAnonymous'
    }
    platform: {
      enabled: false
      runtimeVersion: '~1'
    }
  }
}

resource webDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'azds${resourceToken}${regionIndex}'
  scope: webApp
  properties: {
    workspaceId: logAnalyticsWorkspace.id
    logs: [
      {
        category: 'AppServiceHTTPLogs'
        enabled: true
      }
      {
        category: 'AppServiceConsoleLogs'
        enabled: true
      }
    ]
    metrics: [
      {
        category: 'AllMetrics'
        enabled: true
      }
    ]
  }
}

output logAnalyticsWorkspaceId string = logAnalyticsWorkspace.id
output managedIdentityPrincipalId string = managedIdentity.properties.principalId
output webAppName string = webApp.name
output webUrl string = 'https://${webApp.properties.defaultHostName}'
