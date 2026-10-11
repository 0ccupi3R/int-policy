targetScope = 'subscription'
@allowed(['Audit', 'Deny', 'Disabled'])
param effect string = 'Audit'
@allowed(['Default', 'DoNotEnforce'])
param enforcementMode string = 'Default'
param notScopes array = []

// Generated ARM is also directly deployable without a Bicep compiler.
resource namingDeployment 'Microsoft.Resources/deployments@2022-09-01' = {
  name: 'naming-policy-bundle-v2'
  location: deployment().location
  properties: {
    mode: 'Incremental'
    expressionEvaluationOptions: {
      scope: 'inner'
    }
    template: loadJsonContent('generated/main.json')
    parameters: {
      effect: { value: effect }
      enforcementMode: { value: enforcementMode }
      notScopes: { value: notScopes }
    }
  }
}
output assignmentId string = namingDeployment.properties.outputs.assignmentId.value
