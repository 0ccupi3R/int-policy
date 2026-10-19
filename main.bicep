targetScope = 'subscription'

@allowed(['Audit', 'Deny', 'Disabled'])
param effect string = 'Audit'

@allowed(['Audit', 'Deny', 'Disabled'])
param subnetEffect string = 'Audit'

@allowed(['Default', 'DoNotEnforce'])
param enforcementMode string = 'Default'

param notScopes array = []

resource namingDeployment 'Microsoft.Resources/deployments@2022-09-01' = {
  name: 'naming-policy-bundle-v2-1'
  location: deployment().location
  properties: {
    mode: 'Incremental'
    expressionEvaluationOptions: {
      scope: 'inner'
    }
    template: loadJsonContent('generated/main.json')
    parameters: {
      effect: { value: effect }
      subnetEffect: { value: subnetEffect }
      enforcementMode: { value: enforcementMode }
      notScopes: { value: notScopes }
    }
  }
}

output assignmentId string = namingDeployment.properties.outputs.assignmentId.value
