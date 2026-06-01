import { IPC_CHANNEL } from '../config/ipc'
import { getSettings, saveSettings, updateApplicationSettings } from '../services/settings.service'
import { handleIpc } from './ipc-handler'
import type { ApplicationSettings, SellerFlowSettings } from '../../shared/settings'
import { crawlerService } from '../services/crawler.service'

export function registerSettingsIPC(): void {
  handleIpc(IPC_CHANNEL.SETTINGS.GET, () => getSettings())
  handleIpc<[SellerFlowSettings], SellerFlowSettings>(
    IPC_CHANNEL.SETTINGS.SAVE,
    (_event, settings) => {
      const savedSettings = saveSettings(settings)
      crawlerService.applyCrawlingSettings(savedSettings.crawling)
      return savedSettings
    }
  )
  handleIpc<[Partial<ApplicationSettings>], ApplicationSettings>(
    IPC_CHANNEL.SETTINGS.UPDATE_APPLICATION,
    (_event, settings) => updateApplicationSettings(settings)
  )
}
