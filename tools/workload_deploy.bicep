// ==============================================================================
// Workload Deployment Bicep Template (workload_deploy.bicep)
// Live test deployment matching the ALZ Policy Studio topology and tag contract.
// Scope: Resource Group (contoso-con-cc-core-rg)
// ==============================================================================
targetScope = 'resourceGroup'

@description('Deployment region')
param location string = 'canadacentral'

@description('Admin username for the VM')
param adminUsername string = 'azureuser'

@description('Admin password for the VM')
@secure()
param adminPassword string

@description('VM Size SKU')
param vmSize string = 'Standard_B2s'

@description('Whether to deploy VM resource or validate naming/NIC')
param deployVm bool = true

@description('Inherited baseline tags from the Resource Group')
param inheritedTags object = {
  Environment: 'Prod'
  CostCenter: '1000'
  Workload: 'CoreInfra'
  Owner: 'cloudops@contoso.com'
}

@description('Resource-level governance tags')
param resourceTags object = {
  Application: 'ActiveDirectory'
  DataClassification: 'Internal'
}

@description('Tags outside policy boundary')
param outsideTags object = {
  DeployedBy: 'ALZ-Policy-Studio'
  ComplianceVerified: 'True'
}

var combinedResourceTags = union(inheritedTags, resourceTags, outsideTags)

// ------------------------------------------------------------------------------
// 1. Virtual Network & Subnet with Service Endpoint
// ------------------------------------------------------------------------------
resource vnet 'Microsoft.Network/virtualNetworks@2023-09-01' = {
  name: 'contoso-con-cc-core-vnet'
  location: location
  tags: combinedResourceTags
  properties: {
    addressSpace: {
      addressPrefixes: [
        '10.200.0.0/16'
      ]
    }
    subnets: [
      {
        name: 'snet-core'
        properties: {
          addressPrefix: '10.200.1.0/24'
          serviceEndpoints: [
            {
              service: 'Microsoft.Storage'
              locations: [
                location
              ]
            }
          ]
        }
      }
    ]
  }
}

// Subnet reference helper
var subnetRef = resourceId('Microsoft.Network/virtualNetworks/subnets', 'contoso-con-cc-core-vnet', 'snet-core')

// ------------------------------------------------------------------------------
// 2. Storage Account with Private Network Restriction
// ------------------------------------------------------------------------------
resource storage 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: 'contosoconccfilessa'
  location: location
  tags: combinedResourceTags
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    allowBlobPublicAccess: false
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    networkAcls: {
      defaultAction: 'Deny'
      bypass: 'AzureServices'
      virtualNetworkRules: [
        {
          id: subnetRef
          action: 'Allow'
        }
      ]
    }
  }
  dependsOn: [
    vnet
  ]
}

// ------------------------------------------------------------------------------
// 3. Network Interface attached to Private Subnet (No Public IP)
// ------------------------------------------------------------------------------
resource nic 'Microsoft.Network/networkInterfaces@2023-09-01' = {
  name: 'contoso-con-cc-dc01-nic'
  location: location
  tags: combinedResourceTags
  properties: {
    ipConfigurations: [
      {
        name: 'ipconfig1'
        properties: {
          privateIPAllocationMethod: 'Dynamic'
          subnet: {
            id: subnetRef
          }
        }
      }
    ]
  }
  dependsOn: [
    vnet
  ]
}

// ------------------------------------------------------------------------------
// 4. Virtual Machine attached to Private NIC
// ------------------------------------------------------------------------------
resource vm 'Microsoft.Compute/virtualMachines@2023-09-01' = if (deployVm) {
  name: 'contoso-con-cc-dc01-vm'
  location: location
  tags: combinedResourceTags
  properties: {
    hardwareProfile: {
      vmSize: vmSize
    }
    storageProfile: {
      imageReference: {
        publisher: 'Canonical'
        offer: '0001-com-ubuntu-server-jammy'
        sku: '22_04-lts-gen2'
        version: 'latest'
      }
      osDisk: {
        name: 'contoso-con-cc-dc01-osdisk'
        createOption: 'FromImage'
        managedDisk: {
          storageAccountType: 'Standard_LRS'
        }
      }
    }
    osProfile: {
      computerName: 'dc01'
      adminUsername: adminUsername
      adminPassword: adminPassword
      linuxConfiguration: {
        disablePasswordAuthentication: false
      }
    }
    networkProfile: {
      networkInterfaces: [
        {
          id: nic.id
        }
      ]
    }
  }
}

// Outputs
output vnetName string = vnet.name
output storageAccountName string = storage.name
output nicName string = nic.name
output vmName string = deployVm ? vm.name : 'contoso-con-cc-dc01-vm'
