// ==============================================================================
// Test Infrastructure Workload (deploy_test_workload.bicep)
// Deploys interdependent resources: VNet, Subnet, NSG, Public IP, NIC, and VM.
// ==============================================================================
targetScope = 'resourceGroup'

@description('Deployment location')
param location string = resourceGroup().location

@description('Admin username for the VM')
param adminUsername string = 'azureuser'

@description('Admin password for the VM')
@secure()
param adminPassword string

@description('VM Size SKU')
param vmSize string = 'Standard_B2s'

@description('Governance tags')
param tags object = {
  Environment: 'Prod'
  CostCenter: '1000'
  Workload: 'CoreInfra'
  Owner: 'cloudops@contoso.com'
  Application: 'TestWorkload'
}

// 1. Network Security Group with restricted access
resource nsg 'Microsoft.Network/networkSecurityGroups@2023-09-01' = {
  name: 'contoso-con-cc-core-nsg'
  location: location
  tags: tags
  properties: {
    securityRules: [
      {
        name: 'Allow-SSH-Restricted'
        properties: {
          priority: 1000
          protocol: 'Tcp'
          access: 'Allow'
          direction: 'Inbound'
          sourceAddressPrefix: '10.0.0.0/8'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '22'
        }
      }
    ]
  }
}

// 2. Virtual Network & Subnet associated with NSG
resource vnet 'Microsoft.Network/virtualNetworks@2023-09-01' = {
  name: 'contoso-con-cc-core-vnet'
  location: location
  tags: tags
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
          networkSecurityGroup: {
            id: nsg.id
          }
        }
      }
    ]
  }
}

var subnetRef = resourceId('Microsoft.Network/virtualNetworks/subnets', 'contoso-con-cc-core-vnet', 'snet-core')

// 3. Public IP Address
resource pip 'Microsoft.Network/publicIPAddresses@2023-09-01' = {
  name: 'contoso-con-cc-core-pip'
  location: location
  tags: tags
  sku: {
    name: 'Standard'
  }
  properties: {
    publicIPAllocationMethod: 'Static'
  }
}

// 4. Network Interface Card referencing Subnet, PIP, and NSG
resource nic 'Microsoft.Network/networkInterfaces@2023-09-01' = {
  name: 'contoso-con-cc-dc01-nic'
  location: location
  tags: tags
  properties: {
    networkSecurityGroup: {
      id: nsg.id
    }
    ipConfigurations: [
      {
        name: 'ipconfig1'
        properties: {
          privateIPAllocationMethod: 'Dynamic'
          subnet: {
            id: subnetRef
          }
          publicIPAddress: {
            id: pip.id
          }
        }
      }
    ]
  }
  dependsOn: [
    vnet
  ]
}

// 5. Virtual Machine attached to NIC
resource vm 'Microsoft.Compute/virtualMachines@2023-09-01' = {
  name: 'contoso-con-cc-dc01-vm'
  location: location
  tags: tags
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

output vnetId string = vnet.id
output nsgId string = nsg.id
output pipId string = pip.id
output nicId string = nic.id
output vmId string = vm.id
output osDiskName string = 'contoso-con-cc-dc01-osdisk'
