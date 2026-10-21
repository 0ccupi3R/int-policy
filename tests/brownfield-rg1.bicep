@description('Location')
param location string
@description('Unique suffix for storage accounts')
param suffix string

// VNet with subnets
resource vnet 'Microsoft.Network/virtualNetworks@2023-09-01' = {
  name: 'vnet-legacy-prod-core'
  location: location
  tags: {
    env: 'prod'
    CreatedBy: 'terraform'
  }
  properties: {
    addressSpace: {
      addressPrefixes: [
        '10.100.0.0/16'
      ]
    }
    subnets: [
      {
        name: 'subnet-app-01'
        properties: {
          addressPrefix: '10.100.1.0/24'
        }
      }
    ]
  }
}

// NSG
resource nsg 'Microsoft.Network/networkSecurityGroups@2023-09-01' = {
  name: 'nsg-prod-core-app'
  location: location
  tags: {
    CostCenter: 'CC-1010'
    SecurityTier: 'Strict'
  }
  properties: {
    securityRules: []
  }
}

// Storage Account ($0.00 base, Standard_LRS, Hot)
resource storage 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: 'stcoreappdata${suffix}'
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  tags: {
    Application: 'PaymentGateway'
    compliance: 'pci'
  }
  properties: {
    accessTier: 'Hot'
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
  }
}

// Route Table (Untagged)
resource routeTable 'Microsoft.Network/routeTables@2023-09-01' = {
  name: 'rt-legacy-core-egress'
  location: location
  properties: {
    routes: []
  }
}
