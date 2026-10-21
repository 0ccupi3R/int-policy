@description('Location')
param location string
@description('Unique suffix for storage accounts')
param suffix string

// Storage Account ($0.00 base, Standard_LRS, Hot)
resource storage 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: 'stshdops${suffix}'
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  tags: {
    Owner: 'admin@clientcorp.com'
  }
  properties: {
    accessTier: 'Hot'
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
  }
}

// Route Table (Untagged)
resource routeTable 'Microsoft.Network/routeTables@2023-09-01' = {
  name: 'RT-GLOBAL-INSPECT'
  location: location
  properties: {
    routes: []
  }
}
