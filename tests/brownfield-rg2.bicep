@description('Location')
param location string
@description('Unique suffix for storage accounts')
param suffix string

// VNet with subnets
resource vnet 'Microsoft.Network/virtualNetworks@2023-09-01' = {
  name: 'vnet_mkt_dev'
  location: location
  tags: {
    dept: 'Marketing'
  }
  properties: {
    addressSpace: {
      addressPrefixes: [
        '10.200.0.0/16'
      ]
    }
    subnets: [
      {
        name: 'snet_web'
        properties: {
          addressPrefix: '10.200.1.0/24'
        }
      }
    ]
  }
}

// NSG (Untagged)
resource nsg 'Microsoft.Network/networkSecurityGroups@2023-09-01' = {
  name: 'nsg_mkt_dev_web'
  location: location
  properties: {
    securityRules: []
  }
}

// Storage Account ($0.00 base, Standard_LRS, Hot)
resource storage 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: 'stmktcamp${suffix}'
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  tags: {
    dept: 'Marketing'
    temporary: 'true'
  }
  properties: {
    accessTier: 'Hot'
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
  }
}
