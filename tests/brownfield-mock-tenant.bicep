targetScope = 'subscription'

@description('Deployment location for mock brownfield resources')
param location string = 'canadacentral'

@description('Random suffix for globally unique storage account names')
param suffix string = substring(uniqueString(subscription().id), 0, 6)

// ==============================================================================
// 1. RESOURCE GROUPS (Varying casing, conventions, and tag states)
// ==============================================================================

// RG 1: TitleCase / Hyphenated with standard tags
resource rg1 'Microsoft.Resources/resourceGroups@2021-04-01' = {
  name: 'RG-CoreApp-Prod'
  location: location
  tags: {
    Environment: 'Production'
    Owner: 'alice@clientcorp.com'
    CostCenter: 'CC-1010'
  }
}

// RG 2: snake_case with department & billing tags (missing standard CAF tags)
resource rg2 'Microsoft.Resources/resourceGroups@2021-04-01' = {
  name: 'rg_marketing_legacy_dev'
  location: location
  tags: {
    dept: 'Marketing'
    billing_id: 'MKT-88'
  }
}

// RG 3: ALL UPPERCASE with ZERO tags
resource rg3 'Microsoft.Resources/resourceGroups@2021-04-01' = {
  name: 'SANDBOX-SHARED-SVCS'
  location: location
}

// ==============================================================================
// 2. RESOURCE MODULES (Deployed inside respective Resource Groups)
// ==============================================================================

module rg1Resources 'brownfield-rg1.bicep' = {
  name: 'rg1-resources-deploy'
  scope: rg1
  params: {
    location: location
    suffix: suffix
  }
}

module rg2Resources 'brownfield-rg2.bicep' = {
  name: 'rg2-resources-deploy'
  scope: rg2
  params: {
    location: location
    suffix: suffix
  }
}

module rg3Resources 'brownfield-rg3.bicep' = {
  name: 'rg3-resources-deploy'
  scope: rg3
  params: {
    location: location
    suffix: suffix
  }
}

output rg1Name string = rg1.name
output rg2Name string = rg2.name
output rg3Name string = rg3.name
