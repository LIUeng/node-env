import { defineConfigs } from 'reactive-vscode'

export const { 
  autoDetectVersion,
  autoSwitch,
  terminalIntegration,
  // watchConfigFiles,
  showAutoSwitchNotification
} = defineConfigs('node-env', {
  autoDetectVersion: 'boolean',
  autoSwitch: 'boolean',
  terminalIntegration: 'boolean',
  // watchConfigFiles: 'boolean',
  showAutoSwitchNotification: 'boolean'
})
